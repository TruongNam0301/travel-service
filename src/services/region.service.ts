import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as googleMaps from "../common/services/google-maps";
import { GoogleMapsConfig } from "../common/services/google-maps/google-maps.config";
import { Region } from "../entities/region.entity";

export interface RegionCheckResult {
  exists: boolean;
  region: Region | null;
  needsCrawl: boolean;
  reason?: "not_found" | "stale" | "insufficient_data" | "crawling";
}

@Injectable()
export class RegionService {
  private readonly logger = new Logger(RegionService.name);

  constructor(
    @InjectRepository(Region)
    private readonly regionRepository: Repository<Region>,
    @Inject(googleMaps.GOOGLE_MAPS_CLIENT)
    private readonly googleMapsClient: googleMaps.GoogleMapsClient,
    private readonly googleMapsConfig: GoogleMapsConfig,
  ) {}

  /**
   * Normalize a destination string to a region ID
   * Example: "Hoa Lư, Ninh Bình, Vietnam" → "hoa-lu-ninh-binh-vietnam"
   */
  normalizeRegionId(destination: string): string {
    return destination
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100);
  }

  /**
   * Check if a region has data and determine if crawling is needed
   */
  async checkRegionData(
    destination: string,
    placeType: "lodging" | "restaurant" | "attraction",
    minCount: number = 50,
  ): Promise<RegionCheckResult> {
    const regionId = this.normalizeRegionId(destination);

    this.logger.log({
      action: "region.check",
      destination,
      regionId,
      placeType,
      minCount,
    });

    const region = await this.regionRepository.findOne({
      where: { id: regionId },
    });

    if (!region) {
      return {
        exists: false,
        region: null,
        needsCrawl: true,
        reason: "not_found",
      };
    }

    // Check if currently crawling
    if (region.crawlStatus === "crawling") {
      return {
        exists: true,
        region,
        needsCrawl: false,
        reason: "crawling",
      };
    }

    // Check if data is stale
    const staleDays = this.googleMapsConfig.staleDays;
    if (region.isStale(staleDays)) {
      return {
        exists: true,
        region,
        needsCrawl: true,
        reason: "stale",
      };
    }

    // Check if region has enough data for this place type
    if (!region.hasEnoughData(placeType, minCount)) {
      return {
        exists: true,
        region,
        needsCrawl: true,
        reason: "insufficient_data",
      };
    }

    return {
      exists: true,
      region,
      needsCrawl: false,
    };
  }

  /**
   * Get or create a region, geocoding if necessary
   */
  async getOrCreateRegion(destination: string): Promise<Region> {
    const regionId = this.normalizeRegionId(destination);

    // Check if region exists
    let region = await this.regionRepository.findOne({
      where: { id: regionId },
    });

    if (region) {
      return region;
    }

    // Geocode to get center coordinates
    const coordinates = await this.googleMapsClient.geocode(destination);

    if (!coordinates) {
      this.logger.warn({
        action: "region.geocode_failed",
        destination,
        regionId,
      });
      // Create region with default coordinates (will need manual correction)
      coordinates!.lat = 0;
      coordinates!.lng = 0;
    }

    // Create new region
    region = this.regionRepository.create({
      id: regionId,
      displayName: destination,
      country: this.extractCountry(destination),
      centerLat: coordinates?.lat ?? 0,
      centerLng: coordinates?.lng ?? 0,
      radiusKm: this.googleMapsConfig.gridRadiusKm,
      placeCount: 0,
      lodgingCount: 0,
      restaurantCount: 0,
      attractionCount: 0,
      crawlStatus: "pending",
    });

    await this.regionRepository.save(region);

    this.logger.log({
      action: "region.created",
      regionId,
      destination,
      coordinates,
    });

    return region;
  }

  /**
   * Get region center coordinates
   */
  async getRegionCenter(
    destination: string,
  ): Promise<googleMaps.LatLng | null> {
    const regionId = this.normalizeRegionId(destination);

    // Check if we have it cached in the region
    const region = await this.regionRepository.findOne({
      where: { id: regionId },
    });

    if (region && region.centerLat !== 0 && region.centerLng !== 0) {
      return {
        lat: Number(region.centerLat),
        lng: Number(region.centerLng),
      };
    }

    // Otherwise geocode
    return await this.googleMapsClient.geocode(destination);
  }

  /**
   * Mark a region as crawling
   */
  async markCrawlStarted(regionId: string): Promise<void> {
    await this.regionRepository.update(regionId, {
      crawlStatus: "crawling",
      crawlError: undefined,
    });

    this.logger.log({ action: "region.crawl_started", regionId });
  }

  /**
   * Mark a region crawl as completed
   */
  async markCrawlCompleted(
    regionId: string,
    counts: {
      total: number;
      lodging: number;
      restaurant: number;
      attraction: number;
    },
  ): Promise<void> {
    await this.regionRepository.update(regionId, {
      crawlStatus: "completed",
      lastCrawledAt: new Date(),
      placeCount: counts.total,
      lodgingCount: counts.lodging,
      restaurantCount: counts.restaurant,
      attractionCount: counts.attraction,
      crawlError: undefined,
    });

    this.logger.log({
      action: "region.crawl_completed",
      regionId,
      counts,
    });
  }

  /**
   * Mark a region crawl as failed
   */
  async markCrawlFailed(regionId: string, error: string): Promise<void> {
    await this.regionRepository.update(regionId, {
      crawlStatus: "failed",
      crawlError: error,
    });

    this.logger.error({
      action: "region.crawl_failed",
      regionId,
      error,
    });
  }

  /**
   * Update region place counts
   */
  async updatePlaceCounts(
    regionId: string,
    placeType: "lodging" | "restaurant" | "attraction",
    count: number,
  ): Promise<void> {
    const updateData: Partial<Region> = {};

    switch (placeType) {
      case "lodging":
        updateData.lodgingCount = count;
        break;
      case "restaurant":
        updateData.restaurantCount = count;
        break;
      case "attraction":
        updateData.attractionCount = count;
        break;
    }

    // Get current counts to calculate total
    const region = await this.regionRepository.findOne({
      where: { id: regionId },
    });

    if (region) {
      const currentLodging =
        placeType === "lodging" ? count : region.lodgingCount;
      const currentRestaurant =
        placeType === "restaurant" ? count : region.restaurantCount;
      const currentAttraction =
        placeType === "attraction" ? count : region.attractionCount;
      updateData.placeCount =
        currentLodging + currentRestaurant + currentAttraction;
    }

    await this.regionRepository.update(regionId, updateData);
  }

  /**
   * Find region by ID
   */
  async findById(regionId: string): Promise<Region | null> {
    return await this.regionRepository.findOne({
      where: { id: regionId },
    });
  }

  /**
   * Find all regions that need re-crawling
   */
  async findStaleRegions(limit: number = 10): Promise<Region[]> {
    const staleDays = this.googleMapsConfig.staleDays;
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - staleDays);

    return await this.regionRepository
      .createQueryBuilder("r")
      .where("r.crawl_status = :status", { status: "completed" })
      .andWhere("r.last_crawled_at < :staleDate", { staleDate })
      .orderBy("r.last_crawled_at", "ASC")
      .take(limit)
      .getMany();
  }

  /**
   * Extract country from destination string
   */
  private extractCountry(destination: string): string | undefined {
    const parts = destination.split(",").map((p) => p.trim());
    if (parts.length > 1) {
      return parts[parts.length - 1];
    }
    return undefined;
  }
}

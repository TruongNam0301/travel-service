import { Injectable, Logger, Inject } from "@nestjs/common";
import * as googleMaps from "../../infrastructure/google-maps";
import { GoogleMapsConfig } from "../../infrastructure/google-maps/google-maps.config";
import { RegionService } from "./region.service";
import { GlobalPlaceType } from "../../features/embeddings/entities/embedding-global.entity";
import {
  EmbeddingsGlobalService,
  StorePlaceInput,
} from "../../features/embeddings/embeddings-global.service";

@Injectable()
export class GridCrawlService {
  private readonly logger = new Logger(GridCrawlService.name);

  constructor(
    @Inject(googleMaps.GOOGLE_MAPS_CLIENT)
    private readonly googleMapsClient: googleMaps.GoogleMapsClient,
    private readonly googleMapsConfig: GoogleMapsConfig,
    private readonly regionService: RegionService,
    private readonly embeddingsGlobalService: EmbeddingsGlobalService,
  ) {}

  /**
   * Crawl an entire region using grid-based search
   */
  async crawlRegion(
    destination: string,
    placeType: googleMaps.PlaceType,
  ): Promise<googleMaps.CrawlResult> {
    const startTime = Date.now();
    const regionId = this.regionService.normalizeRegionId(destination);
    const errors: string[] = [];
    let totalApiCalls = 0;

    this.logger.log({
      action: "grid_crawl.start",
      destination,
      regionId,
      placeType,
    });

    try {
      // Get or create region
      const region = await this.regionService.getOrCreateRegion(destination);

      // Mark crawl as started
      await this.regionService.markCrawlStarted(regionId);

      // Get region center
      const center: googleMaps.LatLng = {
        lat: Number(region.centerLat),
        lng: Number(region.centerLng),
      };

      if (center.lat === 0 && center.lng === 0) {
        throw new Error(`Region ${regionId} has no valid coordinates`);
      }

      // Generate grid cells
      const radiusKm = this.googleMapsConfig.gridRadiusKm;
      const cellSizeKm = this.googleMapsConfig.cellSizeKm;
      const grid = this.generateGrid(center, radiusKm, cellSizeKm);

      this.logger.log({
        action: "grid_crawl.grid_generated",
        regionId,
        center,
        radiusKm,
        cellSizeKm,
        cellCount: grid.length,
      });

      // Crawl each cell
      const allPlaces = new Map<string, googleMaps.PlaceSearchResult>();
      const qps = this.googleMapsConfig.qps;
      const delayMs = Math.ceil(1000 / qps);

      for (let i = 0; i < grid.length; i++) {
        const cell = grid[i];

        try {
          const places = await this.googleMapsClient.nearbySearch({
            location: cell.center,
            radius: cell.radius,
            type: placeType,
            maxResults: 60, // Get all pages
          });

          totalApiCalls++;

          // Deduplicate by place_id
          for (const place of places) {
            if (!allPlaces.has(place.placeId)) {
              allPlaces.set(place.placeId, place);
            }
          }

          this.logger.debug({
            action: "grid_crawl.cell_complete",
            regionId,
            cellIndex: i,
            cellsTotal: grid.length,
            foundInCell: places.length,
            totalUnique: allPlaces.size,
          });

          // Rate limiting
          if (i < grid.length - 1) {
            await this.delay(delayMs);
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Unknown error";
          errors.push(`Cell ${i}: ${errorMsg}`);
          this.logger.warn({
            action: "grid_crawl.cell_error",
            regionId,
            cellIndex: i,
            error: errorMsg,
          });
        }
      }

      this.logger.log({
        action: "grid_crawl.search_complete",
        regionId,
        uniquePlaces: allPlaces.size,
        apiCalls: totalApiCalls,
      });

      // Get details for all unique places
      const detailedPlaces: googleMaps.PlaceDetailsResult[] = [];
      const placeIds = Array.from(allPlaces.keys());

      for (let i = 0; i < placeIds.length; i++) {
        const placeId = placeIds[i];

        try {
          const details = await this.googleMapsClient.getPlaceDetails(placeId);
          totalApiCalls++;

          if (details) {
            detailedPlaces.push(details);
          }

          // Log progress every 50 places
          if ((i + 1) % 50 === 0) {
            this.logger.log({
              action: "grid_crawl.details_progress",
              regionId,
              processed: i + 1,
              total: placeIds.length,
            });
          }

          // Rate limiting
          if (i < placeIds.length - 1) {
            await this.delay(delayMs);
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Unknown error";
          errors.push(`Details ${placeId}: ${errorMsg}`);
          this.logger.warn({
            action: "grid_crawl.details_error",
            regionId,
            placeId,
            error: errorMsg,
          });
        }
      }

      this.logger.log({
        action: "grid_crawl.details_complete",
        regionId,
        detailedPlaces: detailedPlaces.length,
      });

      // Convert to storage format
      const globalPlaceType = this.mapPlaceType(placeType);
      const storePlaces: StorePlaceInput[] = detailedPlaces.map((place) =>
        this.embeddingsGlobalService.placeDetailsToInput(
          place,
          regionId,
          globalPlaceType,
        ),
      );

      // Store in database with embeddings
      const { stored, errors: storeErrors } =
        await this.embeddingsGlobalService.storePlacesBatch(
          storePlaces,
          regionId,
        );

      if (storeErrors > 0) {
        errors.push(`Storage errors: ${storeErrors}`);
      }

      // Update region stats
      const stats = await this.embeddingsGlobalService.getRegionStats(regionId);
      await this.regionService.markCrawlCompleted(regionId, stats);

      const duration = Date.now() - startTime;

      this.logger.log({
        action: "grid_crawl.complete",
        regionId,
        placeType,
        totalPlaces: detailedPlaces.length,
        stored,
        totalApiCalls,
        duration,
        errors: errors.length,
      });

      return {
        regionId,
        placeType,
        places: detailedPlaces,
        totalApiCalls,
        duration,
        errors,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      await this.regionService.markCrawlFailed(regionId, errorMsg);

      this.logger.error({
        action: "grid_crawl.failed",
        regionId,
        placeType,
        error: errorMsg,
      });

      return {
        regionId,
        placeType,
        places: [],
        totalApiCalls,
        duration: Date.now() - startTime,
        errors: [...errors, errorMsg],
      };
    }
  }

  /**
   * Generate a grid of cells to cover a circular region
   */
  generateGrid(
    center: googleMaps.LatLng,
    radiusKm: number,
    cellSizeKm: number,
  ): googleMaps.GridCell[] {
    const cells: googleMaps.GridCell[] = [];

    // Convert cell size to radius (overlapping for coverage)
    const cellRadius = (cellSizeKm * 1000) / 2; // meters

    // Calculate grid dimensions
    // Approximate: 1 degree latitude ≈ 111km
    // 1 degree longitude ≈ 111km * cos(latitude)
    const latDegPerKm = 1 / 111;
    const lngDegPerKm = 1 / (111 * Math.cos((center.lat * Math.PI) / 180));

    // Calculate number of cells in each direction
    const gridSize = Math.ceil((radiusKm * 2) / cellSizeKm);
    const halfGrid = Math.floor(gridSize / 2);

    let index = 0;
    for (let i = -halfGrid; i <= halfGrid; i++) {
      for (let j = -halfGrid; j <= halfGrid; j++) {
        const cellCenter: googleMaps.LatLng = {
          lat: center.lat + i * cellSizeKm * latDegPerKm,
          lng: center.lng + j * cellSizeKm * lngDegPerKm,
        };

        // Check if cell center is within the region radius
        const distanceFromCenter = this.haversineDistance(center, cellCenter);
        if (distanceFromCenter <= radiusKm + cellSizeKm / 2) {
          cells.push({
            center: cellCenter,
            radius: cellRadius,
            index: index++,
          });
        }
      }
    }

    return cells;
  }

  /**
   * Calculate Haversine distance between two points (in km)
   */
  private haversineDistance(
    point1: googleMaps.LatLng,
    point2: googleMaps.LatLng,
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(point2.lat - point1.lat);
    const dLng = this.toRad(point2.lng - point1.lng);
    const lat1 = this.toRad(point1.lat);
    const lat2 = this.toRad(point2.lat);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Map Google Places type to our GlobalPlaceType
   */
  private mapPlaceType(type: googleMaps.PlaceType): GlobalPlaceType {
    switch (type) {
      case "lodging":
        return "lodging";
      case "restaurant":
        return "restaurant";
      case "cafe":
        return "cafe";
      case "bar":
        return "bar";
      case "tourist_attraction":
      case "museum":
      case "park":
        return "tourist_attraction";
      default:
        return "other";
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

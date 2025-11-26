import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Inject, Injectable, Logger } from "@nestjs/common";
import * as cacheManager from "cache-manager";
import { GoogleMapsClient } from "./google-maps.client";
import { GoogleMapsConfig } from "./google-maps.config";
import {
  GoogleGeocodeResponse,
  GooglePlaceDetailsResponse,
  GooglePlaceResult,
  GoogleSearchResponse,
  LatLng,
  NearbySearchOptions,
  PlaceDetailsResult,
  PlacePhoto,
  PlaceSearchResult,
  TextSearchOptions,
} from "./types/places.type";

@Injectable()
export class GoogleMapsService implements GoogleMapsClient {
  private readonly logger = new Logger(GoogleMapsService.name);
  private readonly baseUrl = "https://maps.googleapis.com/maps/api";

  // Cache TTLs (in seconds)
  private readonly CACHE_TTL_GEOCODE = 7 * 24 * 60 * 60; // 7 days
  private readonly CACHE_TTL_DETAILS = 24 * 60 * 60; // 24 hours
  private readonly CACHE_TTL_SEARCH = 60 * 60; // 1 hour

  constructor(
    private readonly config: GoogleMapsConfig,
    @Inject(CACHE_MANAGER) private readonly cache: cacheManager.Cache,
  ) {}

  /**
   * Text-based place search
   */
  async textSearch(opts: TextSearchOptions): Promise<PlaceSearchResult[]> {
    const cacheKey = `gmaps:text:${this.hashOptions(opts as unknown as Record<string, unknown>)}`;

    // Check cache first
    const cached = await this.cache.get<PlaceSearchResult[]>(cacheKey);
    if (cached) {
      this.logger.debug({
        action: "gmaps.text_search.cache_hit",
        query: opts.query,
      });
      return cached;
    }

    const params = new URLSearchParams({
      query: opts.query,
      key: this.config.apiKey,
      language: opts.language || this.config.defaultLanguage,
    });

    if (opts.location) {
      params.append("location", `${opts.location.lat},${opts.location.lng}`);
      if (opts.radius) {
        params.append("radius", String(opts.radius));
      }
    }
    if (opts.type) {
      params.append("type", opts.type);
    }

    const url = `${this.baseUrl}/place/textsearch/json?${params}`;
    const results = await this.fetchAllPages<GoogleSearchResponse>(
      url,
      opts.maxResults || 60,
    );

    const transformed = this.transformSearchResults(results);

    // Filter by minimum rating if specified
    const filtered = opts.minRating
      ? transformed.filter((r) => (r.rating || 0) >= opts.minRating!)
      : transformed;

    // Cache results
    await this.cache.set(cacheKey, filtered, this.CACHE_TTL_SEARCH);

    this.logger.log({
      action: "gmaps.text_search",
      query: opts.query,
      resultsCount: filtered.length,
    });

    return filtered;
  }

  /**
   * Nearby place search (for grid-based crawling)
   */
  async nearbySearch(opts: NearbySearchOptions): Promise<PlaceSearchResult[]> {
    const cacheKey = `gmaps:nearby:${this.hashOptions(opts as unknown as Record<string, unknown>)}`;

    // Check cache first
    const cached = await this.cache.get<PlaceSearchResult[]>(cacheKey);
    if (cached) {
      this.logger.debug({
        action: "gmaps.nearby_search.cache_hit",
        location: opts.location,
      });
      return cached;
    }

    const params = new URLSearchParams({
      location: `${opts.location.lat},${opts.location.lng}`,
      radius: String(opts.radius),
      key: this.config.apiKey,
      language: opts.language || this.config.defaultLanguage,
    });

    if (opts.type) {
      params.append("type", opts.type);
    }
    if (opts.keyword) {
      params.append("keyword", opts.keyword);
    }

    const url = `${this.baseUrl}/place/nearbysearch/json?${params}`;
    const results = await this.fetchAllPages<GoogleSearchResponse>(
      url,
      opts.maxResults || 60,
    );

    const transformed = this.transformSearchResults(results);

    // Filter by minimum rating if specified
    const filtered = opts.minRating
      ? transformed.filter((r) => (r.rating || 0) >= opts.minRating!)
      : transformed;

    // Cache results
    await this.cache.set(cacheKey, filtered, this.CACHE_TTL_SEARCH);

    this.logger.log({
      action: "gmaps.nearby_search",
      location: opts.location,
      type: opts.type,
      resultsCount: filtered.length,
    });

    return filtered;
  }

  /**
   * Get detailed place information
   */
  async getPlaceDetails(placeId: string): Promise<PlaceDetailsResult | null> {
    const cacheKey = `gmaps:details:${placeId}`;

    // Check cache first
    const cached = await this.cache.get<PlaceDetailsResult>(cacheKey);
    if (cached) {
      this.logger.debug({ action: "gmaps.details.cache_hit", placeId });
      return cached;
    }

    const fields = this.config.values.detailsFields.join(",");
    const params = new URLSearchParams({
      place_id: placeId,
      fields,
      key: this.config.apiKey,
      language: this.config.defaultLanguage,
    });

    const url = `${this.baseUrl}/place/details/json?${params}`;

    try {
      const response = await fetch(url);
      const data: GooglePlaceDetailsResponse =
        (await response.json()) as GooglePlaceDetailsResponse;

      if (data.status !== "OK") {
        this.logger.warn({
          action: "gmaps.details.error",
          placeId,
          status: data.status,
          error: data.error_message,
        });
        return null;
      }

      const result = this.transformPlaceDetails(data.result);

      // Cache results
      await this.cache.set(cacheKey, result, this.CACHE_TTL_DETAILS);

      this.logger.debug({ action: "gmaps.details.success", placeId });

      return result;
    } catch (error) {
      this.logger.error({
        action: "gmaps.details.fetch_error",
        placeId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return null;
    }
  }

  /**
   * Geocode an address to coordinates
   */
  async geocode(address: string): Promise<LatLng | null> {
    const cacheKey = `gmaps:geocode:${this.hashString(address)}`;

    // Check cache first
    const cached = await this.cache.get<LatLng>(cacheKey);
    if (cached) {
      this.logger.debug({ action: "gmaps.geocode.cache_hit", address });
      return cached;
    }

    const params = new URLSearchParams({
      address,
      key: this.config.apiKey,
    });

    const url = `${this.baseUrl}/geocode/json?${params}`;

    try {
      const response = await fetch(url);
      const data: GoogleGeocodeResponse =
        (await response.json()) as GoogleGeocodeResponse;

      if (data.status !== "OK" || !data.results?.[0]) {
        this.logger.warn({
          action: "gmaps.geocode.error",
          address,
          status: data.status,
        });
        return null;
      }

      const location = data.results[0].geometry.location;
      const result: LatLng = {
        lat: location.lat,
        lng: location.lng,
      };

      // Cache results (geocoding rarely changes)
      await this.cache.set(cacheKey, result, this.CACHE_TTL_GEOCODE);

      this.logger.log({
        action: "gmaps.geocode.success",
        address,
        location: result,
      });

      return result;
    } catch (error) {
      this.logger.error({
        action: "gmaps.geocode.fetch_error",
        address,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return null;
    }
  }

  /**
   * Get photo URL for a place photo
   */
  getPhotoUrl(photoReference: string, maxWidth: number = 400): string {
    return `${this.baseUrl}/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${this.config.apiKey}`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Helper Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Fetch all pages of results (handles next_page_token)
   */
  private async fetchAllPages<T extends GoogleSearchResponse>(
    initialUrl: string,
    maxResults: number,
  ): Promise<GooglePlaceResult[]> {
    const allResults: GooglePlaceResult[] = [];
    let url = initialUrl;
    let pageCount = 0;
    const maxPages = Math.ceil(maxResults / 20); // Google returns max 20 per page

    while (pageCount < maxPages) {
      try {
        const response = await fetch(url);
        const data: T = (await response.json()) as T;

        if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
          this.logger.warn({
            action: "gmaps.fetch_page.error",
            status: data.status,
            error: data.error_message,
            page: pageCount,
          });
          break;
        }

        if (data.results?.length) {
          allResults.push(...data.results);
        }

        // Check if there are more pages
        if (!data.next_page_token || allResults.length >= maxResults) {
          break;
        }

        // Wait before fetching next page (Google requires a short delay)
        await this.delay(2000);

        // Build URL for next page
        const baseUrlParts = initialUrl.split("?")[0];
        url = `${baseUrlParts}?pagetoken=${data.next_page_token}&key=${this.config.apiKey}`;
        pageCount++;
      } catch (error) {
        this.logger.error({
          action: "gmaps.fetch_page.fetch_error",
          page: pageCount,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        break;
      }
    }

    return allResults.slice(0, maxResults);
  }

  /**
   * Transform Google API results to our format
   */
  private transformSearchResults(
    results: GooglePlaceResult[],
  ): PlaceSearchResult[] {
    return results.map((r) => ({
      placeId: r.place_id,
      name: r.name,
      address: r.formatted_address || r.vicinity,
      location: r.geometry?.location || { lat: 0, lng: 0 },
      rating: r.rating,
      totalRatings: r.user_ratings_total,
      priceLevel: r.price_level,
      types: r.types || [],
      openingHours: r.opening_hours
        ? { openNow: r.opening_hours.open_now }
        : undefined,
      photos: this.transformPhotos(r.photos),
      googleMapsUrl: r.url,
    }));
  }

  /**
   * Transform Google place details to our format
   */
  private transformPlaceDetails(result: GooglePlaceResult): PlaceDetailsResult {
    return {
      placeId: result.place_id,
      name: result.name,
      address: result.formatted_address,
      location: result.geometry?.location || { lat: 0, lng: 0 },
      rating: result.rating,
      totalRatings: result.user_ratings_total,
      priceLevel: result.price_level,
      types: result.types || [],
      openingHours: result.opening_hours
        ? {
            openNow: result.opening_hours.open_now,
            weekdayText: result.opening_hours.weekday_text,
            periods: result.opening_hours.periods?.map((p) => ({
              open: { day: p.open.day, time: p.open.time },
              close: p.close
                ? { day: p.close.day, time: p.close.time }
                : undefined,
            })),
          }
        : undefined,
      photos: this.transformPhotos(result.photos),
      phoneNumber: result.formatted_phone_number,
      website: result.website,
      reviews: result.reviews?.map((r) => ({
        authorName: r.author_name,
        authorUrl: r.author_url,
        profilePhotoUrl: r.profile_photo_url,
        rating: r.rating,
        relativeTimeDescription: r.relative_time_description,
        text: r.text,
        time: r.time,
        language: r.language,
      })),
      editorialSummary: result.editorial_summary?.overview,
      googleMapsUrl: result.url,
    };
  }

  /**
   * Transform photo references
   */
  private transformPhotos(
    photos?: Array<{
      photo_reference: string;
      width: number;
      height: number;
      html_attributions?: string[];
    }>,
  ): PlacePhoto[] | undefined {
    if (!photos?.length) return undefined;

    return photos.slice(0, 5).map((p) => ({
      photoReference: p.photo_reference,
      width: p.width,
      height: p.height,
      htmlAttributions: p.html_attributions,
    }));
  }

  /**
   * Hash options for cache key
   */
  private hashOptions(opts: Record<string, unknown>): string {
    const str = JSON.stringify(opts);
    return this.hashString(str);
  }

  /**
   * Simple string hash
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

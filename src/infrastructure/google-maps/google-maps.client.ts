import {
  PlaceSearchResult,
  PlaceDetailsResult,
  TextSearchOptions,
  NearbySearchOptions,
  LatLng,
} from "./types/places.type";

/**
 * Google Maps Client Interface
 * Defines the contract for Google Maps API interactions
 */
export interface GoogleMapsClient {
  /**
   * Search for places using a text query
   */
  textSearch(opts: TextSearchOptions): Promise<PlaceSearchResult[]>;

  /**
   * Search for places near a specific location
   */
  nearbySearch(opts: NearbySearchOptions): Promise<PlaceSearchResult[]>;

  /**
   * Get detailed information about a specific place
   */
  getPlaceDetails(placeId: string): Promise<PlaceDetailsResult | null>;

  /**
   * Convert an address to coordinates
   */
  geocode(address: string): Promise<LatLng | null>;

  /**
   * Get photo URL for a place photo
   */
  getPhotoUrl(photoReference: string, maxWidth?: number): string;
}

export const GOOGLE_MAPS_CLIENT = Symbol("GOOGLE_MAPS_CLIENT");

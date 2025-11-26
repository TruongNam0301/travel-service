/**
 * Google Maps Places API Type Definitions
 */

// ─────────────────────────────────────────────────────────────────────────────
// Core Types
// ─────────────────────────────────────────────────────────────────────────────

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Viewport {
  northeast: LatLng;
  southwest: LatLng;
}

export interface Geometry {
  location: LatLng;
  viewport?: Viewport;
}

export interface PlacePhoto {
  photoReference: string;
  width: number;
  height: number;
  htmlAttributions?: string[];
}

export interface OpeningHoursPeriod {
  open: {
    day: number;
    time: string;
    hours?: number;
    minutes?: number;
  };
  close?: {
    day: number;
    time: string;
    hours?: number;
    minutes?: number;
  };
}

export interface OpeningHours {
  openNow?: boolean;
  weekdayText?: string[];
  periods?: OpeningHoursPeriod[];
}

export interface PlaceReview {
  authorName: string;
  authorUrl?: string;
  profilePhotoUrl?: string;
  rating: number;
  relativeTimeDescription?: string;
  text: string;
  time: number;
  language?: string;
}

export interface EditorialSummary {
  overview?: string;
  language?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Google Maps API Response Types
// ─────────────────────────────────────────────────────────────────────────────

export interface GooglePlaceResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  geometry?: {
    location: { lat: number; lng: number };
    viewport?: {
      northeast: { lat: number; lng: number };
      southwest: { lat: number; lng: number };
    };
  };
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  types?: string[];
  photos?: Array<{
    photo_reference: string;
    width: number;
    height: number;
    html_attributions?: string[];
  }>;
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
    periods?: Array<{
      open: { day: number; time: string };
      close?: { day: number; time: string };
    }>;
  };
  website?: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  reviews?: Array<{
    author_name: string;
    author_url?: string;
    profile_photo_url?: string;
    rating: number;
    relative_time_description?: string;
    text: string;
    time: number;
    language?: string;
  }>;
  editorial_summary?: {
    overview?: string;
    language?: string;
  };
  url?: string;
  vicinity?: string;
  business_status?: string;
  utc_offset?: number;
}

export interface GoogleSearchResponse {
  results: GooglePlaceResult[];
  status: GoogleApiStatus;
  error_message?: string;
  next_page_token?: string;
  html_attributions?: string[];
}

export interface GooglePlaceDetailsResponse {
  result: GooglePlaceResult;
  status: GoogleApiStatus;
  error_message?: string;
  html_attributions?: string[];
}

export interface GoogleGeocodeResult {
  place_id: string;
  formatted_address: string;
  geometry: {
    location: { lat: number; lng: number };
    location_type: string;
    viewport: {
      northeast: { lat: number; lng: number };
      southwest: { lat: number; lng: number };
    };
  };
  address_components: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
  types: string[];
}

export interface GoogleGeocodeResponse {
  results: GoogleGeocodeResult[];
  status: GoogleApiStatus;
  error_message?: string;
}

export type GoogleApiStatus =
  | "OK"
  | "ZERO_RESULTS"
  | "INVALID_REQUEST"
  | "OVER_QUERY_LIMIT"
  | "REQUEST_DENIED"
  | "UNKNOWN_ERROR";

// ─────────────────────────────────────────────────────────────────────────────
// Application Types (Transformed from Google API)
// ─────────────────────────────────────────────────────────────────────────────

export interface PlaceSearchResult {
  placeId: string;
  name: string;
  address?: string;
  location: LatLng;
  rating?: number;
  totalRatings?: number;
  priceLevel?: number;
  types: string[];
  openingHours?: {
    openNow?: boolean;
  };
  photos?: PlacePhoto[];
  googleMapsUrl?: string;
}

export interface PlaceDetailsResult extends PlaceSearchResult {
  phoneNumber?: string;
  website?: string;
  reviews?: PlaceReview[];
  editorialSummary?: string;
  openingHours?: OpeningHours;
}

// ─────────────────────────────────────────────────────────────────────────────
// Search Options
// ─────────────────────────────────────────────────────────────────────────────

export type PlaceType =
  | "lodging"
  | "restaurant"
  | "tourist_attraction"
  | "cafe"
  | "bar"
  | "museum"
  | "park"
  | "shopping_mall";

export interface TextSearchOptions {
  query: string;
  location?: LatLng;
  radius?: number;
  type?: PlaceType;
  minRating?: number;
  maxResults?: number;
  language?: string;
  pageToken?: string;
}

export interface NearbySearchOptions {
  location: LatLng;
  radius: number;
  type?: PlaceType;
  keyword?: string;
  minRating?: number;
  maxResults?: number;
  language?: string;
  pageToken?: string;
}

export interface PlaceDetailsOptions {
  placeId: string;
  fields?: string[];
  language?: string;
}

export interface GeocodeOptions {
  address: string;
  language?: string;
  region?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Grid Crawl Types
// ─────────────────────────────────────────────────────────────────────────────

export interface GridCell {
  center: LatLng;
  radius: number;
  index: number;
}

export interface GridConfig {
  center: LatLng;
  radiusKm: number;
  cellSizeKm: number;
}

export interface CrawlProgress {
  regionId: string;
  placeType: string;
  totalCells: number;
  completedCells: number;
  totalPlaces: number;
  uniquePlaces: number;
  errors: number;
  startedAt: Date;
}

export interface CrawlResult {
  regionId: string;
  placeType: PlaceType;
  places: PlaceDetailsResult[];
  totalApiCalls: number;
  duration: number;
  errors: string[];
}

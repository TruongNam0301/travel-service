import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface GoogleMapsConfigValues {
  apiKey: string;
  cacheTtl: number;
  gridRadiusKm: number;
  cellSizeKm: number;
  staleDays: number;
  qps: number;
  defaultLanguage: string;
  maxResultsPerPage: number;
  detailsFields: string[];
}

@Injectable()
export class GoogleMapsConfig {
  private readonly configValues: GoogleMapsConfigValues;

  constructor(private readonly configService: ConfigService) {
    this.configValues = {
      apiKey: this.configService.getOrThrow<string>("GOOGLE_MAPS_API_KEY"),
      cacheTtl: this.configService.get<number>("GOOGLE_MAPS_CACHE_TTL", 3600),
      gridRadiusKm: this.configService.get<number>(
        "GOOGLE_MAPS_GRID_RADIUS_KM",
        20,
      ),
      cellSizeKm: this.configService.get<number>("GOOGLE_MAPS_CELL_SIZE_KM", 3),
      staleDays: this.configService.get<number>("GOOGLE_MAPS_STALE_DAYS", 30),
      qps: this.configService.get<number>("GOOGLE_MAPS_QPS", 10),
      defaultLanguage: this.configService.get<string>(
        "GOOGLE_MAPS_DEFAULT_LANGUAGE",
        "vi",
      ),
      maxResultsPerPage: 20, // Google Maps API limit
      detailsFields: [
        "place_id",
        "name",
        "formatted_address",
        "geometry",
        "rating",
        "user_ratings_total",
        "price_level",
        "types",
        "photos",
        "opening_hours",
        "website",
        "formatted_phone_number",
        "reviews",
        "editorial_summary",
        "url",
      ],
    };
  }

  get values(): GoogleMapsConfigValues {
    return this.configValues;
  }

  get apiKey(): string {
    return this.configValues.apiKey;
  }

  get cacheTtl(): number {
    return this.configValues.cacheTtl;
  }

  get gridRadiusKm(): number {
    return this.configValues.gridRadiusKm;
  }

  get cellSizeKm(): number {
    return this.configValues.cellSizeKm;
  }

  get staleDays(): number {
    return this.configValues.staleDays;
  }

  get qps(): number {
    return this.configValues.qps;
  }

  get defaultLanguage(): string {
    return this.configValues.defaultLanguage;
  }
}

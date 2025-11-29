import { Inject, Injectable } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import googleMapsConfigFactory from "../../config/google-maps.config";

// Re-export type from the config file
export type { GoogleMapsConfig as GoogleMapsConfigValues } from "../../config/google-maps.config";

/**
 * GoogleMapsConfig service - wraps the configuration for easier injection
 * This is kept for backward compatibility with existing services
 */
@Injectable()
export class GoogleMapsConfig {
  constructor(
    @Inject(googleMapsConfigFactory.KEY)
    private readonly config: ConfigType<typeof googleMapsConfigFactory>,
  ) {}

  get values(): ConfigType<typeof googleMapsConfigFactory> {
    return this.config;
  }

  get apiKey(): string {
    return this.config.apiKey;
  }

  get cacheTtl(): number {
    return this.config.cacheTtl;
  }

  get gridRadiusKm(): number {
    return this.config.gridRadiusKm;
  }

  get cellSizeKm(): number {
    return this.config.cellSizeKm;
  }

  get staleDays(): number {
    return this.config.staleDays;
  }

  get qps(): number {
    return this.config.qps;
  }

  get defaultLanguage(): string {
    return this.config.defaultLanguage;
  }
}

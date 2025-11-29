import { Module, Global, Logger } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CacheModule } from "@nestjs/cache-manager";
import type { Cache } from "cache-manager";
import googleMapsConfig from "../../config/google-maps.config";
import {
  GoogleMapsService,
  GoogleMapsConfig,
  GOOGLE_MAPS_CLIENT,
} from "./index";
import { RegionService } from "../../domain/region/region.service";
import { EmbeddingsGlobalService } from "../../features/embeddings/embeddings-global.service";
import { GridCrawlService } from "../../domain/region/grid-crawl.service";
import { EmbeddingGlobal } from "../../features/embeddings/entities/embedding-global.entity";
import { Region } from "../../domain/region/entities/region.entity";

const logger = new Logger("GoogleMapsModule");

/**
 * Google Maps Module
 * Provides Google Maps API integration for real data crawling
 *
 * This module is optional - if GOOGLE_MAPS_API_KEY is not set,
 * the services will return null and the system falls back to LLM-only mode.
 */
@Global()
@Module({
  imports: [
    ConfigModule.forFeature(googleMapsConfig),
    TypeOrmModule.forFeature([EmbeddingGlobal, Region]),
    CacheModule.register(),
  ],
  providers: [
    // Google Maps Config wrapper
    GoogleMapsConfig,

    // Google Maps Client (interface-based)
    {
      provide: GOOGLE_MAPS_CLIENT,
      useFactory: (config: GoogleMapsConfig, cacheManager: Cache) => {
        if (!config.apiKey) {
          logger.warn(
            "GOOGLE_MAPS_API_KEY not set. Google Maps features disabled. Using LLM-only mode.",
          );
          return null;
        }
        return new GoogleMapsService(config, cacheManager);
      },
      inject: [GoogleMapsConfig, "CACHE_MANAGER"],
    },

    // Region Service
    RegionService,

    // Embeddings Global Service
    EmbeddingsGlobalService,

    // Grid Crawl Service
    GridCrawlService,
  ],
  exports: [
    GOOGLE_MAPS_CLIENT,
    GoogleMapsConfig,
    RegionService,
    EmbeddingsGlobalService,
    GridCrawlService,
    TypeOrmModule,
  ],
})
export class GoogleMapsModule {}

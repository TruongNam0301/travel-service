import { Module, Global, Logger } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { CacheModule } from "@nestjs/cache-manager";
import {
  GoogleMapsService,
  GoogleMapsConfig,
  GOOGLE_MAPS_CLIENT,
} from "../common/services/google-maps";
import { RegionService } from "../services/region.service";
import { EmbeddingsGlobalService } from "../services/embeddings-global.service";
import { GridCrawlService } from "../services/grid-crawl.service";
import { EmbeddingGlobal } from "../entities/embedding-global.entity";
import { Region } from "../entities/region.entity";

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
    TypeOrmModule.forFeature([EmbeddingGlobal, Region]),
    ConfigModule,
    CacheModule.register(),
  ],
  providers: [
    // Google Maps Config - always provided (uses defaults if no API key)
    {
      provide: GoogleMapsConfig,
      useFactory: (configService: ConfigService) => {
        const apiKey = configService.get<string>("GOOGLE_MAPS_API_KEY");
        if (!apiKey) {
          logger.warn(
            "GOOGLE_MAPS_API_KEY not set. Google Maps features disabled. Using LLM-only mode.",
          );
        }
        return new GoogleMapsConfig(configService);
      },
      inject: [ConfigService],
    },

    // Google Maps Client (interface-based)
    {
      provide: GOOGLE_MAPS_CLIENT,
      useFactory: (
        config: GoogleMapsConfig,
        configService: ConfigService,
        cacheManager: any,
      ) => {
        const apiKey = configService.get<string>("GOOGLE_MAPS_API_KEY");
        if (!apiKey) {
          return null;
        }
        return new GoogleMapsService(config, cacheManager);
      },
      inject: [GoogleMapsConfig, ConfigService, "CACHE_MANAGER"],
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

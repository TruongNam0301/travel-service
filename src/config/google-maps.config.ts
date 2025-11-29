import { registerAs } from "@nestjs/config";
import { z } from "zod";

const googleMapsConfigSchema = z.object({
  apiKey: z.string().min(1, "Google Maps API key is required"),
  cacheTtl: z.number().positive().default(3600),
  gridRadiusKm: z.number().positive().default(20),
  cellSizeKm: z.number().positive().default(3),
  staleDays: z.number().positive().default(30),
  qps: z.number().positive().default(10),
  defaultLanguage: z.string().default("vi"),
  maxResultsPerPage: z.number().positive().default(20),
  detailsFields: z
    .array(z.string())
    .default([
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
    ]),
});

export type GoogleMapsConfig = z.infer<typeof googleMapsConfigSchema>;

export default registerAs("googleMaps", () =>
  googleMapsConfigSchema.parse({
    apiKey: process.env.GOOGLE_MAPS_API_KEY,
    cacheTtl: process.env.GOOGLE_MAPS_CACHE_TTL
      ? parseInt(process.env.GOOGLE_MAPS_CACHE_TTL, 10)
      : 3600,
    gridRadiusKm: process.env.GOOGLE_MAPS_GRID_RADIUS_KM
      ? parseInt(process.env.GOOGLE_MAPS_GRID_RADIUS_KM, 10)
      : 20,
    cellSizeKm: process.env.GOOGLE_MAPS_CELL_SIZE_KM
      ? parseInt(process.env.GOOGLE_MAPS_CELL_SIZE_KM, 10)
      : 3,
    staleDays: process.env.GOOGLE_MAPS_STALE_DAYS
      ? parseInt(process.env.GOOGLE_MAPS_STALE_DAYS, 10)
      : 30,
    qps: process.env.GOOGLE_MAPS_QPS
      ? parseInt(process.env.GOOGLE_MAPS_QPS, 10)
      : 10,
    defaultLanguage: process.env.GOOGLE_MAPS_DEFAULT_LANGUAGE || "vi",
    maxResultsPerPage: process.env.GOOGLE_MAPS_MAX_RESULTS_PER_PAGE
      ? parseInt(process.env.GOOGLE_MAPS_MAX_RESULTS_PER_PAGE, 10)
      : 20,
    detailsFields: process.env.GOOGLE_MAPS_DETAILS_FIELDS
      ? process.env.GOOGLE_MAPS_DETAILS_FIELDS.split(",")
      : [
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
  }),
);

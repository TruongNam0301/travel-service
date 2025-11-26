import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

export type GlobalPlaceType =
  | "lodging"
  | "restaurant"
  | "tourist_attraction"
  | "cafe"
  | "bar"
  | "other";

export interface PlacePhoto {
  photoReference: string;
  width: number;
  height: number;
  url?: string;
}

export interface OpeningHours {
  openNow?: boolean;
  weekdayText?: string[];
  periods?: Array<{
    open: { day: number; time: string };
    close?: { day: number; time: string };
  }>;
}

export interface RawPlaceData {
  placeId: string;
  name: string;
  formattedAddress?: string;
  geometry?: {
    location: { lat: number; lng: number };
    viewport?: {
      northeast: { lat: number; lng: number };
      southwest: { lat: number; lng: number };
    };
  };
  rating?: number;
  userRatingsTotal?: number;
  priceLevel?: number;
  types?: string[];
  photos?: PlacePhoto[];
  openingHours?: OpeningHours;
  website?: string;
  formattedPhoneNumber?: string;
  reviews?: Array<{
    authorName: string;
    rating: number;
    text: string;
    time: number;
  }>;
  editorialSummary?: {
    overview?: string;
  };
  url?: string; // Google Maps URL
}

@Entity("embeddings_global")
@Index(["regionId", "placeType"])
@Index(["regionId", "crawledAt"])
@Index(["regionId", "placeType", "rating"])
export class EmbeddingGlobal {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "place_id", type: "varchar", length: 255, unique: true })
  placeId!: string;

  @Column({ name: "region_id", type: "varchar", length: 100 })
  regionId!: string;

  @Column({ name: "place_type", type: "varchar", length: 50 })
  placeType!: GlobalPlaceType;

  // pgvector column - vector(1536) for OpenAI embeddings
  @Column({ type: "vector", nullable: false })
  vector!: number[];

  @Column({ type: "text" })
  content!: string;

  @Column({ name: "raw_data", type: "jsonb", default: {} })
  rawData!: RawPlaceData;

  @Column({ type: "varchar", length: 500 })
  name!: string;

  @Column({ type: "varchar", length: 1000, nullable: true })
  address?: string;

  @Column({ type: "decimal", precision: 10, scale: 7 })
  lat!: number;

  @Column({ type: "decimal", precision: 10, scale: 7 })
  lng!: number;

  @Column({ type: "decimal", precision: 2, scale: 1, nullable: true })
  rating?: number;

  @Column({ name: "total_ratings", type: "int", default: 0 })
  totalRatings!: number;

  @Column({ name: "price_level", type: "int", nullable: true })
  priceLevel?: number;

  @Column({ type: "jsonb", default: [] })
  photos!: PlacePhoto[];

  @Column({ type: "jsonb", default: [] })
  types!: string[];

  @Column({ name: "opening_hours", type: "jsonb", nullable: true })
  openingHours?: OpeningHours;

  @Column({ type: "varchar", length: 1000, nullable: true })
  website?: string;

  @Column({ name: "phone_number", type: "varchar", length: 50, nullable: true })
  phoneNumber?: string;

  @Column({ name: "crawled_at", type: "timestamptz", default: () => "now()" })
  crawledAt!: Date;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}

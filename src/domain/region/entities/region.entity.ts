import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

export type CrawlStatus =
  | "pending"
  | "crawling"
  | "completed"
  | "failed"
  | "stale";

@Entity("regions")
@Index(["crawlStatus", "lastCrawledAt"])
@Index(["centerLat", "centerLng"])
export class Region {
  // Normalized region key (e.g., "hoa-lu-ninh-binh")
  @PrimaryColumn({ type: "varchar", length: 100 })
  id!: string;

  @Column({ name: "display_name", type: "varchar", length: 255 })
  displayName!: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  country?: string;

  @Column({ name: "center_lat", type: "decimal", precision: 10, scale: 7 })
  centerLat!: number;

  @Column({ name: "center_lng", type: "decimal", precision: 10, scale: 7 })
  centerLng!: number;

  @Column({ name: "radius_km", type: "int", default: 20 })
  radiusKm!: number;

  @Column({ name: "place_count", type: "int", default: 0 })
  placeCount!: number;

  @Column({ name: "lodging_count", type: "int", default: 0 })
  lodgingCount!: number;

  @Column({ name: "restaurant_count", type: "int", default: 0 })
  restaurantCount!: number;

  @Column({ name: "attraction_count", type: "int", default: 0 })
  attractionCount!: number;

  @Column({ name: "last_crawled_at", type: "timestamptz", nullable: true })
  lastCrawledAt?: Date;

  @Column({
    name: "crawl_status",
    type: "varchar",
    length: 20,
    default: "pending",
  })
  crawlStatus!: CrawlStatus;

  @Column({ name: "crawl_error", type: "text", nullable: true })
  crawlError?: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  /**
   * Check if this region's data is stale based on a maximum age
   * @param maxAgeDays Number of days after which data is considered stale
   */
  isStale(maxAgeDays: number = 30): boolean {
    if (!this.lastCrawledAt) return true;
    const now = new Date();
    const ageMs = now.getTime() - this.lastCrawledAt.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    return ageDays > maxAgeDays;
  }

  /**
   * Check if this region has enough data of a specific type
   * @param placeType The type of place to check
   * @param minCount Minimum number of places required
   */
  hasEnoughData(
    placeType: "lodging" | "restaurant" | "attraction",
    minCount: number = 50,
  ): boolean {
    switch (placeType) {
      case "lodging":
        return this.lodgingCount >= minCount;
      case "restaurant":
        return this.restaurantCount >= minCount;
      case "attraction":
        return this.attractionCount >= minCount;
      default:
        return false;
    }
  }
}

import { registerAs } from "@nestjs/config";

export type VectorSearchMode = "cosine" | "hnsw";

export interface VectorConfig {
  searchMode: VectorSearchMode;
  hnsw: {
    m: number; // Max connections per layer
    efConstruction: number; // Size of the dynamic candidate list
  };
}

export default registerAs(
  "vector",
  (): VectorConfig => ({
    searchMode: (process.env.VECTOR_SEARCH_MODE as VectorSearchMode) || "hnsw",
    hnsw: {
      m: parseInt(process.env.VECTOR_HNSW_M || "16", 10),
      efConstruction: parseInt(
        process.env.VECTOR_HNSW_EF_CONSTRUCTION || "64",
        10,
      ),
    },
  }),
);

export const VECTOR_CONFIG_KEY = "vector";

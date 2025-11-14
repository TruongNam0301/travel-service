// Lightweight LLM interface (generation + embeddings)
// Acts as a thin contract so any provider (OpenAI, etc.) can be swapped in.
export type LlmGenerateOpts = {
  system?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  jobId?: string; // for log correlation
};

export type LlmGenerateResult = {
  text: string;
  usage?: { input: number; output: number; total: number };
  model?: string;
  latencyMs?: number;
  provider?: string;
};

export interface LlmClient {
  generate(prompt: string, opts?: LlmGenerateOpts): Promise<LlmGenerateResult>;
  embed(
    texts: string[],
    opts?: { timeoutMs?: number; jobId?: string },
  ): Promise<number[][]>;
}

export const LLM_CLIENT = Symbol("LLM_CLIENT");

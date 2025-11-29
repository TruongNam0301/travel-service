export interface LlmUsage {
  input: number;
  output: number;
  total: number;
}

export interface LlmGenerateOpts {
  system?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  jobId?: string;
  model?: string; // NEW: per-call model override
}

export interface LlmGenerateResult {
  text: string;
  usage: LlmUsage;
  model: string;
  provider: "openai"; // extend if you add more
  latencyMs: number;
}

export interface LlmClient {
  generate(prompt: string, opts?: LlmGenerateOpts): Promise<LlmGenerateResult>;
  embed(
    texts: string[],
    opts?: { timeoutMs?: number; jobId?: string },
  ): Promise<number[][]>;
}

export const LLM_CLIENT = Symbol("LLM_CLIENT");

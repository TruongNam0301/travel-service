import { Injectable, Logger } from "@nestjs/common";
import type {
  LlmClient,
  LlmGenerateOpts,
  LlmGenerateResult,
} from "../llm.client";
import { LlmConfig } from "../llm.config";

// Node 20 has global fetch/AbortController
type OpenAIChatResponse = {
  id: string;
  model: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  choices: {
    message: { role: "assistant" | "user" | "system"; content: string };
  }[];
};

type OpenAIEmbeddingResponse = {
  model: string;
  data: { embedding: number[] }[];
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class OpenAiClient implements LlmClient {
  private readonly log = new Logger(OpenAiClient.name);
  private readonly apiKey: string;
  private readonly chatModel: string;
  private readonly embedModel: string;
  private readonly baseUrl: string;
  private readonly defaultTimeout: number;
  private readonly maxRetries: number;
  private readonly projectId?: string;
  private readonly organizationId?: string;

  constructor(private readonly config: LlmConfig) {
    const values: import("../llm.config").LlmConfigValues = config.values;
    this.apiKey = values.apiKey;
    this.chatModel = values.chatModel;
    this.embedModel = values.embedModel;
    this.baseUrl = values.baseUrl;
    this.defaultTimeout = values.timeoutMs;
    this.maxRetries = values.maxRetries;
    this.projectId = values.projectId;
    this.organizationId = values.organizationId;
  }

  // ------------------ Public API ------------------ //

  async generate(
    prompt: string,
    opts: LlmGenerateOpts = {},
  ): Promise<LlmGenerateResult> {
    const start = Date.now();
    const timeoutMs = opts.timeoutMs ?? this.defaultTimeout;
    const model = opts.model ?? this.chatModel;
    const body = this.buildChatBody(model, prompt, opts);
    const res = await this.withRetries(
      "chat/completions",
      body,
      timeoutMs,
      opts.jobId,
    );
    const json = (await res.json()) as OpenAIChatResponse;
    const text = json.choices?.[0]?.message?.content ?? "";
    const usage = {
      input: json.usage?.prompt_tokens ?? 0,
      output: json.usage?.completion_tokens ?? 0,
      total:
        json.usage?.total_tokens ??
        (json.usage
          ? (json.usage.prompt_tokens ?? 0) +
            (json.usage.completion_tokens ?? 0)
          : 0),
    };

    const latencyMs = Date.now() - start;

    return {
      text,
      usage,
      model: json.model,
      latencyMs,
      provider: "openai",
    };
  }

  async embed(
    texts: string[],
    opts?: { timeoutMs?: number; jobId?: string },
  ): Promise<number[][]> {
    if (!texts?.length) return [];
    const timeoutMs = opts?.timeoutMs ?? this.defaultTimeout;
    const body = { model: this.embedModel, input: texts };
    const res = await this.withRetries(
      "embeddings",
      body,
      timeoutMs,
      opts?.jobId,
    );
    const json = (await res.json()) as OpenAIEmbeddingResponse;

    return json.data.map((d) => d.embedding);
  }

  // ------------------ Internal helpers ------------------ //

  private supportsTemperature(model: string): boolean {
    // Models that DO support temperature. You can extend this as needed.
    // Example: gpt-4.1, gpt-4o, mini variants etc.
    if (model.startsWith("gpt-4.1")) return true;
    if (model.startsWith("gpt-4o")) return true;
    if (model.includes("mini")) return true;
    // gpt-5.x models currently treat temperature as fixed 1.
    // If you add other providers, update this accordingly.
    return false;
  }

  private buildChatBody(
    model: string,
    prompt: string,
    opts: LlmGenerateOpts,
  ): Record<string, unknown> {
    const systemMessages = opts.system
      ? [{ role: "system", content: opts.system }]
      : [];

    const body: Record<string, unknown> = {
      model,
      messages: [...systemMessages, { role: "user", content: prompt }],
    };

    if (opts.maxTokens) {
      body.max_completion_tokens = opts.maxTokens;
    }

    if (
      this.supportsTemperature(model) &&
      typeof opts.temperature === "number"
    ) {
      body.temperature = opts.temperature;
    }

    return body;
  }

  private async withRetries(
    path: string,
    body: Record<string, unknown>,
    timeoutMs: number,
    jobId?: string,
  ): Promise<Response> {
    const baseUrlNormalized = this.baseUrl.replace(/\/+$/, "");
    const pathNormalized = path.replace(/^\/+/, "");
    const url = `${baseUrlNormalized}/${pathNormalized}`;
    let attempt = 0;
    let lastErr: Error | undefined;

    while (attempt <= this.maxRetries) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        };

        if (this.projectId) {
          headers["OpenAI-Project"] = this.projectId;
        }

        if (this.organizationId) {
          headers["OpenAI-Organization"] = this.organizationId;
        }

        const res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!res.ok) {
          const clonedRes = res.clone();
          const text = await clonedRes.text().catch(() => "");
          // Retry only on rate limit / server errors
          if (res.status === 429 || res.status >= 500) {
            lastErr = new Error(
              `OpenAI HTTP ${res.status}: ${text.substring(0, 300)}`,
            );
            throw lastErr;
          }

          // No retry for 4xx (usually client/config issue)
          const err = new Error(
            `OpenAI HTTP ${res.status}: ${text.substring(0, 300)}`,
          ) as Error & { status?: number };
          err.status = res.status;
          this.log.error({
            action: "llm.error.non_retryable",
            path,
            url,
            jobId,
            status: res.status,
            err: err.message,
          });
          throw err;
        }

        return res;
      } catch (err: unknown) {
        clearTimeout(timer);
        lastErr = err instanceof Error ? err : new Error(String(err));
        // AbortError or network errors etc.
        this.log.warn({
          action: "llm.retry",
          path,
          url,
          jobId,
          attempt,
          maxRetries: this.maxRetries,
          err: lastErr ? String(lastErr.message ?? lastErr) : "Unknown error",
        });
        if (attempt === this.maxRetries) break;
        // Simple exponential backoff: 300ms, 600ms, 1200ms, ...
        await sleep(300 * Math.pow(2, attempt));
        attempt++;
      }
    }

    this.log.error({
      action: "llm.error.final",
      path,
      url,
      jobId,
      baseUrl: this.baseUrl,
      err: String(lastErr?.message ?? lastErr),
    });
    throw lastErr ?? new Error("Unknown error");
  }
}

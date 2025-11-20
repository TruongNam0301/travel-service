import { Injectable, Logger } from "@nestjs/common";
import { LlmClient, LlmGenerateOpts, LlmGenerateResult } from "../llm.client";
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
  return new Promise((r) => setTimeout(r, ms));
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

  constructor(private readonly config: LlmConfig) {
    const values = config.values;
    this.apiKey = values.apiKey;
    this.chatModel = values.chatModel;
    this.embedModel = values.embedModel;
    this.baseUrl = values.baseUrl;
    this.defaultTimeout = values.timeoutMs;
    this.maxRetries = values.maxRetries;
  }

  async generate(
    prompt: string,
    opts: LlmGenerateOpts = {},
  ): Promise<LlmGenerateResult> {
    const start = Date.now();
    const timeoutMs = opts.timeoutMs ?? this.defaultTimeout;

    const body = {
      model: this.chatModel,
      messages: [
        ...(opts.system ? [{ role: "system", content: opts.system }] : []),
        { role: "user", content: prompt },
      ],
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? undefined,
    };

    const res = await this.#withRetries(
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

    return { text, usage, model: json.model, latencyMs, provider: "openai" };
  }

  async embed(
    texts: string[],
    opts?: { timeoutMs?: number; jobId?: string },
  ): Promise<number[][]> {
    if (!texts?.length) return [];
    const timeoutMs = opts?.timeoutMs ?? this.defaultTimeout;

    const body = { model: this.embedModel, input: texts };
    const res = await this.#withRetries(
      "embeddings",
      body,
      timeoutMs,
      opts?.jobId,
    );
    const json = (await res.json()) as OpenAIEmbeddingResponse;

    return json.data.map((d) => d.embedding);
  }

  async #withRetries(
    path: string,
    body: any,
    timeoutMs: number,
    jobId?: string,
  ): Promise<Response> {
    const baseUrlNormalized = this.baseUrl.replace(/\/+$/, "");
    const pathNormalized = path.replace(/^\/+/, "");
    const url = `${baseUrlNormalized}/${pathNormalized}`;
    let attempt = 0;
    let lastErr: any;

    while (attempt <= this.maxRetries) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      console.log("url", url);

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "OpenAI-Project": "proj_d6ISs06aV4ijmXphtvQgTxBH",
            "OpenAI-Organization": "org-GjAXjynRDHDxMG7NW0adqpf0",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        console.log("resOpenAI", res);

        clearTimeout(timer);

        if (!res.ok) {
          const clonedRes = res.clone();
          const text = await clonedRes.text().catch(() => "");
          if (res.status === 429 || res.status >= 500) {
            throw new Error(`OpenAI HTTP ${res.status}: ${text}`);
          }

          throw new Error(
            `OpenAI HTTP ${res.status}: ${text.substring(0, 200)}`,
          );
        }

        return res;
      } catch (err: any) {
        clearTimeout(timer);
        lastErr = err as Error;

        if (attempt === this.maxRetries) break;
        await sleep(300 * Math.pow(2, attempt));
        attempt++;
      }
    }

    this.log.error({
      action: "llm.error",
      path,
      url,
      jobId,
      baseUrl: this.baseUrl,
      err: String((lastErr as Error)?.message ?? lastErr),
    });
    throw lastErr;
  }
}

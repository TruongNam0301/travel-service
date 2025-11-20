import { Injectable, Logger } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { LLM_CLIENT } from "../common/services/llm/llm.client";
import type { LlmClient } from "../common/services/llm/llm.client";
import { INTENT_CLASSIFIER_PROMPT } from "../prompts/intent-classifier.prompt";

export type DetectedIntent = {
  intent: "default" | "planning" | "summarization" | "job_request";
  jobType: string | null;
};

@Injectable()
export class IntentDetectionService {
  private readonly logger = new Logger(IntentDetectionService.name);

  constructor(
    @Inject(LLM_CLIENT)
    private readonly llmClient: LlmClient,
  ) {}

  async classify(message: string): Promise<DetectedIntent> {
    const prompt = `
${INTENT_CLASSIFIER_PROMPT}

User message:

"${message}"

`;

    try {
      const result = await this.llmClient.generate(prompt, {
        model: "gpt-4o-mini", // cheap, fast
        temperature: 0,
        maxTokens: 128,
      });

      const parsed = JSON.parse(result.text.trim()) as DetectedIntent;

      // Validate intent
      if (
        !["default", "planning", "summarization", "job_request"].includes(
          parsed.intent,
        )
      ) {
        this.logger.warn({
          action: "intent.invalid_intent",
          receivedIntent: parsed.intent,
          message: message.substring(0, 50),
        });
        return { intent: "default", jobType: null };
      }

      // Validate jobType if intent is job_request
      if (parsed.intent === "job_request") {
        if (!parsed.jobType) {
          this.logger.warn({
            action: "intent.missing_job_type",
            message: message.substring(0, 50),
          });
          return { intent: "default", jobType: null };
        }
      } else {
        // Clear jobType if not job_request
        parsed.jobType = null;
      }

      return parsed;
    } catch (error) {
      this.logger.warn({
        action: "intent.classification_failed",
        error: error instanceof Error ? error.message : "Unknown error",
        message: message.substring(0, 50),
      });
      return { intent: "default", jobType: null };
    }
  }
}

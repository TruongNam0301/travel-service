import { Injectable, Logger, Inject } from "@nestjs/common";
import { LLM_CLIENT } from "../../infrastructure/llm/llm.client";
import type { LlmClient } from "../../infrastructure/llm/llm.client";
import { INTENT_CLASSIFIER_PROMPT } from "./prompts/intent-classifier.prompt";
import {
  DetectedIntentSchema,
  DEFAULT_INTENT,
  CONFIDENCE_THRESHOLD,
  type DetectedIntent,
} from "./schemas/intent.schema";

@Injectable()
export class IntentDetectionService {
  private readonly logger = new Logger(IntentDetectionService.name);

  constructor(
    @Inject(LLM_CLIENT)
    private readonly llmClient: LlmClient,
  ) {}

  /**
   * Classify user message intent using LLM
   */
  async classify(message: string): Promise<DetectedIntent> {
    const prompt = `${INTENT_CLASSIFIER_PROMPT}

User message:

"${message}"
`;

    try {
      const result = await this.llmClient.generate(prompt, {
        model: "gpt-4o-mini",
        temperature: 0,
        maxTokens: 128,
      });

      const parsed = this.parseResponse(result.text);

      if (!parsed) {
        this.logger.warn({
          action: "intent.parse_failed",
          message: message.substring(0, 50),
          rawResponse: result.text.substring(0, 200),
        });
        return DEFAULT_INTENT;
      }

      // Check confidence threshold
      if (parsed.confidence < CONFIDENCE_THRESHOLD) {
        return DEFAULT_INTENT;
      }

      this.logger.debug({
        action: "intent.classified",
        message: message.substring(0, 50),
        intent: parsed.intent,
        jobType: parsed.jobType,
        confidence: parsed.confidence,
      });

      return parsed;
    } catch (error) {
      this.logger.warn({
        action: "intent.classification_failed",
        error: error instanceof Error ? error.message : "Unknown error",
        message: message.substring(0, 50),
      });
      return DEFAULT_INTENT;
    }
  }

  /**
   * Parse and validate LLM response using Zod schema
   */
  private parseResponse(text: string): DetectedIntent | null {
    const jsonString = this.extractJson(text);

    if (!jsonString) {
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(jsonString);
      const result = DetectedIntentSchema.safeParse(parsed);

      if (result.success) {
        return result.data;
      }

      this.logger.debug({
        action: "intent.validation_failed",
        errors: result.error.issues,
        rawParsed: parsed,
      });

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Extract JSON from response, handling markdown code blocks
   */
  private extractJson(text: string): string | null {
    const trimmed = text.trim();

    // Try direct JSON parse first
    if (trimmed.startsWith("{")) {
      return trimmed;
    }

    // Extract from markdown code block
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch?.[1]) {
      return codeBlockMatch[1].trim();
    }

    // Try to find JSON object in the text
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }

    return null;
  }
}

// Re-export type for consumers
export type { DetectedIntent };

/**
 * Token Estimation Utility
 * Provides approximate token counting and text trimming functions
 * Uses approximation: ~4 characters per token for English text
 */

/**
 * Estimate token count for a given text
 * Approximation: 4 characters ≈ 1 token (for English text)
 * This is a rough estimate; actual tokenization varies by model
 */
export function estimateTokens(text: string): number {
  if (!text || text.length === 0) {
    return 0;
  }

  // Rough approximation: 4 chars per token
  // Add some overhead for whitespace and special characters
  const baseEstimate = Math.ceil(text.length / 4);

  // Adjust for whitespace (tokens often include spaces)
  const whitespaceCount = (text.match(/\s/g) || []).length;
  const adjustedEstimate = baseEstimate + Math.floor(whitespaceCount / 3);

  return Math.max(1, adjustedEstimate);
}

/**
 * Estimate tokens for multiple texts
 */
export function estimateTokensMultiple(texts: string[]): number {
  return texts.reduce((sum, text) => sum + estimateTokens(text), 0);
}

/**
 * Trim text to fit within token limit
 * Attempts to preserve word boundaries
 */
export function trimToTokenLimit(text: string, maxTokens: number): string {
  if (!text || text.length === 0) {
    return text;
  }

  const currentTokens = estimateTokens(text);
  if (currentTokens <= maxTokens) {
    return text;
  }

  // Calculate target character length (approximate)
  const targetChars = maxTokens * 4;
  let trimmed = text.slice(0, targetChars);

  // Try to end at word boundary
  const lastSpace = trimmed.lastIndexOf(" ");
  if (lastSpace > targetChars * 0.8) {
    trimmed = trimmed.slice(0, lastSpace);
  }

  // Verify we're under limit
  while (estimateTokens(trimmed) > maxTokens && trimmed.length > 0) {
    trimmed = trimmed.slice(0, -10); // Remove 10 chars at a time
    const lastSpace = trimmed.lastIndexOf(" ");
    if (lastSpace > trimmed.length * 0.8) {
      trimmed = trimmed.slice(0, lastSpace);
    }
  }

  return trimmed.trim() + (trimmed.length < text.length ? "..." : "");
}

/**
 * Trim array of texts to fit within total token budget
 * Removes items from the beginning (oldest first) until under budget
 */
export function trimTextsToTokenLimit(
  texts: string[],
  maxTokens: number,
): string[] {
  if (texts.length === 0) {
    return texts;
  }

  let totalTokens = estimateTokensMultiple(texts);
  if (totalTokens <= maxTokens) {
    return texts;
  }

  // Remove from beginning until under budget
  const result = [...texts];
  while (totalTokens > maxTokens && result.length > 0) {
    const removed = result.shift();
    if (removed) {
      totalTokens -= estimateTokens(removed);
    }
  }

  // If still over, trim the first item
  if (totalTokens > maxTokens && result.length > 0) {
    const firstItem = result[0];
    const excessTokens = totalTokens - maxTokens;
    result[0] = trimToTokenLimit(
      firstItem,
      estimateTokens(firstItem) - excessTokens,
    );
  }

  return result;
}

/**
 * Calculate token budget allocation
 * Returns suggested token limits for different context types
 */
export function calculateTokenBudget(
  totalBudget: number,
  priorities: {
    messages?: number;
    embeddings?: number;
    plan?: number;
  } = {},
): {
  messages: number;
  embeddings: number;
  plan: number;
} {
  const defaultMessages = Math.floor(totalBudget * 0.5); // 50% for messages
  const defaultEmbeddings = Math.floor(totalBudget * 0.35); // 35% for embeddings
  const defaultPlan = Math.floor(totalBudget * 0.15); // 15% for plan

  return {
    messages: priorities.messages ?? defaultMessages,
    embeddings: priorities.embeddings ?? defaultEmbeddings,
    plan: priorities.plan ?? defaultPlan,
  };
}

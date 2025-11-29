/**
 * Date Utility Functions
 * Domain-agnostic date manipulation helpers
 */

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add hours to a date
 */
export function addHours(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

/**
 * Check if a date is in the past
 */
export function isPast(date: Date): boolean {
  return date < new Date();
}

/**
 * Check if a date is in the future
 */
export function isFuture(date: Date): boolean {
  return date > new Date();
}

/**
 * Get the difference in milliseconds between two dates
 */
export function getDateDiffMs(start: Date, end: Date): number {
  return end.getTime() - start.getTime();
}

/**
 * Format date to ISO string with timezone
 */
export function toISOStringWithTimezone(date: Date): string {
  return date.toISOString();
}

/**
 * Check if a date is expired
 */
export function isExpired(expiryDate: Date): boolean {
  return isPast(expiryDate);
}

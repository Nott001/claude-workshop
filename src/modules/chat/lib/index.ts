export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX = 5;

export function isRateLimited(messageCount: number): boolean {
  return messageCount >= RATE_LIMIT_MAX;
}

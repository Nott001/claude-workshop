export const NEAR_BOTTOM_THRESHOLD = 96;

export function isNearBottom(scrollHeight: number, scrollTop: number, clientHeight: number, threshold = NEAR_BOTTOM_THRESHOLD) {
  return scrollHeight - scrollTop - clientHeight < threshold;
}

export interface CodeGate {
  /** True when the decoded token may be forwarded to the caller. */
  shouldForward(token: string): boolean;
  /** Starts a new scan session: the previous token may be scanned again. */
  reset(): void;
}

interface CodeGateOptions {
  /** Ignore a still-in-frame QR for this long after reset(), in ms. */
  cooldownMs?: number;
  now?: () => number;
}

export function createCodeGate({ cooldownMs = 600, now = Date.now }: CodeGateOptions = {}): CodeGate {
  let lastToken: string | null = null;
  let resetAt: number | null = null;

  return {
    shouldForward(token) {
      if (token !== lastToken) {
        lastToken = token;
        return true;
      }
      // Same token as the last one accepted. No reset means the same QR is
      // still in the frame — swallow it. After reset() a cooldown keeps the
      // still-in-frame QR from instantly re-opening the card; once it elapses
      // the operator can re-scan the same ticket.
      if (resetAt === null || now() < resetAt + cooldownMs) return false;
      return true;
    },
    reset() {
      resetAt = now();
    },
  };
}

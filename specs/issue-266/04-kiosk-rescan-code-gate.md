# 04 — Allow re-scanning a QR after the kiosk card is cleared

## Goal

After the operator scans a code and clicks **Done**, the next QR — including the _same_ ticket re-presented — scans normally again. Today the camera stays up but the scanner's dedupe tombstone never clears, so the still-in-frame QR is silently swallowed and re-scans look dead.

## Why

Issue #266 (bug 2). `qr-scanner.tsx` suppresses identical decodes via `lastTokenRef`, which is reset only when the camera's `active` prop flips — never when the kiosk card is cleared (`handleClear`, `kiosk-scanner-view.tsx:127`). After Done the same code (still in the frame, or re-presented) is dropped, and the operator believes the scanner is stuck. `html5-qrcode` 2.3.8 decodes continuously with no one-shot lock, so the fix is entirely on our dedupe: allow a new token instantly, re-admit the same token only after an explicit reset plus a short cooldown that stops the still-in-frame QR from instantly re-popping the card.

## Prerequisites

- Sheets 01–03 applied.

## Changes

### `src/modules/kiosk/lib/code-gate.ts` (new file, pure)

Small, single-purpose, and testable with an injected clock (AGENTS.md: assert on behavior, keep modules small):

```ts
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
```

### `src/modules/kiosk/components/qr-scanner.tsx`

- Add a `resetSignal?: number` prop.
- Replace `lastTokenRef` with a gate: `const gateRef = useRef(createCodeGate());`.
- In the decode callback, replace the `token === lastTokenRef.current` check with `if (!gateRef.current.shouldForward(token)) return;` (keep the trim/lowercase normalization and the `pausedRef` early return).
- Add an effect that resets the gate when the view clears the card:

```ts
useEffect(() => {
  if (resetSignal > 0) gateRef.current.reset();
}, [resetSignal]);
```

- In the camera-lifecycle effect's cleanup, replace `lastTokenRef.current = null` with `gateRef.current.reset()`, so a camera restart also starts a fresh scan session.

### `src/modules/kiosk/components/kiosk-scanner-view.tsx`

- Hold `const [resetSignal, setResetSignal] = useState(0);`.
- In `handleClear`, bump it: `setResetSignal((s) => s + 1);`.
- Pass `resetSignal={resetSignal}` to `QrScanner`.

## Tests

### New `test/kiosk-code-gate.test.ts` (pure, injected clock)

- forwards the first token;
- swallows the same token while it stays in frame (no reset);
- forwards a different token immediately;
- after `reset()`, swallows the same token during the cooldown window;
- after `reset()` **and** the cooldown elapsing, forwards the same token again;
- after `reset()`, forwards a different token even inside the cooldown window.

Drive the clock with a mutable `let t` captured in `now: () => t` and `t += …`.

### Extend `test/kiosk-scanner-view.test.tsx`

Refactor the `html5-qrcode` mock so tests can emit decodes: hoist `start`/`stop` and have the test pull the success callback from `start.mock.calls[0][2]`.

```ts
const { start, stop } = vi.hoisted(() => ({
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("html5-qrcode", () => ({
  Html5Qrcode: vi.fn(function (this: { start: typeof start; stop: typeof stop }) {
    this.start = start;
    this.stop = stop;
  }),
}));
```

Add a test "stays scannable after Done" (this is the _different person_ half of the report — the _same person_ half is covered by the gate unit test):

1. render + click **Start Camera Scanner**, wait for `#qr-reader-container`;
2. fire the success callback with token A → expect Jane Doe's preview;
3. click **Done** (card clears);
4. fire the success callback with token B → expect a _different_ attendee's preview, and the lookup fetched `/api/checkin/lookup?qr_token=b` — proving the camera keeps scanning after the card is cleared.

## Verification gates (run before committing this sheet)

```
pnpm test -- test/kiosk-code-gate.test.ts test/kiosk-scanner-view.test.tsx
pnpm typecheck
pnpm lint
pnpm format
```

Commit as `fix: allow re-scanning a QR after the kiosk card is cleared`. Body: the scanner's dedupe tombstone survived Done, so the still-in-frame QR and any re-scan of the same ticket were silently dropped; a reset plus cooldown now re-admits the same code while still letting a different one through instantly.

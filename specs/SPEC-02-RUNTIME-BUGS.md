# SPEC-02: Phase B — Runtime & Data Correctness (B1-B12)

Goal: Core business logic is correct, no silent failures.

---

## B1. Realtime Module Runtime Crash (P0)

**Where:** `src/lib/realtime/index.ts`

**Problems:**
- `channelCounter` is used but never declared (ReferenceError)
- `"SUPPORT_SESSIONS"` — DB table is `"SUPPORT_SESSION"`
- `"TICKETS"` — DB table is `"TICKET"`

**Fix:**

```ts
let sessionsCounter = 0;
let channelCounter = 0;  // ADD

// Then fix table names:
table: "SUPPORT_SESSION",   // was "SUPPORT_SESSIONS"
table: "TICKET",            // was "TICKETS"
```

---

## B2. `ChatChannel` Type / DB Schema Mismatch (P1)

**Where:** `src/types/index.ts`, `src/modules/chat/lib/schemas.ts`, `src/lib/db/dao/chat.dao.ts`

**Problems:**
1. `ChatChannel` includes `"global_support"` but DB enum has only `('support', 'live_qa')`
2. `ChatMessage.event_id` is `number | null` but DB is `INT NOT NULL`
3. `ChatMessage` has no `session_id` field
4. `chat.dao.ts` constant `CHANNEL = "global_support"` doesn't match DB

**Fix in `src/types/index.ts`:**

```ts
export type ChatChannel = "support" | "live_qa";
export interface ChatMessage {
  id: number;
  event_id: number;           // was number | null
  session_id: number | null;  // ADD
  // ... rest unchanged, remove read_by
}
```

Remove `CHANNEL` constant from `chat.dao.ts`. Update all code assigning `event_id: null`.

---

## B3. `chat.dao.ts` `sendSupportMessage` Violates DB NOT NULL (P1)

**Where:** `src/lib/db/dao/chat.dao.ts`

**Problem:** `sendSupportMessage` doesn't include `event_id` in the insert payload.

**Fix:** Add `event_id` parameter to the function and include it in the insert:

```ts
export async function sendSupportMessage(
  supabase: DbClient,
  data: {
    channel: string;
    event_id: number;      // ADD
    user_id: number;
    message: string;
    session_id: number;
    recipient_user_id?: number;
  },
): Promise<ChatMessage | null> { ... }
```

---

## B4. `isEventLive` Timezone Parsing Bug (P1)

**Where:** `src/lib/date-utils.ts`

**Problem:** ISO 8601 strings without timezone are parsed as UTC.

```ts
// BROKEN:
const start = new Date(`${eventDate}T${startTime}`);
```

**Fix:** Parse date components explicitly:

```ts
export function isEventLive(eventDate: string, startTime: string, endTime: string): boolean {
  const now = new Date();
  const [y, m, d] = eventDate.split("-").map(Number);
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const start = new Date(y, m - 1, d, sh, sm);
  const end = new Date(y, m - 1, d, eh, em);
  return now >= start && now <= end;
}

export function formatEventDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
```

---

## B5. Fetcher Has No Error Handling (P1)

**Where:** `src/lib/fetcher.ts`

**Fix:**

```ts
export async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error(`Request failed: ${res.status} ${res.statusText}`);
    throw error;
  }
  return res.json();
}
```

---

## B6. `SimulatedPaymentGateway` Dynamic Imports + Missing Await (P1)

**Where:** `src/modules/commerce/index.ts`

**Problems:**
1. Dynamic `await import()` inside method body
2. `fireAndForgetEmailNotification` called without `await`

**Fix:** Replace dynamic imports with static top-level imports, await the email call:

```ts
import { getServiceClient } from "@/shared/db/client";
import { paymentDao, ticketDao } from "@/shared/db/dao";
import { fireAndForgetEmailNotification } from "@/modules/notifications/lib/email";
import { generateQRDataUrl } from "@/shared/integrations/qr";
```

```ts
try {
  await fireAndForgetEmailNotification({ ... });
} catch (emailErr) {
  console.error("Failed to send ticket email (non-fatal):", emailErr);
}
```

Move class to `src/modules/commerce/lib/payment-gateway.ts`.

---

## B7. Middleware Whitelist Exposes Critical API Routes (P1)

**Where:** `src/middleware.ts`

**Problem:** `/api/events`, `/api/speakers`, `/api/storage` bypass auth.

**Fix:** Remove the exclusions. Handle public access in route handlers explicitly.

```ts
const isProtectedRoute = (pathname: string) => {
  if (pathname.startsWith("/courses") || pathname.startsWith("/kiosk") || pathname.startsWith("/organization")) return true;
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth")) return true;
  return false;
};
```

---

## B8. Event DELETE Non-Transactional Cascade (P1)

**Where:** `src/app/api/events/[id]/route.ts`

**Problem:** Storage deletes happen before DB deletes. If DB step fails, storage is already deleted.

**Fix:** Delete event DB row first (FK cascades handle related rows), then storage cleanup is best-effort:

```ts
// 1. Auth check
// 2. Collect storage paths (before deletion)
// 3. Delete event row (FK cascades handle payments, tickets)
// 4. Best-effort storage cleanup
// 5. Audit log
```

---

## B9. `upsertFromClerk` Stale Name and Empty Data (P2)

**Where:** `src/lib/db/dao/user.dao.ts`, `src/modules/auth/ensure-user.ts`

**Fix:**
1. Rename `upsertFromClerk` → `upsertUser` in `user.dao.ts`
2. `ensureUser` fetches real profile from Supabase Auth admin API before creating

---

## B10. DAO Error Handling is Silent Data Loss (P2)

**Where:** Every DAO file.

**Fix:** Log the error before returning null:

```ts
if (error) {
  if (error.code !== "PGRST116") {
    console.error(`event.dao.findById(${id}) failed:`, error.message, error.code);
  }
  return null;
}
```

Apply to all DAO files.

---

## B11. Split `chat.dao.ts` (319 → ~160 lines) (P2)

**Where:** `src/lib/db/dao/chat.dao.ts`

**Fix:** Split into two files:

1. `src/shared/db/dao/chat-message.dao.ts` — CHAT_MESSAGE queries (~160 lines)
2. `src/shared/db/dao/support-session.dao.ts` — SUPPORT_SESSION queries (~80 lines)

Move hybrid functions (`listSupportMessages`, `sendSupportMessage`) into `chat-message.dao.ts`.

---

## B12. Remove Dead Code (~50 lines) (P2)

| Code | File | Lines |
|------|------|-------|
| `const CHANNEL = "global_support"` | `chat.dao.ts` | 1 |
| `read_by: number[]` in `ChatMessage` | `types/index.ts` | 1 |
| `upsertFromClerk` → rename to `upsertUser` | `user.dao.ts` | 0 (rename) |
| `DbClient` type alias | `dao/types.ts` | 3 |
| `ensureUser` redundant `findByAuthId` | `ensure-user.ts` | 3 |
| Empty module dirs | `modules/audit/`, `modules/organization/`, `modules/support/` | ~5 |
| `landing.ts` | `lib/landing.ts` | 58 (handled in D7) |

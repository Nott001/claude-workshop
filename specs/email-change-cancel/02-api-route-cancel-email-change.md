# 02 — API route for canceling a pending email change

## Purpose

Sheet 01 gave cancel a server-side effect (`public.cancel_pending_email_change()`
deletes the caller's token rows and clears the pending fields). The browser
cannot call a PostgREST function with the session JWT through the anon client,
so the app needs its own route that authenticates and proxies the call. This
sheet adds `POST /api/auth/email/cancel` — the endpoint the client hook starts
calling in sheet 03.

## Background (current code)

- `getRouteClient()` (`src/shared/db/route-client.ts`) builds a
  `createServerClient` bound to the request cookies, so any PostgREST call it
  makes rides the logged-in user's JWT — which is what the migration's
  `auth.uid()` scope requires (the function is granted EXECUTE to
  `authenticated`, sheet 01).
- The send route (`src/app/api/auth/email/send/route.ts`) is the house
  pattern: `requireAuth()` first (401 `{ error: "Unauthenticated" }`), then the
  route client, then a JSON answer. Error replies are shaped
  `{ ok: false, error: { status, message } }` so the client's `routeError`
  helper can fold them in.
- The client already treats the route as something it may call:
  `CANCEL_ROUTE = "/api/auth/email/cancel"` exists at
  `test/use-account-settings.test.tsx:42`, and the hook's tests reference it.
- Route tests mock `@/modules/auth/lib/session` and `@/shared/db/route-client`
  via `vi.hoisted` (see `test/api-auth-email-send.test.ts`).

## Scope

- New route handler `src/app/api/auth/email/cancel/route.ts`.
- New route test `test/api-auth-email-cancel.test.ts` mirroring the send-route
  test conventions.
- No changes to the migration, the client hook, or the section component.

## Steps

### 1. Add the route

New file `src/app/api/auth/email/cancel/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getRouteClient } from "@/shared/db/route-client";

// No body: the caller's session identifies them. Idempotent by construction —
// sheet 01's helper deletes whatever token rows exist for the caller and clears
// the pending fields, so a repeat cancel is a no-op that still answers ok.
export async function POST() {
  const guard = await requireAuth();
  if (!guard) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const rb = await getRouteClient();
  const { error } = await rb.rpc("cancel_pending_email_change");
  if (error) {
    return NextResponse.json({ ok: false, error: { status: 500, message: error.message } }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

Notes:

- `requireAuth()` returns the current user or `null`; the bare
  `{ error: "Unauthenticated" }` body keeps the 401 convention the auth-error
  helper already understands.
- `rpc` is called with no arguments; the function is parameterless (sheet 01).
- Any RPC failure is answered 500 so the client's failure path (sheet 03) can
  report it instead of pretending a cancel landed. A missing function — if the
  migration has not been applied — surfaces here as `{ status: 500, message: …
}`, which beats a false `{ ok: true }`.

### 2. Add the route test

New file `test/api-auth-email-cancel.test.ts`:

```ts
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAuth, getRouteClient, routeRpc } = vi.hoisted(() => {
  const routeRpc = vi.fn();
  return {
    requireAuth: vi.fn(),
    getRouteClient: vi.fn(async () => ({ rpc: routeRpc })),
    routeRpc,
  };
});

vi.mock("@/modules/auth/lib/session", () => ({ requireAuth }));
vi.mock("@/shared/db/route-client", () => ({ getRouteClient }));

import { POST } from "@/app/api/auth/email/cancel/route";

const USER = {
  id: 1,
  role: ROLES.ATTENDEE,
  full_name: "Ada",
  email: "ada@example.com",
  profile_image_url: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  requireAuth.mockResolvedValue(USER);
  routeRpc.mockResolvedValue({ data: null, error: null });
});

describe("POST /api/auth/email/cancel", () => {
  it("refuses an anonymous caller", async () => {
    requireAuth.mockResolvedValue(null);

    const res = await POST();

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthenticated" });
    expect(routeRpc).not.toHaveBeenCalled();
  });

  it("calls the cancel helper and answers ok", async () => {
    const res = await POST();

    expect(routeRpc).toHaveBeenCalledWith("cancel_pending_email_change");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it("answers 500 when the provider RPC errors", async () => {
    routeRpc.mockResolvedValue({ data: null, error: { message: "function gone" } });

    const res = await POST();

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: { status: 500, message: "function gone" },
    });
  });

  it("answers ok again on a repeat cancel", async () => {
    expect((await POST()).status).toBe(200);
    expect((await POST()).status).toBe(200);
    expect(routeRpc).toHaveBeenCalledTimes(2);
  });
});
```

The mock object exposes only `rpc` because that is the only member the route
uses; the send-route tests expose `auth` for the same reason.

### 3. Verify

```
pnpm format && pnpm lint && pnpm typecheck
pnpm test test/api-auth-email-cancel.test.ts
```

Full suite green; coverage thresholds not lowered.

Manual gate against the live stack (uses the Sheet 01 function already applied):

1. `pnpm dev`, log in as a seeded user.
2. In the browser console: `fetch("/api/auth/email/cancel", { method: "POST" }).then(r => r.json())` →
   `{ ok: true }` even with nothing pending (idempotent).
3. From a logged-out tab the same fetch answers `401 { error: "Unauthenticated" }`.

## Commit

```
feat(auth): add cancel endpoint for a pending email change

Body: the browser cannot reach sheet 01's SECURITY DEFINER helper through the
anon data client, so POST /api/auth/email/cancel authenticates with
requireAuth and proxies the call over the session-bound route client. It has no
body, is idempotent, and answers 500 instead of a false ok when the RPC fails,
so the client can surface a failed cancel (sheet 03).
```

## Definition of done

- `POST /api/auth/email/cancel` exists, returns 401 to anonymous callers, calls
  `cancel_pending_email_change` for the logged-in caller, and answers
  `{ ok: true }` on success, 500 `{ ok: false, error: { status, message } }` on
  RPC error.
- Route tests cover anonymous rejection, success, RPC failure, and a repeat
  cancel.

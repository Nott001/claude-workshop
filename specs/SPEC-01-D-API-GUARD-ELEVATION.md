# SPEC-01-D — API Guard Elevation

Prerequisites: SPEC-01-C
After this: SPEC-01-E

> **As built.** The four changes landed as written. Verification below is stale
> on one point: a signed-in caller who merely lacks the role gets **403**, not 401. `guardFailure` has answered that way since `bb4d6d4`, and it is correct
> per RFC 9110 — 401 means unauthenticated. Commit `6cb89be` fixed the E2E specs
> that asserted 401 here. Expect 403 for every "with a `facilitator` token" case.

## Scope

4 files. Each change is a single-argument change to `requireRole()` inside an
API route handler.

## Rationale

SPEC-01-B and SPEC-01-C added page-level guards, but the APIs behind those
pages still accept `facilitator` role. A caller who bypasses the UI (curl,
Postman, another client) can still access these endpoints. This spec locks the
server-side to match the page guards.

## Changes

### 1. `src/app/api/events/route.ts` — POST handler (line 23)

```ts
// Before:
const guard = await requireRole("facilitator");
// After:
const guard = await requireRole("admin");
```

The `GET` handler stays at `attendee` — reading the event list is public for
authenticated users. Only event creation moves to `admin`.

### 2. `src/app/api/organization/route.ts` — GET handler (line 18)

```ts
// Before:
const guard = await requireRole("facilitator");
// After:
const guard = await requireRole("admin");
```

The `POST` handler stays at `admin` — it already requires admin, and
super_admin is the only role that can invite admins.

### 3. `src/app/api/audit-logs/route.ts` — GET handler (line 7)

```ts
// Before:
const guard = await requireRole("facilitator");
// After:
const guard = await requireRole("admin");
```

### 4. `src/app/api/logs/route.ts` — GET handler (line 8)

```ts
// Before:
const guard = await requireRole("facilitator");
// After:
const guard = await requireRole("admin");
```

## Verification

- `POST /api/events` with a `facilitator` token → 401.
- `GET /api/organization` with a `facilitator` token → 401.
- `GET /api/audit-logs` with a `facilitator` token → 401.
- `GET /api/logs` with a `facilitator` token → 401.
- All four endpoints with an `admin` token → 200.

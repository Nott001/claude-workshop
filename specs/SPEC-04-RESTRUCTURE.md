# SPEC-04: Phase D — File Moves + Restructure (D1-D8)

Goal: Source matches the target directory structure.

Execute all moves in a single pass. Update every import path across the codebase when moving.

---

## D1. Domain Components → `modules/*/components/`

| Current | New |
|---------|-----|
| `src/components/attendees-panel.tsx` | `src/modules/events/components/attendees-panel.tsx` |
| `src/components/countdown-timer.tsx` | `src/modules/events/components/countdown-timer.tsx` |
| `src/components/event-card.tsx` | `src/modules/events/components/event-card.tsx` |
| `src/components/event-session-navbar.tsx` | `src/modules/events/components/event-session-navbar.tsx` |
| `src/components/status-badge.tsx` | `src/modules/events/components/status-badge.tsx` |
| `src/components/auth-layout.tsx` | `src/modules/auth/components/auth-layout.tsx` |
| `src/components/post-login-redirect.tsx` | `src/modules/auth/components/post-login-redirect.tsx` |
| `src/components/chat-panel.tsx` | `src/modules/chat/components/chat-panel.tsx` |
| `src/components/qa-panel.tsx` | `src/modules/chat/components/qa-panel.tsx` |
| `src/components/lesson-viewer.tsx` | `src/modules/courses/components/lesson-viewer.tsx` |
| `src/components/youtube-player.tsx` | `src/modules/courses/components/youtube-player.tsx` |
| `src/components/qr-scanner.tsx` | `src/modules/kiosk/components/qr-scanner.tsx` |
| `src/components/floating-assist-button.tsx` | `src/modules/support/components/floating-assist-button.tsx` |
| `src/components/global-support-chat.tsx` | `src/modules/support/components/global-support-chat.tsx` |

---

## D2. Domain Hooks/Logic → `modules/*/lib/`

| Current | New |
|---------|-----|
| `src/modules/auth/session-context.tsx` | `src/modules/auth/components/session-context.tsx` |
| `src/modules/auth/ensure-user.ts` | `src/modules/auth/lib/ensure-user.ts` |
| `src/modules/auth/role-guard.ts` | `src/modules/auth/lib/role-guard.ts` |
| `src/modules/auth/session.ts` | `src/modules/auth/lib/session.ts` |
| `src/modules/auth/types.ts` | `src/modules/auth/lib/types.ts` |
| `src/modules/event-management/index.ts` | `src/modules/events/lib/schemas.ts` |
| `src/modules/event-management/lib/use-*.ts` | `src/modules/events/lib/use-*.ts` |
| `src/modules/commerce/index.ts` (schemas) | `src/modules/commerce/lib/schemas.ts` |
| `src/modules/commerce/index.ts` (gateway) | `src/modules/commerce/lib/payment-gateway.ts` |
| `src/modules/course-content/lib/use-*.ts` | `src/modules/courses/lib/use-*.ts` |
| `src/modules/notifications/email.ts` | `src/modules/notifications/lib/email.ts` |

---

## D3. Shared Infrastructure → `shared/`

| Current | New |
|---------|-----|
| `src/lib/db/index.ts` | `src/shared/db/client.ts` |
| `src/lib/db/dao/*.ts` | `src/shared/db/dao/*.ts` |
| `src/lib/email/index.ts` | `src/shared/integrations/email/index.ts` |
| `src/lib/storage/index.ts` | `src/shared/integrations/storage/index.ts` |
| `src/lib/qr/index.ts` | `src/shared/integrations/qr/index.ts` |
| `src/lib/realtime/index.ts` | `src/shared/integrations/realtime/index.ts` |
| `src/lib/date-utils.ts` | `src/shared/lib/date-utils.ts` |
| `src/lib/fetcher.ts` | `src/shared/lib/fetcher.ts` |
| `src/lib/utils.ts` | `src/shared/lib/utils.ts` |
| `src/lib/landing.ts` | `src/shared/lib/landing.ts` |
| `src/types/index.ts` | `src/shared/types/index.ts` |
| `src/components/app-shell.tsx` | `src/shared/components/app-shell.tsx` |
| `src/components/navbar.tsx` | `src/shared/components/navbar.tsx` |
| `src/components/footer.tsx` | `src/shared/components/footer.tsx` |
| `src/components/toast.tsx` | `src/shared/components/toast.tsx` |
| `src/components/ui/*.tsx` | `src/shared/components/ui/*.tsx` |

---

## D4. Test Files → Root `test/`

Move `src/test/*.ts` → `test/*.ts`.

Update `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["test/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
```

---

## D5. Delete Stale Directories

After all moves are complete:

- `src/components/`
- `src/lib/`
- `src/types/`
- `src/test/`
- `src/hooks/` (already empty)
- `src/modules/auth/` (flat files → `components/` and `lib/`)
- `src/modules/event-management/` → now `events/`
- `src/modules/course-content/` → now `courses/`

---

## D6. Don't Create Planned `modules/*/ui/` Directories (~500 lines prevented)

Instead of creating 15+ UI component files, use inline fallbacks in each page:

| Page | Fallback Strategy |
|------|-------------------|
| `src/app/page.tsx` | Inline hero section from `home/page.tsx` |
| `src/app/events/[id]/page.tsx` | Inline event detail from `useEventDetail` |
| `src/app/events/[id]/room/page.tsx` | Inline no-curriculum state |
| `src/app/events/new/page.tsx` | Inline basic form using `eventSchema` |
| `src/app/events/[id]/edit/page.tsx` | Same inline form |
| `src/app/sign-in/[[...sign-in]]/page.tsx` | Inline Supabase auth link |
| `src/app/sign-up/[[...sign-up]]/page.tsx` | Inline Supabase auth link |
| `src/app/courses/[id]/page.tsx` | Inline stub |
| `src/app/kiosk/page.tsx` | Inline stub wrapping `useKiosk` |
| `src/app/speakers/dashboard/page.tsx` | Inline stub |
| `src/app/support/page.tsx` | Inline stub |
| `src/app/organization/page.tsx` | Inline stub |
| `src/app/user/[[...rest]]/page.tsx` | Inline stub |

---

## D7. Inline `landing.ts` (58 → 0 lines)

- Move `eventStatusLabel` into `src/shared/lib/date-utils.ts`
- Move `accentClass` into `src/modules/events/components/event-card.tsx`
- Delete `landing.ts`
- Inline `getUpcomingEvents` call into `src/app/page.tsx` using `getServiceClient` + `eventDao`

---

## D8. Merge Tiny Hook Files (~40 lines saved)

| File | Lines | Action |
|------|-------|--------|
| `use-upcoming-events.ts` | 13 | Inline `useSWR` call into `src/app/home/page.tsx` |
| `use-speaker-events.ts` | ~20 | Inline into `src/app/api/speakers/me/events/route.ts` |
| `use-speaker-event.ts` | ~20 | Inline into route handler |
| `use-event-timer.ts` | ~40 | Merge into `use-room-access.ts` |

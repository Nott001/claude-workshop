# SPEC-05: Phase E — LoC Reduction (E1-E4)

Goal: -2,000 lines from `src/` via shared hooks, UI primitives, DAO helpers, hook consolidation.

---

## E1. Shared Chat Hooks (~200 lines saved)

Three chat components duplicate identical SWR polling, idle timer, and optimistic message logic:

- `chat-panel.tsx` (183 → ~90)
- `qa-panel.tsx` (426 → ~250)
- `global-support-chat.tsx` (263 → ~180)

### Extract `useChatPolling` at `src/shared/lib/use-chat-polling.ts`

```ts
"use client";
import { useEffect, useRef } from "react";
import useSWR from "swr";
import { fetcher } from "./fetcher";

export function useChatPolling(url: string) {
  const pollIntervalRef = useRef(5000);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const prevLastMsgRef = useRef(0);

  function setActive() {
    pollIntervalRef.current = 2000;
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => { pollIntervalRef.current = 5000; }, 30000);
  }

  const { data, isLoading } = useSWR(url, fetcher, {
    refreshInterval: () => pollIntervalRef.current,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    keepPreviousData: true,
  });

  useEffect(() => {
    if (data?.messages?.length) {
      const last = data.messages[data.messages.length - 1];
      if (last.id !== prevLastMsgRef.current) { prevLastMsgRef.current = last.id; setActive(); }
    }
  }, [data]);

  return { data, isLoading, setActive };
}
```

### Extract `useOptimisticMessages` at `src/shared/lib/use-optimistic-messages.ts`

```ts
"use client";
import { useState, useMemo } from "react";

export function useOptimisticMessages<T extends { id: number }>(serverMessages: T[]) {
  const [pending, setPending] = useState<T[]>([]);

  const all = useMemo(() => {
    const merged = [...serverMessages];
    for (const p of pending) {
      if (!merged.some(m => m.id === p.id)) merged.push(p);
    }
    return merged;
  }, [serverMessages, pending]);

  function addOptimistic(msg: T) { setPending(prev => [...prev, msg]); }
  function resolveOptimistic(id: number) { setPending(prev => prev.filter(m => m.id !== id)); }

  return { all, pending, addOptimistic, resolveOptimistic };
}
```

### Update each chat component to use hooks:

- `chat-panel.tsx`: Replace inline polling/optimistic state with hook calls
- `qa-panel.tsx`: Same pattern
- `global-support-chat.tsx`: Same pattern

---

## E2. Shared UI Primitives (~250 lines saved)

### Enhanced `Button` (`src/shared/components/ui/button.tsx`)

```tsx
type Variant = "primary" | "secondary" | "ghost" | "danger" | "brand";
type Size = "sm" | "md" | "lg";

const variantStyles: Record<Variant, string> = {
  primary: "bg-foreground text-bg hover:bg-foreground/80",
  secondary: "border border-border bg-surface text-fg hover:bg-muted",
  ghost: "text-muted-fg hover:text-fg",
  danger: "border border-error/30 text-error hover:bg-error/10",
  brand: "bg-brand text-white hover:bg-brand/80",
};

const sizeStyles: Record<Size, string> = {
  sm: "px-2.5 py-1 text-[10px] font-bold rounded-lg",
  md: "px-4 py-2 text-sm font-semibold rounded-lg",
  lg: "px-6 py-3 text-base font-semibold rounded-xl",
};

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variantStyles[variant], sizeStyles[size], className,
      )}
      {...props}
    />
  );
}
```

### Create `Badge` (`src/shared/components/ui/badge.tsx`)

```tsx
type BadgeVariant = "default" | "success" | "warning" | "error" | "info";

const badgeStyles: Record<BadgeVariant, string> = {
  default: "bg-muted text-muted-fg",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  error: "bg-error/10 text-error",
  info: "bg-info/10 text-info",
};

export function Badge({ variant = "default", children }: { variant?: BadgeVariant; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", badgeStyles[variant])}>
      {children}
    </span>
  );
}
```

### Create `Avatar` (`src/shared/components/ui/avatar.tsx`)

```tsx
export function Avatar({ size = "sm", className }: { size?: "sm" | "md"; className?: string }) {
  const sizeClass = size === "sm" ? "size-6 text-xs" : "size-10 text-base";
  return (
    <div className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted", sizeClass, className)}>
      <span className="material-symbols-rounded text-muted-fg">person</span>
    </div>
  );
}
```

### Savings by component

| Component | Inline lines replaced | Lines saved |
|-----------|----------------------|-------------|
| `qa-panel.tsx` | 8 button variants → 10 `<Button>` calls | -90 |
| `attendees-panel.tsx` | Inline buttons/badges | -30 |
| `navbar.tsx` | Button/avatar patterns | -20 |
| `event-card.tsx` | Badge/button patterns | -30 |
| Other components | Various patterns | -80 |
| **Total** | | **-250** |

---

## E3. DAO Helper Consolidation (~150 lines saved)

### Create `src/shared/db/dao/helpers.ts`

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export async function findById<T>(supabase: SupabaseClient, table: string, id: number): Promise<T | null> {
  const { data } = await supabase.from(table).select("*").eq("id", id).single();
  return data as T | null;
}

export async function exists(supabase: SupabaseClient, table: string, id: number): Promise<boolean> {
  const { data } = await supabase.from(table).select("id", { head: true }).eq("id", id).single();
  return !!data;
}

export async function findByField<T>(supabase: SupabaseClient, table: string, field: string, value: unknown, select = "*"): Promise<T | null> {
  const { data } = await supabase.from(table).select(select).eq(field, value).single();
  return data as T | null;
}

export async function deleteById(supabase: SupabaseClient, table: string, id: number): Promise<boolean> {
  const { error } = await supabase.from(table).delete().eq("id", id);
  return !error;
}
```

### Estimated savings per DAO file

| File | Before | After | Saved |
|------|--------|-------|-------|
| `event.dao.ts` | 121 | ~70 | -50 |
| `user.dao.ts` | 104 | ~60 | -44 |
| `payment.dao.ts` | 101 | ~55 | -46 |
| `ticket.dao.ts` | 140 | ~90 | -50 |
| `course.dao.ts` | 151 | ~100 | -51 |
| **Total** | | | **-150** |

---

## E4. Consolidate Event Fetch Hooks (~150 lines saved)

`use-event-detail.ts` (188 lines) and `use-room-access.ts` (188 lines) independently duplicate event fetch, ticket check, speaker assignment check, and facilitator status logic.

### Extract `src/modules/events/lib/fetch-event-data.ts`

```ts
export interface EventAccessData {
  event: EventDetail | null;
  hasTicket: boolean;
  isSpeakerAssigned: boolean;
  speakerProfileId: number | null;
  userId: number;
  userRole: string;
}

export async function fetchEventAccess(eventId: string, user: AuthUser): Promise<EventAccessData> {
  const [eventRes, ticketRes, speakerRes] = await Promise.all([
    fetch(`/api/events/${eventId}`),
    fetch("/api/tickets"),
    user.role === "speaker" ? fetch("/api/speakers/me").then(r => r.ok ? r.json() : null) : Promise.resolve(null),
  ]);

  const event = eventRes.ok ? await eventRes.json() : null;
  const tickets = ticketRes.ok ? await ticketRes.json() : [];
  const hasTicket = tickets.some((t: any) => t.event_id === Number(eventId) && t.status !== "cancelled");
  const speakerProfileId = speakerRes?.id ?? null;
  const isSpeakerAssigned = speakerProfileId && event?.EVENT_SPEAKERS?.some(
    (es: any) => es.SPEAKER_PROFILES.id === speakerProfileId
  );

  return { event, hasTicket, isSpeakerAssigned, speakerProfileId, userId: user.id, userRole: user.role };
}
```

### Update consumers:

- `use-event-detail.ts` (188 → ~80): Remove inline fetch, call `fetchEventAccess`, keep UI-specific state
- `use-room-access.ts` (188 → ~120): Remove duplicate fetch, call `fetchEventAccess`, keep room-specific state

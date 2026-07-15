# Removing the Debug Menu

The debug menu is a temporary testing tool that bypasses authentication and role checks. Follow these steps to remove it completely.

## Files to delete

- `components/debug-menu.tsx`

## Files to edit

### `app/layout.tsx`

Remove the import and usage:

```diff
- import { DebugMenu } from "@/components/debug-menu";
```

```diff
  <body className="flex min-h-full flex-col">
    {children}
-   <DebugMenu />
  </body>
```

### `middleware.ts`

Remove the debug bypass block:

```diff
- // DEBUG: Bypass auth when debug_mode cookie is set
- const debugMode = req.cookies.get("debug_mode")?.value === "true";
- if (debugMode) {
-   return NextResponse.next();
- }
```

Also remove the `NextResponse` import if no longer used.

### `lib/auth/role-guard.ts`

Remove the debug bypass block (lines 10-22):

```diff
  export async function requireRole(...allowedRoles: UserRole[]): Promise<RoleGuardResult> {
-   // DEBUG: Bypass role check when debug_mode cookie is set
-   try {
-     const { cookies } = await import("next/headers");
-     const cookieStore = await cookies();
-     const debugMode = cookieStore.get("debug_mode")?.value === "true";
-     if (debugMode) {
-       return {
-         allowed: true,
-         error: null,
-         user: { role: allowedRoles[0] },
-       };
-     }
-   } catch {
-     // cookies() not available in test environment
-   }
-
    const { userId } = await auth();
```

## Verification

After removal:
1. Run `pnpm lint` — should have no new errors
2. Run `pnpm test` — all tests should pass
3. The amber "D" button should no longer appear on any page

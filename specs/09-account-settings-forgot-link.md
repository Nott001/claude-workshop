# 09 — Account settings: a "Forgot Password?" link

## Goal

Let a signed-in user reach the reset flow from Account Settings' password section, so a person who has forgotten the password they use in the settings form can leave for the reset screen instead of being stuck.

## Where

- `src/modules/user/components/password-section.tsx`
- `test/password-section.test.tsx`
- `test/account-settings.test.tsx`

## Why

The password change in Account Settings asks for the current password (`src/modules/user/lib/use-account-settings.ts` proves it via a throwaway sign-in), so a user who forgot it cannot change it there and has no path to the reset flow short of signing out and hunting through the sign-in screen. The sign-in form already exposes the same link (`sign-in-form.tsx:68-77`) — this sheet repeats that affordance inside the settings form.

## Steps

1. In `password-section.tsx`:

   a) Import the link:

   ```ts
   import Link from "next/link";
   ```

   b) Put the heading and the link on one row, copying the sign-in form's layout:

   ```tsx
   <div className="flex items-center justify-between gap-2">
     <h2 className="text-sm font-bold text-fg">Password</h2>
     {/* A forgotten password cannot be typed into the field below, so the
         reset flow is offered here rather than only on the sign-in screen. */}
     <Link
       href="/forgot-password"
       prefetch={false}
       className="text-sm font-medium tracking-wider text-brand transition-colors hover:text-brand/80"
     >
       Forgot Password?
     </Link>
   </div>
   <FormField className="mt-4">
     ...
   ```

   The section is inside an authenticated page, so a plain `/forgot-password` href (no `?from=` back-origin) is correct — the reset screen is a public route and its own shell handles navigation.

2. In `test/password-section.test.tsx`, add a presence test:

   ```tsx
   it("offers the reset flow from the password heading", () => {
     renderSection();

     const link = screen.getByRole("link", { name: "Forgot Password?" });
     expect(link.getAttribute("href")).toBe("/forgot-password");
   });
   ```

3. In `test/account-settings.test.tsx`, add the same assertion at the page level, next to the existing "renders the core account sections" test:

   ```tsx
   it("links the password section to the reset flow", () => {
     hooks.useAccountSettings.mockReturnValue(settings({ isSpeaker: false }));

     render(<AccountSettings />);

     const link = screen.getByRole("link", { name: "Forgot Password?" });
     expect(link.getAttribute("href")).toBe("/forgot-password");
   });
   ```

## Definition of done

- The Password heading row in Account Settings carries a "Forgot Password?" link to `/forgot-password`.
- Both components tests and the page test assert the link's label and href.
- `pnpm test password-section account-settings` is green.

## Verify

```sh
pnpm test password-section account-settings
```

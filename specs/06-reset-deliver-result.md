# 06 — Reset lib: deliver reports its result

## Goal

Give `preparePasswordReset`'s `ready` outcome a `deliver` that returns the provider's verdict instead of swallowing it, and add `"delivery_failed"` to the wire union the route and form share.

## Where

- `src/modules/auth/lib/password-reset.ts`
- `test/password-reset.test.ts`

## Why

The route answers `"sent"` without knowing whether mail left the isolate (`recover/route.ts:47`), so every unconfigured or failing transport still reads as success. The fix is to await delivery — but `deliver` currently returns `void` and logs failures nobody is listening for (`password-reset.ts:109-116`). This sheet makes the result travel: the ready outcome also exposes the minted `resetUrl`, which sheet 07 needs to relay to the browser in dev-only fallback.

## Steps

1. In `password-reset.ts`:

   a) Widen the ready outcome to carry the URL and a resolving delivery:

   ```ts
   export type ResetOutcome =
     | { status: "ready"; deliver: () => Promise<{ success: boolean; error?: string }>; resetUrl: string }
     | { status: "unknown_email" }
     | { status: "rate_limited" }
     | { status: "failed" };
   ```

   b) Add the status to the shared wire union:

   ```ts
   export type RecoverStatus = Exclude<ResetOutcome["status"], "ready"> | "sent" | "delivery_failed" | "invalid_request";
   ```

   c) Return the send result and turn a throw into a failure verdict (the caller now awaits this, so it must not throw):

   ```ts
   return {
     status: "ready",
     resetUrl,
     deliver: async () => {
       try {
         return await sendTemplatedEmail(passwordResetTemplate, { name, resetUrl }, { email, name });
       } catch (err) {
         // The caller answers the browser with this verdict, so a rejecting
         // send must be reported, not swallowed.
         console.error("Password reset email failed:", err);
         return { success: false, error: err instanceof Error ? err.message : String(err) };
       }
     },
   };
   ```

2. In `test/password-reset.test.ts`:

   a) Replace "swallows a send failure, which happens after the caller has been answered" (lines 118-122) — delivery now keeps the failure to hand back:

   ```ts
   it("hands a rejecting send back to the caller as a failure", async () => {
     sendTemplatedEmail.mockRejectedValue(new Error("smtp down"));

     const outcome = await preparePasswordReset(supabase, EMAIL, null);

     expect(outcome.status).toBe("ready");
     if (outcome.status === "ready") {
       await expect(outcome.deliver()).resolves.toMatchObject({ success: false, error: "smtp down" });
     }
   });
   ```

   b) Add a test that the provider's verdict is relayed unchanged:

   ```ts
   it("hands the provider's verdict back to the caller", async () => {
     sendTemplatedEmail.mockResolvedValue({ success: false, error: "550 mailbox unavailable" });

     const outcome = await preparePasswordReset(supabase, EMAIL, null);

     expect(outcome.status).toBe("ready");
     if (outcome.status === "ready") {
       await expect(outcome.deliver()).resolves.toEqual({ success: false, error: "550 mailbox unavailable" });
     }
   });
   ```

   c) Add a test that the ready outcome carries the minted URL:

   ```ts
   it("exposes the minted URL for the caller to relay", async () => {
     const outcome = await preparePasswordReset(supabase, EMAIL, null);

     expect(outcome.status).toBe("ready");
     if (outcome.status === "ready") {
       expect(outcome.resetUrl).toContain("/reset-password?token=");
       expect(outcome.resetUrl).toContain(TOKEN);
     }
   });
   ```

The remaining tests are unaffected: `prepareAndDeliver` awaits the still-promise-shaped `deliver`, and nothing else depends on its former `void` type.

## Definition of done

- `ResetOutcome["ready"]` carries `resetUrl` and a `deliver` that resolves the send result.
- `RecoverStatus` includes `delivery_failed`, imported by both route and form.
- `pnpm test password-reset` is green.

## Verify

```sh
pnpm test password-reset
```

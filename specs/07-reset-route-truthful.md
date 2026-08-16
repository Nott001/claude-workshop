# 07 — Reset route: await delivery and report honestly

## Goal

Make `POST /api/auth/recover` answer `"sent"` only when delivery genuinely succeeded, report a new `"delivery_failed"` status otherwise, and — when the provider is the dev console fallback — return the minted URL so the browser can still complete the flow.

## Where

- `src/app/api/auth/recover/route.ts`
- `test/api-password-reset.test.ts`

## Why

The route fires delivery through `afterResponse` and answers `"sent"` regardless (`route.ts:45/47`), so an unconfigured mailbox still reads as success. Delivery now resolves a verdict (sheet 06), and the awaited send path matches the invite and email-change routes. Deferral was introduced to hide the registration-timing oracle (`8188907`); that is already moot because the body distinguishes `unknown_email` from `sent` (`cb40da3`), so nothing is leaked by awaiting that was not already in the reply. The `devResetUrl` is a fallback only for the console provider: with a capture box configured (sheets 02-05) the mail is really in inbucket, and no token is ever put in a production response.

## Steps

1. In `route.ts`:

   a) Swap the `afterResponse` import for the seam verdict:

   ```ts
   import { emailDeliveryIsLocal } from "@/shared/integrations/email";
   ```

   (Drop `import { afterResponse } from "@/shared/lib/after-response";`.)

   b) Replace the deferred block:

   ```ts
   // Awaited, not deferred: the reply now tells the visitor whether the mail
   // went out, which is a fact only the send knows. Deferral once hid the
   // registration-timing oracle, but the body already distinguishes unknown
   // from sent, so nothing awaits adds that the reply does not already say.
   const result = await outcome.deliver();
   if (!result.success) {
     console.error("Password reset delivery failed:", result.error);
     return answer("delivery_failed");
   }

   // The console provider (dev, no capture box configured) mailed no one, so
   // the link is handed back for the form to show instead.
   return answer("sent", emailDeliveryIsLocal() ? { devResetUrl: outcome.resetUrl } : {});
   ```

   c) Extend `answer` to accept extra fields:

   ```ts
   function answer(status: RecoverStatus, extra: Record<string, string> = {}): NextResponse {
     return NextResponse.json({ status, ...extra });
   }
   ```

   d) Update the report-style comment above `answer` if it says otherwise; the route's top comment stays accurate.

2. In `test/api-password-reset.test.ts`:

   a) Drop the `afterResponse` hoisted mock and its `vi.mock("@/shared/lib/after-response", …)`, and the `afterResponse.mockImplementation(...)` line in `beforeEach`. Mock the new seam instead:

   ```ts
   const { emailDeliveryIsLocal } = vi.hoisted(() => ({ emailDeliveryIsLocal: vi.fn() }));
   vi.mock("@/shared/integrations/email", () => ({ emailDeliveryIsLocal }));
   ```

   b) Make the mocked `deliver` resolve a verdict and give `preparePasswordReset` a URL. In the globals and `beforeEach`:

   ```ts
   const deliver = vi.fn();
   const RESET_URL = `https://startuplab.center/reset-password?token=${TOKEN}`;
   ...
   beforeEach(() => {
     ...
     deliver.mockResolvedValue({ success: true });
     preparePasswordReset.mockResolvedValue({ status: "ready", deliver, resetUrl: RESET_URL });
     emailDeliveryIsLocal.mockReturnValue(false);
     ...
   });
   ```

   c) Replace "hands the mail to afterResponse rather than awaiting it" (lines 133-143) with the awaited contract on success and its failure counterpart:

   ```ts
   it("awaits delivery and reports a send only when it landed", async () => {
     const res = await recover(jsonReq({ email: "ada@example.com" }));

     expect(deliver).toHaveBeenCalledTimes(1);
     expect(res.status).toBe(200);
     expect(await res.json()).toEqual({ status: "sent" });
   });

   it("reports delivery_failed when the mail did not land", async () => {
     deliver.mockResolvedValue({ success: false, error: "550 mailbox unavailable" });

     const res = await recover(jsonReq({ email: "ada@example.com" }));

     expect(res.status).toBe(200);
     expect(await res.json()).toEqual({ status: "delivery_failed" });
   });
   ```

   d) Add a dev-fallback test and a no-URL-in-prod test:

   ```ts
   it("hands the reset URL back only when delivery is the dev console", async () => {
     emailDeliveryIsLocal.mockReturnValue(true);

     const res = await recover(jsonReq({ email: "ada@example.com" }));

     expect(await res.json()).toEqual({ status: "sent", devResetUrl: RESET_URL });
   });

   it("never puts the reset URL in a production reply", async () => {
     const res = await recover(jsonReq({ email: "ada@example.com" }));

     const body = (await res.json()) as Record<string, unknown>;
     expect(body.devResetUrl).toBeUndefined();
   });
   ```

   The remaining tests (`unknown_email`, `rate_limited`, `failed`, invalid-request, no-mail-for-unknown-address) are unchanged.

## Definition of done

- The route awaits `deliver`; a failing send answers `delivery_failed`, a succeeding one `sent`.
- The reply carries `devResetUrl` only when `emailDeliveryIsLocal()` is true.
- No `afterResponse` import remains in the route (the helper is still used by checkin/resend-ticket/fulfillment).
- `pnpm test api-password-reset` is green.

## Verify

```sh
pnpm test api-password-reset
```

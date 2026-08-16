# 05 — Email service: pick the provider by config, not runtime

## Goal

Let the email seam choose a _real_ SMTP provider in `next dev` when the config points at a local capture box, and expose one seam verdict the reset route can read later: "delivery is local (console)". Everything else keeps its current behaviour.

## Where

- `src/shared/integrations/email/index.ts` — `createDefaultProvider`
- `test/email-integration.test.ts`

## Why

Provider selection (`index.ts:20-25`) is keyed only on `isWorkerdRuntime()`: off workerd it always returns `ConsoleEmailProvider`, so even a perfectly configured local capture box could never receive mail under `pnpm dev`. The decision should follow the config like the rest of the industry: workerd uses the cloudflare socket for any configured host; `next dev` uses the Node connector **only when the host is loopback** — that guard is what stops a dev machine from ever accidentally mailing a real relay with its own credentials. Missing config still degrades exactly as before: console off-workerd, a refusing `UnconfiguredEmailProvider` on workerd.

## Steps

1. In `index.ts`, replace `createDefaultProvider`:

   ```ts
   export function createDefaultProvider(): EmailProvider {
     const config = readSmtpConfig();

     // The Worker opens the cloudflare:sockets connection for whatever host is
     // configured. `next dev` has no such socket, so it only dials a local
     // capture box — a loopback guard is what keeps dev credentials from ever
     // reaching a real relay by accident.
     if (config && isWorkerdRuntime()) return new SmtpEmailProvider(config);
     if (config && isLoopbackHost(config.host)) return new SmtpEmailProvider(config, connectSmtpNode);

     return isWorkerdRuntime() ? new UnconfiguredEmailProvider() : new ConsoleEmailProvider();
   }
   ```

   Update the imports: `readSmtpConfig` already comes in; add `isLoopbackHost` to that import and import `connectSmtpNode` from `./providers/smtp/node-socket`. The import is static, so the workerd bundle carries the module too — but only as dead code: its entry never runs on workerd, and `node:net`/`node:tls`/`node:stream` exist under `nodejs_compat` merely to load. Sheet 11's `pnpm cf:preview` confirms the isolate still boots with it bundled.

2. Add the console-verdict seam, used by the reset route in sheet 07:

   ```ts
   /** True only for the dev fallback that logs instead of sending. */
   export function emailDeliveryIsLocal(): boolean {
     return getEmailService() instanceof ConsoleEmailProvider;
   }
   ```

3. Update the header comment on `createDefaultProvider` (the one reading "Missing credentials mean opposite things on the two runtimes…") to note the loopback-only dev SMTP path.

4. In `test/email-integration.test.ts`:

   a) Rework the existing test "still logs off-workerd even with credentials, since no socket exists" (lines 94-102) — the assertion still lands on `ConsoleEmailProvider`, but the reason is now the host, not the runtime:

   ```ts
   // A remote host off workerd must not be dialled from a dev machine: the
   // credentials would mail a real relay. Only a loopback capture box is SMTP'd.
   it("keeps logging off-workerd when the configured host is remote", () => {
     process.env.SMTP_HOST = "mail.startuplab.center";
     process.env.SMTP_USER = "no-reply@startuplab.center";
     process.env.SMTP_PASSWORD = "s3cret";

     expect(createDefaultProvider()).toBeInstanceOf(ConsoleEmailProvider);
   });
   ```

   b) Add a test that dev dials the capture box:

   ```ts
   it("speaks SMTP in dev when the config points at a local capture box", () => {
     process.env.SMTP_HOST = "127.0.0.1";
     process.env.SMTP_PORT = "54325";
     process.env.SMTP_USER = "inbucket";
     process.env.SMTP_PASSWORD = "inbucket";

     expect(createDefaultProvider()).toBeInstanceOf(SmtpEmailProvider);
   });
   ```

   c) Add a test for the verdict:

   ```ts
   it("reports console delivery as local and SMTP delivery as not", () => {
     resetEmailService();
     expect(emailDeliveryIsLocal()).toBe(true);
     configureEmailService(new SmtpEmailProvider(readSmtpConfig(COMPLETE)!));
     expect(emailDeliveryIsLocal()).toBe(false);
   });
   ```

   That needs `readSmtpConfig` imported and a `COMPLETE` env map in the test — reuse the SMTP env triple already used in the file's describe block (move it to a module-level `const COMPLETE` if it is not already shared).

The two workerd tests ("refuses to send on workerd when no mailbox is configured", "speaks SMTP on workerd once the mailbox is configured") are unchanged.

## Definition of done

- Off-workerd with a loopback SMTP host, the seam returns `SmtpEmailProvider`; with a remote host it returns `ConsoleEmailProvider`.
- On workerd, configured → `SmtpEmailProvider`, unconfigured → `UnconfiguredEmailProvider` (unchanged).
- `emailDeliveryIsLocal()` is true for the console provider and false for SMTP.
- `pnpm test email-integration` is green.

## Verify

```sh
pnpm test email-integration
```

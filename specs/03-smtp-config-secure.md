# 03 — SMTP config: security mode with a loopback plaintext default

## Goal

Let the SMTP config say _how_ the connection is secured — implicit TLS as before, or plaintext for a local capture box — and default to plaintext whenever the host is loopback, so inbucket needs no extra environment.

## Where

- `src/shared/integrations/email/providers/smtp/config.ts`
- `test/smtp-config.test.ts`

## Why

The connection layer (`socket.ts`) hard-codes implicit TLS (`secureTransport: "on"`), which is right for the real mailbox on 465 but wrong for inbucket on 54325, which speaks plaintext. The provider must know which to request. Because a loopback address can only be a local capture box — nobody relays production mail through `127.0.0.1` — the safe default is derived from the host: plaintext on loopback, implicit TLS everywhere else. That keeps the local setup to `SMTP_HOST`/`SMTP_PORT` alone and still refuses to send a password unencrypted to a real remote host by default.

## Steps

1. In `config.ts`:

   a) Add `secure: boolean` to `SmtpConfig`.

   b) Add a loopback helper and the security-mode parser:

   ```ts
   /** A loopback host can only be a local capture box (inbucket); nothing real is relayed there. */
   export function isLoopbackHost(host: string): boolean {
     return host === "127.0.0.1" || host === "localhost" || host === "::1";
   }

   function parseSecure(raw: string | undefined, host: string): boolean {
     if (raw === "off" || raw === "false" || raw === "0") return false;
     if (raw === "on" || raw === "true" || raw === "1") return true;
     return !isLoopbackHost(host);
   }
   ```

   c) In `readSmtpConfig`, carry `secure` on the result:

   ```ts
   return {
     host,
     port: positiveInt(env.SMTP_PORT, DEFAULT_PORT),
     secure: parseSecure(env.SMTP_SECURE, host),
     ...
   };
   ```

   d) Extend the header comment accordingly — the existing list of `SMTP_*` env vars (`SMTP_PORT`, `SMTP_FROM_EMAIL`, …) gains `SMTP_SECURE`, named without a `NEXT_PUBLIC_` prefix for the same reason as the password.

2. In `test/smtp-config.test.ts`:

   a) Update "defaults to implicit-TLS SMTP with a bounded timeout" (line 32-36) to also expect `secure: true`.

   b) Add a loopback test:

   ```ts
   // The local capture box speaks plaintext; pointing dev at it must not force
   // a second env var to say so.
   it("defaults to plaintext for a loopback capture host", () => {
     expect(readSmtpConfig({ ...COMPLETE, SMTP_HOST: "127.0.0.1", SMTP_PORT: "54325" })).toMatchObject({
       port: 54325,
       secure: false,
     });
   });
   ```

   c) Add an explicit-override test:

   ```ts
   it("honours an explicit SMTP_SECURE override either way", () => {
     expect(readSmtpConfig({ ...COMPLETE, SMTP_SECURE: "off" })).toMatchObject({ secure: false });
     expect(readSmtpConfig({ ...COMPLETE, SMTP_HOST: "127.0.0.1", SMTP_SECURE: "on" })).toMatchObject({ secure: true });
   });
   ```

## Definition of done

- `SmtpConfig` carries a `secure` flag.
- Loopback hosts default to plaintext; remote hosts default to implicit TLS; `SMTP_SECURE` overrides both.
- `pnpm test smtp-config` is green.
- Nothing else consumes `SmtpConfig` yet in a way the new field breaks — the provider's test fixture gains it in sheet 04.

## Verify

```sh
pnpm test smtp-config
```

# 02 — SMTP session: skip AUTH when none is advertised

## Goal

Make the SMTP session able to talk to a relay that advertises no AUTH mechanism — inbucket (the local capture box, port 54325) is exactly that. Today the session throws, so there was never a way to deliver project mail into inbucket.

## Where

- `src/shared/integrations/email/providers/smtp/session.ts` — `authenticate` (lines 158-177)
- `test/smtp-session.test.ts`

## Why

`runSmtpSession` calls `authenticate` unconditionally (`session.ts:119`) and that function throws when the server advertises neither PLAIN nor LOGIN (`session.ts:177`). inbucket advertises no AUTH at all, so no mail could reach it even with the right host and port. AUTH must be _offered when advertised_, not _demanded after the fact_: the live Exim host advertises `AUTH PLAIN LOGIN` and still authenticates exactly as before, while an open relay or a capture box proceeds without a login.

## Steps

1. In `session.ts`, make `authenticate` fall through silently when no mechanism is advertised:

   ```ts
   async function authenticate(write: Write, expect: Expect, capabilities: string[], params: SmtpSessionParams): Promise<void> {
     const mechanisms = (capabilities.find((line) => line.toUpperCase().startsWith("AUTH")) ?? "").toUpperCase();

     if (mechanisms.includes("PLAIN")) {
       await write(`AUTH PLAIN ${utf8ToBase64(`\0${params.username}\0${params.password}`)}`);
       await expect("AUTH PLAIN", 235);
       return;
     }

     if (mechanisms.includes("LOGIN")) {
       await write("AUTH LOGIN");
       await expect("AUTH LOGIN", 334);
       await write(utf8ToBase64(params.username));
       await expect("AUTH LOGIN username", 334);
       await write(utf8ToBase64(params.password));
       await expect("AUTH LOGIN password", 235);
       return;
     }

     // No mechanism advertised — an open relay, or a local capture box like
     // inbucket. Nothing to prove and nobody to prove it to.
   }
   ```

   The doc comment on the function ("Prefers PLAIN …") stays accurate.

2. In `test/smtp-session.test.ts`, replace the test "rejects a server offering no usable AUTH mechanism" (currently lines 129-133) with one that holds the new behaviour:

   ```ts
   // inbucket advertises no AUTH; the session must speak the envelope anyway,
   // or nothing this project mails could ever land in the local capture box.
   it("sends without AUTH when the server advertises none", async () => {
     const server = fakeSmtpServer([
       "220 ready\r\n",
       "250-server2 Hello\r\n250 SIZE 100\r\n",
       "250 OK\r\n",
       "250 Accepted\r\n",
       "354 Send data\r\n",
       "250 Queued\r\n",
     ]);

     await expect(runSmtpSession(server.duplex, PARAMS)).resolves.toBeUndefined();
     const sent = server.written();

     expect(sent).not.toContain("AUTH");
     expect(sent).toContain("MAIL FROM:<no-reply@startuplab.center>");
     expect(sent).toContain("QUIT\r\n");
   });
   ```

   The existing AUTH tests ("authenticates with AUTH PLAIN…", "uses AUTH LOGIN…", "reports the stage and code when authentication is rejected") are untouched: their fake servers still advertise the mechanism, so the session still authenticates.

## Definition of done

- A session against a capabilities list with no `AUTH` line completes the full envelope and never sends an AUTH command.
- A session against a server advertising `AUTH PLAIN`/`AUTH LOGIN` still authenticates.
- `pnpm test smtp-session` is green.

## Verify

```sh
pnpm test smtp-session
```

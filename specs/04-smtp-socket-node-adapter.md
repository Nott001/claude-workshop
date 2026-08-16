# 04 — Socket layer: plaintext option + Node adapter for `next dev`

## Goal

Give the connection layer the two things sheet 03's config asks for: a `secure` knob on the workerd socket, and a second connector that opens the same `SmtpDuplex` shape from Node — which is what lets `pnpm dev` actually reach inbucket. The provider forwards the config's `secure` flag to whichever connector it holds.

## Where

- `src/shared/integrations/email/providers/smtp/socket.ts` — `connectSmtp`
- `src/shared/integrations/email/providers/smtp/node-socket.ts` — **new**
- `src/shared/integrations/email/providers/smtp/index.ts` — `SmtpEmailProvider.deliver`
- `test/smtp-provider.test.ts`
- `test/node-socket.test.ts` — **new**

## Why

The session layer (`session.ts`) already speaks over WHATWG streams that Node 22 provides natively, so the only thing keeping `next dev` from real SMTP is the socket: `connectSmtp` is workerd-only (`socket.ts:43-47` throws otherwise) and hard-codes implicit TLS. Adding the flag keeps workerd's prod path unchanged, and a Node connector wrapped into the same `{ readable, writable, close }` shape gives the dev runtime a socket without the protocol learning a second dialect.

## Steps

1. In `socket.ts`, let `connectSmtp` take the security mode:

   ```ts
   export async function connectSmtp(hostname: string, port: number, secure = true): Promise<SmtpDuplex> {
     if (!isWorkerdRuntime()) {
       throw new Error(
         "SMTP needs the Workers runtime. Use `pnpm cf:preview` to exercise it; `next dev` dials a local capture box directly.",
       );
     }

     const { connect } = await loadSockets();
     const socket = connect({ hostname, port }, { secureTransport: secure ? "on" : "off", allowHalfOpen: false });

     return {
       readable: socket.readable,
       writable: socket.writable,
       close: () => socket.close(),
     };
   }
   ```

2. Create `node-socket.ts`, the `next dev` counterpart. `cloudflare:sockets` does not exist off workerd, so Node dials SMTP straight from `node:net`/`node:tls` and adapts the socket to web streams with `node:stream`. The `servername` for SNI is only sent for hostnames, since RFC 6066 forbids it for IPs. `close` must survive being called _after_ the session ended its web writer (a web end() ends the Node socket): a second `end()` on a finished stream is a no-op whose callback can never settle, so the guard resolves immediately when the writable is already finished and otherwise ends and waits for the peer's FIN:

   ```ts
   import net from "node:net";
   import tls from "node:tls";
   import { Readable, Writable } from "node:stream";
   import type { SmtpDuplex } from "./session";

   export function connectSmtpNode(host: string, port: number, secure: boolean): Promise<SmtpDuplex> {
     return new Promise<SmtpDuplex>((resolve, reject) => {
       const socket = secure
         ? tls.connect({ host, port, ...(net.isIP(host) === 0 ? { servername: host } : {}) })
         : net.connect({ host, port });
       let settled = false;

       socket.once("error", (err: Error) => {
         if (settled) return;
         settled = true;
         reject(err);
       });
       socket.once(secure ? "secureConnect" : "connect", () => {
         if (settled) return;
         settled = true;
         resolve({
           readable: Readable.toWeb(socket) as ReadableStream<Uint8Array>,
           writable: Writable.toWeb(socket) as WritableStream<Uint8Array>,
           close: () =>
             new Promise<void>((resolveClose) => {
               if (socket.destroyed || socket.writableFinished) {
                 resolveClose();
                 return;
               }
               socket.once("close", resolveClose);
               socket.end();
             }),
         });
       });
     });
   }
   ```

   The module is statically imported by the email seam (sheet 05), so the workerd bundle carries it too, but only as dead code there: its entry only ever runs off-workerd, and `node:net`/`node:tls`/`node:stream` exist under `nodejs_compat`. Sheet 11's `cf:preview` confirms the isolate still boots with it bundled.

3. In `providers/smtp/index.ts`, forward the security mode from config to the connector, and widen `Connect` to carry it:

   ```ts
   type Connect = (hostname: string, port: number, secure: boolean) => Promise<SmtpDuplex>;

   const connection = await this.connect(this.config.host, this.config.port, this.config.secure);
   ```

   The injected `connect` in the provider tests ignores the extra argument, so they keep working after sheet 03's fixture gains `secure`.

4. Update `test/smtp-provider.test.ts`:

   a) Add `secure: true` to the `CONFIG` fixture.

   b) Add a test that the provider hands the flag through:

   ```ts
   it("passes the configured security mode to the connector", async () => {
     const server = fakeSmtpServer(acceptingScript());
     const connect = vi.fn(async (_host: string, _port: number, _secure: boolean) => server.duplex);
     const provider = new SmtpEmailProvider(CONFIG, connect);

     await provider.send(MESSAGE);

     expect(connect).toHaveBeenCalledWith("mail.startuplab.center", 465, true);
   });
   ```

   Add `vi` to the existing `vitest` import.

5. Create `test/node-socket.test.ts` — a real `net.createServer` proves the adapter opens a socket bytes actually reach (assert behaviour, not shapes). Three cases: plaintext bytes reach the peer, `close()` settles even when the writer already ended the socket (the double-end guard above — a peer holding the connection must not hang a send), and a TLS handshake against a plaintext peer rejects (covers the `secure` branch without a cert fixture):

   ```ts

   ```

import { describe, it, expect } from "vitest";
import { createServer, type Server } from "node:net";
import { connectSmtpNode } from "@/shared/integrations/email/providers/smtp/node-socket";

async function listen(server: Server): Promise<number> {
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
return (server.address() as { port: number }).port;
}

describe("connectSmtpNode", () => {
it("opens a plaintext connection whose bytes reach the peer", async () => {
const received: string[] = [];
const server: Server = createServer((socket) => {
socket.on("data", (chunk) => received.push(chunk.toString()));
socket.write("220 inbucket ready\r\n");
});
const port = await listen(server);

       try {
         const duplex = await connectSmtpNode("127.0.0.1", port, false);
         const writer = duplex.writable.getWriter();
         try {
           await writer.write(new TextEncoder().encode("EHLO capture.test\r\n"));
         } finally {
           await writer.close().catch(() => {});
         }

         expect(received).toContain("EHLO capture.test\r\n");
       } finally {
         server.close();
       }
     });

     it("settles close() after the writer already ended the socket", async () => {
       const server: Server = createServer((socket) => socket.write("220 inbucket ready\r\n"));
       const port = await listen(server);

       try {
         const duplex = await connectSmtpNode("127.0.0.1", port, false);
         await duplex.writable.getWriter().close();
         await expect(duplex.close()).resolves.toBeUndefined();
       } finally {
         server.close();
       }
     });

     it("rejects against a peer that will not complete a TLS handshake", async () => {
       const server: Server = createServer((socket) => socket.write("220 plaintext\r\n"));
       const port = await listen(server);

       try {
         await expect(connectSmtpNode("127.0.0.1", port, true)).rejects.toBeTruthy();
       } finally {
         server.close();
       }
     });

});

````

## Definition of done

- `connectSmtp(host, port, secure)` opens plaintext when `secure` is false, implicit TLS otherwise.
- `connectSmtpNode` yields the same `SmtpDuplex` shape over a Node socket, and real bytes reach a real listening peer.
- `SmtpEmailProvider` forwards `config.secure` to the connector.
- `pnpm test smtp-provider node-socket` is green.

## Verify

```sh
pnpm test smtp-provider node-socket
````

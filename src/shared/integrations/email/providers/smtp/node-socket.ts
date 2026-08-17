import net from "node:net";
import tls from "node:tls";
import { Readable, Writable } from "node:stream";
import type { SmtpDuplex } from "./session";

/**
 * The `next dev` counterpart to `connectSmtp`: workerd's cloudflare:sockets
 * module does not exist in Node, so the dev runtime dials SMTP itself when the
 * config points at a local capture box. Loopback hosts default to plaintext
 * (see config.ts), which is the only transport inbucket speaks.
 */
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
        // The session ends its web writer before this runs, which itself ends
        // the Node socket — so close must not end() again: a second end() on a
        // finished stream is a no-op whose callback can never settle this
        // promise. When the socket has not ended yet (a timeout abandoned it),
        // end() and wait for 'close', which the MTA's own close after QUIT
        // (or the partner quirk) guarantees. destroy() is not used because the
        // message is already accepted by this point and a graceful FIN lets the
        // peer flush before the socket drops.
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

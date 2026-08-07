import type { SmtpDuplex } from "@/shared/integrations/email/providers/smtp/session";

export interface FakeSmtpServer {
  duplex: SmtpDuplex;
  /** The whole conversation, for content assertions. */
  written: () => string;
  /** One entry per flush, so tests can tell pipelined writes from serial ones. */
  writes: () => string[];
  wasClosed: () => boolean;
}

function serverReading(readable: ReadableStream<Uint8Array>): FakeSmtpServer {
  const chunks: Uint8Array[] = [];
  let closed = false;

  const duplex: SmtpDuplex = {
    readable,
    writable: new WritableStream<Uint8Array>({
      write(chunk) {
        chunks.push(chunk);
      },
    }),
    close: async () => {
      closed = true;
    },
  };

  const writes = () => chunks.map((chunk) => new TextDecoder().decode(chunk));

  return {
    duplex,
    written: () => writes().join(""),
    writes,
    wasClosed: () => closed,
  };
}

/**
 * Pre-queues the server side of the conversation. The session's reply reader
 * buffers, so replies are still consumed in order and no real socket is opened.
 */
export function fakeSmtpServer(replies: string[]): FakeSmtpServer {
  const encoder = new TextEncoder();

  return serverReading(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const reply of replies) controller.enqueue(encoder.encode(reply));
        controller.close();
      },
    }),
  );
}

/**
 * A peer that accepts the connection and then never speaks. The stream neither
 * yields nor ends, so the session parks in `reader.read()` exactly as it does
 * against a stalled MTA — which is the only way to reach the timeout path.
 */
export function stalledSmtpServer(): FakeSmtpServer {
  return serverReading(new ReadableStream<Uint8Array>({ start() {} }));
}

/** Greeting and capabilities matching the live Exim host, which offers both. */
export const ESMTP_GREETING = [
  "220 server2.startuplab.center ESMTP Exim\r\n",
  "250-server2 Hello\r\n250-PIPELINING\r\n250 AUTH PLAIN LOGIN\r\n",
];

/** A full exchange that accepts the message. */
export function acceptingScript(): string[] {
  return [...ESMTP_GREETING, "235 Authenticated\r\n", "250 OK\r\n", "250 Accepted\r\n", "354 Send data\r\n", "250 Queued\r\n"];
}

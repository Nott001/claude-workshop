import { utf8ToBase64 } from "./encoding";

const CRLF = "\r\n";

/**
 * The byte-stream half of an SMTP connection. Declared structurally so the
 * protocol never imports a host-specific socket API — which is what lets the
 * tests drive it with an in-memory pair instead of a network.
 */
export interface SmtpDuplex {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  close(): Promise<void>;
}

export interface SmtpReply {
  code: number;
  lines: string[];
}

export interface SmtpSessionParams {
  ehloName: string;
  username: string;
  password: string;
  envelopeFrom: string;
  envelopeTo: string;
  message: string;
}

export class SmtpError extends Error {
  constructor(
    readonly stage: string,
    readonly reply: SmtpReply,
  ) {
    super(`SMTP ${stage} failed: ${reply.code} ${reply.lines.join("; ")}`);
    this.name = "SmtpError";
  }
}

/** Splits the response stream into replies, joining `250-` continuation lines. */
export class ReplyReader {
  private readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  private readonly decoder = new TextDecoder();
  private buffer = "";

  constructor(readable: ReadableStream<Uint8Array>) {
    this.reader = readable.getReader();
  }

  async read(): Promise<SmtpReply> {
    for (;;) {
      const reply = this.takeReply();
      if (reply) return reply;

      const { value, done } = await this.reader.read();
      if (done) throw new Error("SMTP server closed the connection unexpectedly");
      this.buffer += this.decoder.decode(value, { stream: true });
    }
  }

  release(): void {
    this.reader.releaseLock();
  }

  private takeReply(): SmtpReply | null {
    const lines: string[] = [];
    let cursor = 0;

    for (;;) {
      const end = this.buffer.indexOf(CRLF, cursor);
      if (end === -1) return null;

      const line = this.buffer.slice(cursor, end);
      cursor = end + CRLF.length;
      lines.push(line.slice(4));

      // A hyphen in column 4 means more lines follow; a space ends the reply.
      if (line[3] !== "-") {
        this.buffer = this.buffer.slice(cursor);
        return { code: Number(line.slice(0, 3)), lines };
      }
    }
  }
}

function supports(capabilities: string[], keyword: string): boolean {
  return capabilities.some((line) => line.toUpperCase().split(" ")[0] === keyword);
}

/**
 * A data line beginning with `.` would otherwise terminate DATA early. Base64
 * bodies never produce one, but headers are not encoded, so the transparency
 * rule is applied rather than assumed away.
 */
function dotStuff(message: string): string {
  return message.replace(/^\./gm, "..");
}

/** Runs one message over an already-connected, already-encrypted socket. */
export async function runSmtpSession(connection: SmtpDuplex, params: SmtpSessionParams): Promise<void> {
  const replies = new ReplyReader(connection.readable);
  const writer = connection.writable.getWriter();
  const encoder = new TextEncoder();

  const write = (...lines: string[]) => writer.write(encoder.encode(lines.map((line) => line + CRLF).join("")));

  const expect = async (stage: string, ...codes: number[]): Promise<SmtpReply> => {
    const reply = await replies.read();
    if (!codes.includes(reply.code)) throw new SmtpError(stage, reply);
    return reply;
  };

  try {
    await expect("greeting", 220);

    await write(`EHLO ${params.ehloName}`);
    const capabilities = (await expect("EHLO", 250)).lines;

    await authenticate(write, expect, capabilities, params);

    const [mailFrom, rcptTo, data] = [`MAIL FROM:<${params.envelopeFrom}>`, `RCPT TO:<${params.envelopeTo}>`, "DATA"];

    if (supports(capabilities, "PIPELINING")) {
      // RFC 2920 permits grouping MAIL/RCPT/DATA, saving two round trips. The
      // replies still arrive in order, and a failure aborts the whole session,
      // so the unread remainder never matters.
      await write(mailFrom, rcptTo, data);
      await expect("MAIL FROM", 250);
      await expect("RCPT TO", 250, 251);
      await expect("DATA", 354);
    } else {
      await write(mailFrom);
      await expect("MAIL FROM", 250);
      await write(rcptTo);
      await expect("RCPT TO", 250, 251);
      await write(data);
      await expect("DATA", 354);
    }

    await write(dotStuff(params.message), ".");
    await expect("message body", 250);

    await write("QUIT");
  } finally {
    // Best effort: by here the message is already accepted or already failed,
    // and a teardown error must not mask the real one. Closing the connection
    // belongs to whoever opened it — a timed-out session never reaches this
    // block at all, so the socket cannot be this function's to release.
    await writer.close().catch(() => {});
    replies.release();
  }
}

type Write = (...lines: string[]) => Promise<void>;
type Expect = (stage: string, ...codes: number[]) => Promise<SmtpReply>;

/**
 * Prefers PLAIN (one round trip) and falls back to LOGIN for older servers.
 * A server that advertises no mechanism — or only one we do not speak, like
 * CRAM-MD5 — is treated as an open relay or a capture box: nothing to prove,
 * so the session proceeds unauthenticated and the MTA decides. inbucket is
 * exactly this case and needs its mail to land without a login.
 */
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
}

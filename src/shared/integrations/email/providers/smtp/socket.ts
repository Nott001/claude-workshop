import type { SmtpDuplex } from "./session";

interface CloudflareSocket {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  close(): Promise<void>;
}

interface CloudflareSocketsModule {
  connect(
    address: { hostname: string; port: number },
    options?: { secureTransport?: "off" | "on" | "starttls"; allowHalfOpen?: boolean },
  ): CloudflareSocket;
}

// Held in a variable so no bundler tries to resolve `cloudflare:sockets` while
// producing the Node build — the specifier only exists inside workerd.
const SOCKETS_MODULE = "cloudflare:sockets";

/** workerd identifies itself here; `next dev` and vitest do not. */
export function isWorkerdRuntime(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
}

/**
 * Opens an implicit-TLS connection. Port 465 expects TLS from the first byte,
 * which is what `secureTransport: "on"` provides — STARTTLS on 587 would need
 * an in-band upgrade mid-stream that the runtime cannot perform.
 */
export async function connectSmtp(hostname: string, port: number): Promise<SmtpDuplex> {
  if (!isWorkerdRuntime()) {
    throw new Error(
      "SMTP needs the Workers runtime. Use `pnpm cf:preview` to exercise it; `next dev` falls back to the console provider.",
    );
  }

  const { connect } = (await import(/* webpackIgnore: true */ SOCKETS_MODULE)) as CloudflareSocketsModule;
  const socket = connect({ hostname, port }, { secureTransport: "on", allowHalfOpen: false });

  return {
    readable: socket.readable,
    writable: socket.writable,
    close: () => socket.close(),
  };
}

/** A stalled peer would otherwise hold the request open until the isolate dies. */
export function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    work.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

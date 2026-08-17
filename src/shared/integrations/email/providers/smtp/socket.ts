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

const SOCKETS_MODULE = "cloudflare:sockets";

/**
 * `cloudflare:sockets` exists only inside workerd, and the OpenNext build runs
 * the server bundle through esbuild, which resolves dynamic imports statically
 * and fails on it. The attached `.catch()` is esbuild's documented escape
 * hatch: it downgrades the unresolved specifier from a build error to a
 * runtime one, leaving the import in the output for workerd to satisfy.
 * Removing it breaks `pnpm cf:build`, not just this module.
 */
async function loadSockets(): Promise<CloudflareSocketsModule> {
  return (await import(/* webpackIgnore: true */ SOCKETS_MODULE).catch((cause: unknown) => {
    throw new Error("cloudflare:sockets is unavailable in this runtime", { cause });
  })) as CloudflareSocketsModule;
}

/** workerd identifies itself here; `next dev` and vitest do not. */
export function isWorkerdRuntime(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
}

/**
 * Opens a connection in the requested security mode. Implicit TLS is the
 * default because port 465 expects TLS from the first byte, which is what
 * `secureTransport: "on"` provides — STARTTLS on 587 would need an in-band
 * upgrade mid-stream that the runtime cannot perform. Plaintext is for a local
 * capture box only, which the config's loopback default guarantees.
 */
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

/** A stalled peer would otherwise hold the request open until the isolate dies. */
export function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    work.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

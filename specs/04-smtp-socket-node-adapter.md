# 04 — SMTP socket: Node adapter behind a seam

## Goal

Give the SMTP provider a socket-layer seam (`File → File`-style) so the same
protocol code runs on both Cloudflare Workers (`cloudflare:sockets`) and local
`next dev` (Node `net`), picking the implementation by runtime without touching
call sites.

## Where

- `src/shared/integrations/email/providers/smtp/socket.ts` — `isWorkerdRuntime()`
  - the connector type `SmtpConnector`.
- `src/shared/integrations/email/providers/smtp/node-socket.ts` —
  `connectSmtpNode` (Node `net.connect`).
- `src/shared/integrations/email/providers/smtp/session.ts` — the protocol
  takes an already-connected `SmtpDuplex` and is runtime-agnostic.

## Why

- AGENTS.md: "keep host-specific code behind a seam. Codecs, caches, schedulers
  and realtime differ per platform. Hide them behind a signature that does not,
  so changing host touches one file rather than every call site." This is the
  same rule applied to the transport.
- `cloudflare:sockets` does not exist under `next dev`; Node's `net` does not
  exist in a Worker isolate. Both, however, can be shaped into the same
  `{ readable: ReadableStream, writable: WritableStream, close(): Promise }`.
- The seam is _not_ the test: seeing "works locally" via vitest/Node taught us
  nothing about workerd. `pnpm cf:preview` is the only gate that answers
  "does this still talk sockets in an isolate". The seam makes the swap cheap;
  preview makes the swap _known_.
- A timed-out session never reaches close, so who owns the socket is explicit:
  the connector that opened it.

## Steps

1. Define `SmtpDuplex` (readable/writable/close) once in `session.ts`.
2. `connectSmtpNode(options)` → Node `net.connect`, resolve once `'connect'`,
   and shape to `SmtpDuplex` with `close()` = `socket.end()`.
3. `isWorkerdRuntime()` = `typeof (globalThis as any).Workerd !== "undefined"`.
4. `smtp/index.ts` picks: Node adapter when loopback-under-Node, socket when on
   workerd (see spec 05 for the full routing table).
5. In-memory duplex pairs in tests drive `runSmtpSession` with zero network.

## Verify

- `pnpm test`: session tests green over the in-memory pair.
- `pnpm cf:preview`: real Worker genartes a Mailpit message (spec 05/06 path).

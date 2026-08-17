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

  // The session ends its web writer before the provider closes the connection,
  // so the node socket is already FIN'd by then. close() must settle even when
  // it is a second end() — a peer that holds the connection open could
  // otherwise leave the send hung forever.
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

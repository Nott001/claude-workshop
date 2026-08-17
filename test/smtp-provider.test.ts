import { describe, it, expect, vi } from "vitest";
import { SmtpEmailProvider } from "@/shared/integrations/email/providers/smtp";
import type { SmtpConfig } from "@/shared/integrations/email/providers/smtp/config";
import type { FakeSmtpServer } from "./helpers/smtp-server";
import { acceptingScript, ESMTP_GREETING, fakeSmtpServer, stalledSmtpServer } from "./helpers/smtp-server";

const CONFIG: SmtpConfig = {
  host: "mail.startuplab.center",
  port: 465,
  secure: true,
  username: "no-reply@startuplab.center",
  password: "s3cret",
  fromEmail: "no-reply@startuplab.center",
  fromName: "Startup Lab",
  timeoutMs: 5_000,
  attempts: 1,
};

const MESSAGE = {
  to: { email: "attendee@example.com", name: "Ada" },
  subject: "Registration Confirmed",
  htmlContent: '<h1>Ticket</h1><img src="data:image/png;base64,QUJD" alt="QR code" />',
};

function providerAgainst(replies: string[]) {
  const server = fakeSmtpServer(replies);
  const provider = new SmtpEmailProvider(CONFIG, async () => server.duplex);
  return { provider, server };
}

describe("SmtpEmailProvider", () => {
  it("reports success once the server queues the message", async () => {
    const { provider } = providerAgainst(acceptingScript());
    await expect(provider.send(MESSAGE)).resolves.toEqual({ success: true });
  });

  it("passes the configured security mode to the connector", async () => {
    const server = fakeSmtpServer(acceptingScript());
    const connect = vi.fn(async () => server.duplex);
    const provider = new SmtpEmailProvider(CONFIG, connect);

    await provider.send(MESSAGE);

    expect(connect).toHaveBeenCalledWith("mail.startuplab.center", 465, true);
  });

  it("sends from the configured mailbox with its display name", async () => {
    const { provider, server } = providerAgainst(acceptingScript());

    await provider.send(MESSAGE);
    const sent = server.written();

    expect(sent).toContain("MAIL FROM:<no-reply@startuplab.center>");
    expect(sent).toContain('From: "Startup Lab" <no-reply@startuplab.center>');
  });

  it("addresses the envelope to the recipient it was given", async () => {
    const { provider, server } = providerAgainst(acceptingScript());

    await provider.send(MESSAGE);
    expect(server.written()).toContain("RCPT TO:<attendee@example.com>");
  });

  it("identifies itself to the MTA as the sending domain", async () => {
    const { provider, server } = providerAgainst(acceptingScript());

    await provider.send(MESSAGE);
    expect(server.written()).toContain("EHLO startuplab.center");
  });

  it("delivers the QR as an inline part rather than a data URI", async () => {
    const { provider, server } = providerAgainst(acceptingScript());

    await provider.send(MESSAGE);
    const sent = server.written();

    expect(sent).toContain("multipart/related");
    expect(sent).toContain("Content-ID: <");
    expect(sent).not.toContain("data:image/png;base64");
  });

  it("returns the failure instead of throwing when auth is rejected", async () => {
    const { provider } = providerAgainst([...ESMTP_GREETING, "535 5.7.8 Authentication failed\r\n"]);

    const result = await provider.send(MESSAGE);

    expect(result.success).toBe(false);
    expect(result.error).toContain("535");
  });

  it("returns the failure when the connection cannot be opened", async () => {
    const provider = new SmtpEmailProvider(CONFIG, async () => {
      throw new Error("connection refused");
    });

    await expect(provider.send(MESSAGE)).resolves.toEqual({ success: false, error: "connection refused" });
  });

  it("retries a transient failure and succeeds on the second connection", async () => {
    // The observed production failure: a greeting that never arrived on an
    // otherwise healthy server.
    const servers = [fakeSmtpServer(["421 Service temporarily unavailable\r\n"]), fakeSmtpServer(acceptingScript())];
    let opened = 0;
    const provider = new SmtpEmailProvider({ ...CONFIG, attempts: 2 }, async () => servers[opened++].duplex);

    await expect(provider.send(MESSAGE)).resolves.toEqual({ success: true });
    expect(opened).toBe(2);
  });

  it("does not retry a permanent rejection", async () => {
    const servers = [
      fakeSmtpServer([...ESMTP_GREETING, "535 5.7.8 Authentication failed\r\n"]),
      fakeSmtpServer(acceptingScript()),
    ];
    let opened = 0;
    const provider = new SmtpEmailProvider({ ...CONFIG, attempts: 2 }, async () => servers[opened++].duplex);

    const result = await provider.send(MESSAGE);

    expect(result.success).toBe(false);
    // A second attempt would be rejected identically and only adds load.
    expect(opened).toBe(1);
  });

  it("sends the identical message on a retry rather than a new one", async () => {
    const servers = [fakeSmtpServer(["421 try later\r\n"]), fakeSmtpServer(acceptingScript())];
    let opened = 0;
    const provider = new SmtpEmailProvider({ ...CONFIG, attempts: 2 }, async () => servers[opened++].duplex);

    await provider.send(MESSAGE);
    const idOf = (body: string) => body.match(/Message-ID: <([^>]+)>/)?.[1];

    expect(idOf(servers[1].written())).toBeTruthy();
    expect(servers[1].written()).toContain("Auto-Submitted: auto-generated");
  });

  it("gives up on a server that never replies", async () => {
    const stalled = stalledSmtpServer();
    const provider = new SmtpEmailProvider({ ...CONFIG, timeoutMs: 20 }, async () => stalled.duplex);

    const result = await provider.send(MESSAGE);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/timed out after 20ms/);
  });

  it("closes the socket of a session it abandoned to the timeout", async () => {
    const stalled = stalledSmtpServer();
    const provider = new SmtpEmailProvider({ ...CONFIG, timeoutMs: 20 }, async () => stalled.duplex);

    await provider.send(MESSAGE);

    // The abandoned session is still parked in reader.read() and will never run
    // its own teardown, so an unclosed socket here is one held for the life of
    // the isolate.
    expect(stalled.wasClosed()).toBe(true);
  });

  it("does not stack a socket per retry against a stalled server", async () => {
    const stalled: FakeSmtpServer[] = [];
    const provider = new SmtpEmailProvider({ ...CONFIG, timeoutMs: 20, attempts: 3 }, async () => {
      const server = stalledSmtpServer();
      stalled.push(server);
      return server.duplex;
    });

    await provider.send(MESSAGE);

    expect(stalled).toHaveLength(3);
    expect(stalled.filter((server) => !server.wasClosed())).toHaveLength(0);
  });
});

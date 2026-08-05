import { describe, it, expect } from "vitest";
import { runSmtpSession, SmtpError } from "@/shared/integrations/email/providers/smtp/session";
import { acceptingScript, ESMTP_GREETING, fakeSmtpServer } from "./helpers/smtp-server";

const PARAMS = {
  ehloName: "startuplab.center",
  username: "no-reply@startuplab.center",
  password: "s3cret",
  envelopeFrom: "no-reply@startuplab.center",
  envelopeTo: "attendee@example.com",
  message: "Subject: Hi\r\n\r\nBody",
};

function happyPath(extra: string[] = []) {
  return [...acceptingScript(), ...extra];
}

describe("runSmtpSession", () => {
  it("completes the envelope and hands over the message", async () => {
    const server = fakeSmtpServer(happyPath());

    await runSmtpSession(server.duplex, PARAMS);
    const sent = server.written();

    expect(sent).toContain("EHLO startuplab.center\r\n");
    expect(sent).toContain("MAIL FROM:<no-reply@startuplab.center>\r\n");
    expect(sent).toContain("RCPT TO:<attendee@example.com>\r\n");
    expect(sent).toContain("DATA\r\n");
    expect(sent).toContain("Subject: Hi\r\n\r\nBody\r\n.\r\n");
    expect(sent).toContain("QUIT\r\n");
  });

  it("authenticates with AUTH PLAIN carrying the credentials", async () => {
    const server = fakeSmtpServer(happyPath());

    await runSmtpSession(server.duplex, PARAMS);
    const token = server.written().match(/AUTH PLAIN (\S+)/)?.[1] ?? "";

    expect(atob(token)).toBe("\0no-reply@startuplab.center\0s3cret");
  });

  it("groups MAIL, RCPT and DATA into one write when PIPELINING is offered", async () => {
    const server = fakeSmtpServer(happyPath());

    await runSmtpSession(server.duplex, PARAMS);
    const batched = server.writes().filter((write) => write.startsWith("MAIL FROM:"));

    expect(batched).toEqual(["MAIL FROM:<no-reply@startuplab.center>\r\nRCPT TO:<attendee@example.com>\r\nDATA\r\n"]);
  });

  it("falls back to one command per round trip without PIPELINING", async () => {
    const server = fakeSmtpServer([
      "220 ready\r\n",
      "250-server2 Hello\r\n250 AUTH PLAIN\r\n",
      "235 Authenticated\r\n",
      "250 OK\r\n",
      "250 Accepted\r\n",
      "354 Send data\r\n",
      "250 Queued\r\n",
    ]);

    await runSmtpSession(server.duplex, PARAMS);
    const envelope = server.writes().filter((write) => /^(MAIL FROM|RCPT TO|DATA)/.test(write));

    expect(envelope).toEqual(["MAIL FROM:<no-reply@startuplab.center>\r\n", "RCPT TO:<attendee@example.com>\r\n", "DATA\r\n"]);
  });

  it("uses AUTH LOGIN when the server offers nothing better", async () => {
    const server = fakeSmtpServer([
      "220 ready\r\n",
      "250-server2 Hello\r\n250-PIPELINING\r\n250 AUTH LOGIN\r\n",
      "334 VXNlcm5hbWU6\r\n",
      "334 UGFzc3dvcmQ6\r\n",
      "235 Authenticated\r\n",
      "250 OK\r\n",
      "250 Accepted\r\n",
      "354 Send data\r\n",
      "250 Queued\r\n",
    ]);

    await runSmtpSession(server.duplex, PARAMS);
    const sent = server.written();

    expect(sent).toContain("AUTH LOGIN\r\n");
    expect(sent).toContain(`${btoa("no-reply@startuplab.center")}\r\n`);
    expect(sent).toContain(`${btoa("s3cret")}\r\n`);
  });

  it("escapes a body line that would otherwise end DATA early", async () => {
    const server = fakeSmtpServer(happyPath());

    await runSmtpSession(server.duplex, { ...PARAMS, message: "Subject: Hi\r\n\r\n.hidden" });
    expect(server.written()).toContain("\r\n..hidden\r\n.\r\n");
  });

  it("reports the stage and code when authentication is rejected", async () => {
    const server = fakeSmtpServer([...ESMTP_GREETING.slice(0, 2), "535 5.7.8 Authentication failed\r\n"]);

    const error = await runSmtpSession(server.duplex, PARAMS).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SmtpError);
    expect((error as SmtpError).reply.code).toBe(535);
    expect((error as SmtpError).stage).toBe("AUTH PLAIN");
  });

  it("reports a rejected recipient rather than reporting success", async () => {
    const server = fakeSmtpServer([...ESMTP_GREETING, "235 Authenticated\r\n", "250 OK\r\n", "550 5.1.1 No such user\r\n"]);

    const error = await runSmtpSession(server.duplex, PARAMS).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SmtpError);
    expect((error as SmtpError).stage).toBe("RCPT TO");
  });

  it("parses a multi-line greeting before the capability list", async () => {
    const server = fakeSmtpServer([
      "220-server2 ESMTP Exim\r\n220-We do not authorize bulk mail.\r\n220 Ready\r\n",
      "250-server2 Hello\r\n250-PIPELINING\r\n250 AUTH PLAIN\r\n",
      "235 Authenticated\r\n",
      "250 OK\r\n",
      "250 Accepted\r\n",
      "354 Send data\r\n",
      "250 Queued\r\n",
    ]);

    await expect(runSmtpSession(server.duplex, PARAMS)).resolves.toBeUndefined();
  });

  it("rejects a server offering no usable AUTH mechanism", async () => {
    const server = fakeSmtpServer(["220 ready\r\n", "250-server2 Hello\r\n250 SIZE 100\r\n"]);

    await expect(runSmtpSession(server.duplex, PARAMS)).rejects.toThrow(/no supported AUTH mechanism/);
  });

  it("surfaces a connection that drops mid-conversation", async () => {
    const server = fakeSmtpServer(["220 ready\r\n"]);

    await expect(runSmtpSession(server.duplex, PARAMS)).rejects.toThrow(/closed the connection unexpectedly/);
  });

  it("closes the socket even when the exchange fails", async () => {
    const server = fakeSmtpServer(["421 Service unavailable\r\n"]);

    await runSmtpSession(server.duplex, PARAMS).catch(() => {});
    expect(server.wasClosed()).toBe(true);
  });
});

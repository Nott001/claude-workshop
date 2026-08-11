import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkMailDomain } from "@/shared/integrations/dns/mail-domain";

const MX = 15;
const A = 1;

function doh(body: unknown, ok = true) {
  return Promise.resolve({ ok, json: async () => body } as Response);
}

/** Answers each DNS query type from a map, so a test states only what matters. */
function resolver(byType: Partial<Record<"MX" | "A", unknown>>) {
  const fn = vi.fn((url: string) => {
    const type = new URL(String(url)).searchParams.get("type") as "MX" | "A";
    const answer = byType[type];
    return answer === undefined ? doh(null, false) : doh(answer);
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("checkMailDomain", () => {
  it("accepts a domain that publishes a mail exchanger", async () => {
    resolver({ MX: { Status: 0, Answer: [{ type: MX, data: "10 mx.acme.test." }] } });

    await expect(checkMailDomain("acme.test")).resolves.toBe("deliverable");
  });

  it("rejects a domain that does not exist", async () => {
    resolver({ MX: { Status: 3 } });

    await expect(checkMailDomain("gmial-typo.test")).resolves.toBe("no-mail-server");
  });

  // RFC 5321 treats the address record as an implicit exchanger, so small
  // domains that work perfectly well must not be turned away for lacking MX.
  it("accepts a domain with no MX but an address record", async () => {
    resolver({ MX: { Status: 0, Answer: [] }, A: { Status: 0, Answer: [{ type: A, data: "203.0.113.9" }] } });

    await expect(checkMailDomain("small.test")).resolves.toBe("deliverable");
  });

  it("rejects a domain that resolves to nothing at all", async () => {
    resolver({ MX: { Status: 0, Answer: [] }, A: { Status: 0, Answer: [] } });

    await expect(checkMailDomain("parked.test")).resolves.toBe("no-mail-server");
  });

  it("costs no lookup for a domain everyone uses", async () => {
    const fetchMock = resolver({});

    await expect(checkMailDomain("gmail.com")).resolves.toBe("deliverable");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe("never blocks the user when it cannot get an answer", () => {
    it("returns unknown when the resolver errors", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))),
      );

      await expect(checkMailDomain("acme.test")).resolves.toBe("unknown");
    });

    it("returns unknown when the resolver answers with a non-200", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => doh(null, false)),
      );

      await expect(checkMailDomain("acme.test")).resolves.toBe("unknown");
    });

    it("returns unknown when the lookup times out", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.reject(new DOMException("The operation was aborted.", "TimeoutError"))),
      );

      await expect(checkMailDomain("acme.test")).resolves.toBe("unknown");
    });

    // gmial.com answers SERVFAIL through a broken delegation. That is the
    // resolver failing, not the domain being absent, and reading it as absent
    // would refuse an address on the strength of someone else's outage.
    it("returns unknown on SERVFAIL rather than calling the domain dead", async () => {
      resolver({ MX: { Status: 2 } });

      await expect(checkMailDomain("servfail.test")).resolves.toBe("unknown");
    });

    it("returns unknown when the address lookup answers SERVFAIL too", async () => {
      resolver({ MX: { Status: 0, Answer: [] }, A: { Status: 2 } });

      await expect(checkMailDomain("servfail-a.test")).resolves.toBe("unknown");
    });

    it("returns unknown when the MX answer is fine but the address lookup fails", async () => {
      resolver({ MX: { Status: 0, Answer: [] } });

      await expect(checkMailDomain("acme.test")).resolves.toBe("unknown");
    });
  });

  it("asks the resolver for the domain it was given", async () => {
    const fetchMock = resolver({ MX: { Status: 0, Answer: [{ type: MX, data: "10 mx.acme.test." }] } });

    await checkMailDomain("acme.test");

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe("https://cloudflare-dns.com/dns-query");
    expect(url.searchParams.get("name")).toBe("acme.test");
    expect(url.searchParams.get("type")).toBe("MX");
  });
});

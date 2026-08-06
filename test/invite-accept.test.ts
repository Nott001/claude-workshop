import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { verifyOtp, redirect } = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  redirect: vi.fn((to: string) => {
    // The real one throws to abort the render, and callers rely on nothing
    // after it running.
    throw new Error(`REDIRECT:${to}`);
  }),
}));

vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { verifyOtp } }) }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ redirect }));
// A client component that reaches for session context; the markup under test is
// the form it wraps.
vi.mock("@/modules/auth/components/auth-layout", () => ({
  AuthLayout: ({ children }: { children: React.ReactNode }) => children,
}));

import InvitePage from "@/app/invite/page";
import { POST } from "@/app/api/auth/invite/route";

/**
 * Shaped like a real token but deliberately low-entropy: a random-looking
 * 24-character string here is indistinguishable from a leaked key to the
 * secret scanner, and failed the Security workflow as `generic-api-key`.
 */
const TOKEN = "aaaabbbbccccddddeeeeffff";

const original = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = "https://events.example.com/";
  verifyOtp.mockResolvedValue({ error: null });
});

afterEach(() => {
  process.env = { ...original };
});

function page(token?: string) {
  return InvitePage({ searchParams: Promise.resolve({ token }) });
}

function accept(body: Record<string, string>, headers: Record<string, string> = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(body)) form.append(key, value);
  return POST(
    new Request("https://events.example.com/api/auth/invite", {
      method: "POST",
      body: form,
      headers: { host: "events.example.com", origin: "https://events.example.com", ...headers },
    }),
  );
}

describe("GET /invite", () => {
  it("spends nothing when the page is merely opened", async () => {
    // The whole point: a mail scanner following the link must not accept the
    // invitation on the invitee's behalf.
    await page(TOKEN);

    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("offers the token back as a form submission", async () => {
    const html = renderToStaticMarkup(await page(TOKEN));

    expect(html).toContain('method="post"');
    expect(html).toContain('action="/api/auth/invite"');
    expect(html).toContain(`value="${TOKEN}"`);
    expect(html).toContain('type="submit"');
  });

  it.each<[string | undefined, string]>([
    [undefined, "no token"],
    ["", "empty token"],
    ["short", "too short to be a token"],
    ["has a space", "not URL-safe"],
    ["a".repeat(300), "implausibly long"],
  ])("sends %s back to sign-in (%s)", async (token) => {
    await expect(page(token)).rejects.toThrow("REDIRECT:/sign-in?error=invalid_invite");
  });
});

describe("POST /api/auth/invite", () => {
  it("accepts the invitation and lands the invitee on the app", async () => {
    const res = await accept({ token: TOKEN });

    expect(verifyOtp).toHaveBeenCalledWith({ type: "invite", token_hash: TOKEN });
    // 303 so the browser follows with a GET; a refresh must not resubmit a
    // token that has already been spent.
    expect(res.status).toBe(303);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/email-verified");
  });

  it("reports a token Supabase rejects as an invalid invitation", async () => {
    verifyOtp.mockResolvedValue({ error: new Error("Token has expired or is invalid") });

    const res = await accept({ token: TOKEN });

    expect(res.headers.get("location")).toContain("/sign-in?error=invalid_invite");
  });

  it("refuses a submission from another site", async () => {
    // Otherwise a page anywhere could sign a visitor's browser into an account
    // that is not theirs.
    const res = await accept({ token: TOKEN }, { origin: "https://evil.example" });

    expect(verifyOtp).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toContain("/sign-in?error=invalid_invite");
  });

  it("refuses a token that is not shaped like one", async () => {
    const res = await accept({ token: "../../etc/passwd" });

    expect(verifyOtp).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toContain("/sign-in?error=invalid_invite");
  });

  it("refuses a submission carrying no token at all", async () => {
    const res = await accept({});

    expect(verifyOtp).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toContain("/sign-in?error=invalid_invite");
  });
});

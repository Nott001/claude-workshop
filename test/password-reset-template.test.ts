import { describe, it, expect } from "vitest";
import { passwordResetTemplate } from "@/shared/integrations/email/templates";
import { emailTemplates } from "@/shared/integrations/email/templates";
import { isAuthToken } from "@/modules/auth/lib/auth-token";

const URL = "https://startuplab.center/reset-password?token=abc123";

describe("passwordResetTemplate", () => {
  it("emits a complete document carrying the link twice", () => {
    const html = passwordResetTemplate.buildHtml({ name: "Ada", resetUrl: URL });

    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<title>Reset your Startup Lab password</title>");
    expect(html).toContain("Hi Ada,");
    // Once as the button target, once as copyable text for clients that strip
    // the anchor.
    expect(html.split(URL).length - 1).toBe(2);
  });

  it("builds a plain-text part that stands on its own", () => {
    const text = passwordResetTemplate.buildText({ name: "Ada", resetUrl: URL });

    expect(text).toContain("Hi Ada,");
    expect(text).toContain(URL);
    expect(text).toContain("startuplab.center");
    expect(text).not.toContain("<");
  });

  it("says the link is single-use and ignorable", () => {
    const html = passwordResetTemplate.buildHtml({ name: "Ada", resetUrl: URL });

    expect(html).toContain("only be used once");
    expect(html).toContain("your password will not change");
  });

  // The name comes from user_metadata, which the account holder controls, and
  // the URL carries a token that must not be able to close its own attribute.
  it("escapes both interpolated values", () => {
    const html = passwordResetTemplate.buildHtml({
      name: '<img src=x onerror="alert(1)">',
      resetUrl: 'https://startuplab.center/reset-password?token=abc" onclick="x',
    });

    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain("&quot; onclick=&quot;x");
  });

  // A reset can be requested for an address that owns no USER row, so the
  // template must stay out of the logged registry.
  it("is absent from the EMAIL_LOG template registry", () => {
    expect(Object.values(emailTemplates)).not.toContain(passwordResetTemplate);
  });
});

describe("isAuthToken", () => {
  it("accepts a Supabase hashed_token", () => {
    expect(isAuthToken("aaaabbbbccccddddeeeeffff")).toBe(true);
    expect(isAuthToken("a-b_c" + "d".repeat(20))).toBe(true);
  });

  it("rejects anything that could not have come from generateLink", () => {
    expect(isAuthToken("short")).toBe(false);
    expect(isAuthToken("has spaces in it and is long enough")).toBe(false);
    expect(isAuthToken("../../etc/passwd-and-padding-to-length")).toBe(false);
    expect(isAuthToken(undefined)).toBe(false);
    expect(isAuthToken(null)).toBe(false);
    expect(isAuthToken(12345678901234567890)).toBe(false);
  });
});

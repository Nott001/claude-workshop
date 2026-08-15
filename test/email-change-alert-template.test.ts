import { describe, it, expect } from "vitest";
import { emailChangeAlertTemplate } from "@/shared/integrations/email/templates";
import { emailTemplates } from "@/shared/integrations/email/templates";

describe("emailChangeAlertTemplate", () => {
  it("emits a complete document naming the new address", () => {
    const html = emailChangeAlertTemplate.buildHtml({
      name: "Ada",
      newEmail: "new@example.com",
    });

    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<title>Your email is changing</title>");
    expect(html).toContain("Hi Ada,");
    expect(html).toContain("to <strong>new@example.com</strong>");
  });

  it("carries no link anywhere", () => {
    const html = emailChangeAlertTemplate.buildHtml({
      name: "Ada",
      newEmail: "new@example.com",
    });
    const text = emailChangeAlertTemplate.buildText({
      name: "Ada",
      newEmail: "new@example.com",
    });

    expect(html).not.toContain("<a ");
    expect(html).not.toContain("href");
    expect(html).not.toContain("http://");
    expect(html).not.toContain("https://");
    expect(text).not.toContain("<");
    expect(text).not.toContain("http");
  });

  it("builds a plain-text part that stands on its own", () => {
    const text = emailChangeAlertTemplate.buildText({
      name: "Ada",
      newEmail: "new@example.com",
    });

    expect(text).toContain("Hi Ada,");
    expect(text).toContain("change the email on your Startup Lab account to new@example.com");
    expect(text).toContain("contact our team immediately");
    expect(text).toContain("startuplab.center");
  });

  // The name comes from the auth guard and the new address is user-chosen, so
  // either could carry markup that must never reach the HTML half.
  it("escapes both interpolated values", () => {
    const html = emailChangeAlertTemplate.buildHtml({
      name: '<img src=x onerror="alert(1)">',
      newEmail: '<img src=x onerror="alert(1)">',
    });

    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  // The notice goes to the address being abandoned, which may own no USER row
  // after the change lands, so the template must stay out of the logged
  // registry.
  it("is absent from the EMAIL_LOG template registry", () => {
    expect(Object.values(emailTemplates)).not.toContain(emailChangeAlertTemplate);
  });
});

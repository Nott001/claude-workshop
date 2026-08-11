import { describe, it, expect } from "vitest";
import { isSafeRedirectPath, redirectUrlParam } from "@/modules/auth/lib/redirect-url";

describe("isSafeRedirectPath", () => {
  it("accepts a plain same-origin path", () => {
    expect(isSafeRedirectPath("/events/5")).toBe(true);
  });

  it("rejects absolute URLs and protocol-relative input", () => {
    expect(isSafeRedirectPath("https://evil.com")).toBe(false);
    expect(isSafeRedirectPath("//evil.com")).toBe(false);
  });

  it("rejects backslash tricks and javascript schemes", () => {
    expect(isSafeRedirectPath("/\\evil")).toBe(false);
    expect(isSafeRedirectPath("javascript:alert(1)")).toBe(false);
  });

  it("rejects missing and empty values", () => {
    expect(isSafeRedirectPath(null)).toBe(false);
    expect(isSafeRedirectPath(undefined)).toBe(false);
    expect(isSafeRedirectPath("")).toBe(false);
  });
});

describe("redirectUrlParam", () => {
  it("encodes a safe path as a query suffix", () => {
    expect(redirectUrlParam("/events/5")).toBe("?redirect_url=%2Fevents%2F5");
  });

  it("returns an empty suffix for unsafe or missing values", () => {
    expect(redirectUrlParam("https://evil.com")).toBe("");
    expect(redirectUrlParam("//evil.com")).toBe("");
    expect(redirectUrlParam(null)).toBe("");
  });
});

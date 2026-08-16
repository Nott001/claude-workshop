import { describe, it, expect } from "vitest";
import { authErrorMessage } from "@/shared/lib/auth-error-message";

const fallback = "We could not send the verification link. Please try again.";

describe("authErrorMessage", () => {
  it("maps a 429 to the rate-limit copy, whatever the message says", () => {
    for (const message of ["{}", "Too Many Requests", "hourly limit reached"]) {
      expect(authErrorMessage({ status: 429, message }, fallback)).toBe("Too many attempts. Please wait, then try again.");
    }
  });

  it("returns the fallback for the literal {} body", () => {
    expect(authErrorMessage({ message: "{}" }, fallback)).toBe(fallback);
  });

  it("lets a usable provider message through", () => {
    expect(authErrorMessage({ message: "Email already in use" }, fallback)).toBe("Email already in use");
  });

  it("returns the fallback for an empty or whitespace message", () => {
    for (const message of ["", "   "]) {
      expect(authErrorMessage({ message }, fallback)).toBe(fallback);
    }
  });

  it("returns the fallback for a message too short to be provider copy", () => {
    expect(authErrorMessage({ message: "x" }, fallback)).toBe(fallback);
  });
});

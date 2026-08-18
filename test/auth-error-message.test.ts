import { describe, it, expect } from "vitest";
import { authErrorMessage, rateLimitSecondsFrom } from "@/shared/lib/auth-error-message";

const fallback = "We could not send the verification link. Please try again.";

describe("authErrorMessage", () => {
  it("names the wait when the route reports how long is left", () => {
    expect(authErrorMessage({ status: 429, message: "", retryAfter: 43 }, "fallback")).toBe(
      "Too many attempts. Try again in 43 seconds.",
    );
  });

  it("keeps the last second singular", () => {
    expect(authErrorMessage({ status: 429, message: "", retryAfter: 1 }, "fallback")).toBe(
      "Too many attempts. Try again in 1 second.",
    );
  });

  // GoTrue's minimum-interval refusal puts the wait in the sentence and nowhere
  // else — no header, no field. Dropping it is what left a refusal with a known
  // countdown reading as an open-ended one.
  it("recovers the wait GoTrue spelled into its message", () => {
    expect(
      authErrorMessage(
        { status: 429, message: "For security purposes, you can only request this after 41 seconds." },
        fallback,
      ),
    ).toBe("Too many attempts. Try again in 41 seconds.");
  });

  it("recovers the wait from the older phrasing too", () => {
    expect(
      authErrorMessage(
        { status: 429, message: "For security purposes, you can only request this once every 60 seconds" },
        fallback,
      ),
    ).toBe("Too many attempts. Try again in 1 minute.");
  });

  // A wait the reader would have to divide is stated in the unit they think in.
  it("states a long wait in minutes, rounded up so it is never undersold", () => {
    expect(authErrorMessage({ status: 429, message: "", retryAfter: 90 }, fallback)).toBe(
      "Too many attempts. Try again in 2 minutes.",
    );
  });

  // The generic copy reads as a short cooldown, so a user who waits the minute
  // that usually clears one comes back to the same message and concludes the
  // page is broken. The hourly budget has to say what it is.
  it("names the hourly budget when the 429 carries its code but no number", () => {
    expect(
      authErrorMessage({ status: 429, message: "email rate limit exceeded", code: "over_email_send_rate_limit" }, fallback),
    ).toBe("The app has reached its hourly limit for sending emails, which every account shares. Please try again later.");
  });

  // The budget is per project, not per user, so it refuses accounts that have
  // sent nothing at all. Copy that reads as "you did this" sends a brand-new
  // signup looking for a limit of their own that does not exist.
  it("does not blame the account for a budget every account shares", () => {
    const message = authErrorMessage(
      { status: 429, message: "email rate limit exceeded", code: "over_email_send_rate_limit" },
      fallback,
    );

    expect(message).not.toMatch(/\byour?\b|\bthis account\b/i);
    expect(message).toMatch(/shares/i);
  });

  it("stays vague when no countdown came with the 429", () => {
    for (const retryAfter of [undefined, 0]) {
      expect(authErrorMessage({ status: 429, message: "", retryAfter }, "fallback")).toBe(
        "Too many attempts. Please wait, then try again.",
      );
    }
  });

  it("maps a 429 with no number and no code to the vague copy, whatever the message says", () => {
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

describe("rateLimitSecondsFrom", () => {
  it("reads the number out of GoTrue's rate-limit prose", () => {
    expect(rateLimitSecondsFrom("For security purposes, you can only request this after 41 seconds.")).toBe(41);
    expect(rateLimitSecondsFrom("For security purposes, you can only request this once every 60 seconds")).toBe(60);
    expect(rateLimitSecondsFrom("you can only request this after 1 second")).toBe(1);
  });

  // No regex can invent the hourly budget's number, and a guessed one would be
  // wrong by up to an hour.
  it("finds nothing in a message that names no wait", () => {
    for (const message of ["email rate limit exceeded", "Too Many Requests", "{}", ""]) {
      expect(rateLimitSecondsFrom(message)).toBeNull();
    }
  });

  // A refusal that says "after 0 seconds" is not a wait worth counting down.
  it("treats a zero-second wait as no wait at all", () => {
    expect(rateLimitSecondsFrom("you can only request this after 0 seconds")).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { ServiceError } from "@/shared/lib/service-error";
import { toErrorResponse } from "@/shared/lib/error-response";
import { apiErrorMessage } from "@/shared/lib/api-error-message";

class TestServiceError extends ServiceError {}

describe("ServiceError", () => {
  it("carries the status and the subclass's own name", () => {
    const err = new TestServiceError(409, "Already registered");

    expect(err.status).toBe(409);
    expect(err.message).toBe("Already registered");
    expect(err.name).toBe("TestServiceError");
    expect(err).toBeInstanceOf(ServiceError);
  });
});

describe("toErrorResponse", () => {
  it("renders a ServiceError as a flat body with its status", async () => {
    const res = toErrorResponse(new TestServiceError(404, "Event not found"));

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Event not found" });
  });

  it("rethrows anything that is not a ServiceError", () => {
    const boom = new Error("real bug");

    expect(() => toErrorResponse(boom)).toThrow(boom);
  });
});

describe("apiErrorMessage", () => {
  it("reads a flat error string", () => {
    expect(apiErrorMessage({ error: "Forbidden" }, "fallback")).toBe("Forbidden");
  });

  it("reads the legacy nested shape", () => {
    expect(apiErrorMessage({ error: { message: "Nope" } }, "fallback")).toBe("Nope");
  });

  it("falls back when the body carries no error", () => {
    expect(apiErrorMessage(null, "fallback")).toBe("fallback");
    expect(apiErrorMessage({ ok: true }, "fallback")).toBe("fallback");
    expect(apiErrorMessage({ error: undefined }, "fallback")).toBe("fallback");
  });
});

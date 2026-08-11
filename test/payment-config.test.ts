import { describe, it, expect } from "vitest";
import { loadPaymentConfig, PAYMENT_PROVIDERS } from "@/modules/commerce/lib/payment-config";

describe("loadPaymentConfig", () => {
  it("parses the bundled payments.yaml into a validated shape", () => {
    const config = loadPaymentConfig();

    expect(PAYMENT_PROVIDERS).toContain(config.provider);
    expect(["sandbox", "production"]).toContain(config.hitpay.environment);
    expect(Array.isArray(config.hitpay.payment_methods)).toBe(true);
  });

  it("ships with the simulated provider selected, so dev needs no gateway keys", () => {
    // A checked-in hitpay selection without HITPAY_* vars would break every
    // local checkout, so the default must stay keyless.
    expect(loadPaymentConfig().provider).toBe("simulated");
  });
});

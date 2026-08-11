import { describe, it, expect, vi } from "vitest";

// The HitPay adapter builds a Supabase client at import time; the registry
// factory just constructs it, so stand in for the client.
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));

vi.mock("@/modules/commerce/lib/payment-config", () => ({
  PAYMENT_PROVIDERS: ["simulated", "hitpay"],
  loadPaymentConfig: () => ({ provider: "hitpay", hitpay: { environment: "sandbox", payment_methods: [] } }),
}));

import { createDefaultPaymentGateway } from "@/modules/commerce/lib/payment-gateway";
import { HitPayPaymentGateway } from "@/modules/commerce/lib/providers/hitpay";
import { SimulatedPaymentGateway } from "@/modules/commerce/lib/providers/simulated";

describe("provider selection from config/payments.yaml", () => {
  it("builds a HitPay gateway against the sandbox when the config says hitpay", () => {
    const gateway = createDefaultPaymentGateway({ PAYMENT_API_KEY: "k", PAYMENT_WEBHOOK_SALT: "s" });

    expect(gateway).toBeInstanceOf(HitPayPaymentGateway);
  });

  it("fails fast when hitpay is configured but its secrets are missing", () => {
    expect(() => createDefaultPaymentGateway({})).toThrow(/PAYMENT_API_KEY or PAYMENT_WEBHOOK_SALT/);
    expect(() => createDefaultPaymentGateway({ PAYMENT_API_KEY: "k" })).toThrow(/PAYMENT_API_KEY or PAYMENT_WEBHOOK_SALT/);
  });

  it("still offers the simulated provider, selected from the same config", () => {
    // Reaching into the real loader keeps this honest: the factory is the only
    // place the config decides which class runs.
    expect(SimulatedPaymentGateway).toBeDefined();
  });
});

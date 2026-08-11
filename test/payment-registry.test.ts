import { describe, it, expect, vi, afterEach } from "vitest";

// payment-gateway pulls in the HitPay adapter, which builds a Supabase client
// at import time; point that at a stand-in so the registry can be exercised
// without real environment variables.
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));

import {
  createDefaultPaymentGateway,
  configurePaymentGateway,
  getPaymentGateway,
  resetPaymentGateway,
} from "@/modules/commerce/lib/payment-gateway";
import { SimulatedPaymentGateway } from "@/modules/commerce/lib/providers/simulated";

afterEach(() => resetPaymentGateway());

describe("payment gateway registry", () => {
  it("defaults to a simulated provider that needs no secrets", () => {
    const gateway = createDefaultPaymentGateway({});

    expect(gateway).toBeInstanceOf(SimulatedPaymentGateway);
    for (const method of ["createPayment", "confirmWebhook", "refund"] as const) {
      expect(typeof gateway[method]).toBe("function");
    }
  });

  it("resolves a single instance until reset", () => {
    const first = getPaymentGateway();

    expect(getPaymentGateway()).toBe(first);

    resetPaymentGateway();
    expect(getPaymentGateway()).not.toBe(first);
  });

  it("serves whatever was injected, and that alone", () => {
    const fake = {
      createPayment: async () => ({ checkout_url: "https://x", gateway_reference_id: "y" }),
      confirmWebhook: async () => ({ outcome: "paid" as const }),
      refund: async () => ({ refunded: true }),
    };

    configurePaymentGateway(fake);
    expect(getPaymentGateway()).toBe(fake);
  });
});

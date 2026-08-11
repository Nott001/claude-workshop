import { parse } from "yaml";
import { z } from "zod";
import { PAYMENT_CONFIG_YAML } from "./payment-config.generated";

export const PAYMENT_PROVIDERS = ["simulated", "hitpay"] as const;
export type PaymentProviderName = (typeof PAYMENT_PROVIDERS)[number];

const hitPaySchema = z.object({
  environment: z.enum(["sandbox", "production"]).default("sandbox"),
  payment_methods: z.array(z.string()).default([]),
});

const paymentConfigSchema = z.object({
  provider: z.enum(PAYMENT_PROVIDERS),
  hitpay: hitPaySchema.default({ environment: "sandbox", payment_methods: [] }),
});

export type PaymentConfig = z.infer<typeof paymentConfigSchema>;

/**
 * The config comes bundled as a string (Cloudflare Workers have no filesystem),
 * so it is parsed and validated here rather than trusted from disk. A malformed
 * file is a deploy-time mistake, not a runtime fallback.
 */
export function loadPaymentConfig(): PaymentConfig {
  const parsed = paymentConfigSchema.safeParse(parse(PAYMENT_CONFIG_YAML));

  if (!parsed.success) {
    throw new Error(`config/payments.yaml is invalid: ${JSON.stringify(parsed.error.flatten())}`);
  }

  return parsed.data;
}

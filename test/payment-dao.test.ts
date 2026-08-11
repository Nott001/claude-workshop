import { describe, it, expect } from "vitest";
import * as paymentDao from "@/shared/db/dao/payment.dao";
import { fakePostgrest } from "./helpers/fake-postgrest";

describe("payment.dao.updateStatus", () => {
  it("stamps paid_at when marking paid", async () => {
    const fake = fakePostgrest([{ id: 77 }]);

    const ok = await paymentDao.updateStatus(fake.client as never, 77, "paid");

    expect(ok).toBe(true);
    expect(fake.updates[0]).toEqual({ status: "paid", paid_at: expect.any(String) });
  });

  it("does not stamp paid_at for any other status", async () => {
    const fake = fakePostgrest([{ id: 77 }]);

    await paymentDao.updateStatus(fake.client as never, 77, "failed");

    expect(fake.updates[0]).toEqual({ status: "failed" });
  });

  it("is false when the update matched no row", async () => {
    const fake = fakePostgrest([]);

    await expect(paymentDao.updateStatus(fake.client as never, 77, "paid")).resolves.toBe(false);
  });
});

describe("payment.dao.updateGatewayReference", () => {
  it("writes the provider's id onto the payment row", async () => {
    const fake = fakePostgrest([{ id: 77 }]);

    const ok = await paymentDao.updateGatewayReference(fake.client as never, 77, "hp_123");

    expect(ok).toBe(true);
    expect(fake.updates[0]).toEqual({ gateway_reference_id: "hp_123" });
  });
});

describe("payment.dao.findByGatewayReference", () => {
  it("selects the event and buyer embeds the webhook needs", async () => {
    const fake = fakePostgrest(null);

    await paymentDao.findByGatewayReference(fake.client as never, "hp_123");

    expect(fake.selects[0]).toBe("*, EVENT(title, event_date), USER:user_id(full_name, email)");
  });

  it("returns null when no payment carries that reference", async () => {
    const fake = fakePostgrest(null);

    await expect(paymentDao.findByGatewayReference(fake.client as never, "nope")).resolves.toBe(null);
  });
});

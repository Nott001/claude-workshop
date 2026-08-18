import { describe, it, expect, vi } from "vitest";
import * as ticketDao from "@/shared/db/dao/ticket.dao";
import type { DbClient } from "@/shared/db/dao/types";

function queryStub(resolver: (chain: Record<string, unknown>) => unknown) {
  const chain: Record<string, unknown> = {};
  for (const method of ["eq", "order", "limit", "insert", "update", "delete"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.select = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(() => Promise.resolve(resolver(chain)));
  const from = vi.fn(() => chain);
  return { client: { from } as unknown as DbClient, chain };
}

const row = {
  id: 42,
  payment_id: 100,
  user_id: 5,
  event_id: 10,
  qr_token: "tok-123",
  status: "issued",
  issued_at: "2026-08-01T00:00:00Z",
  checked_in_by: null,
  checked_in_at: null,
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
  EVENT: {
    title: "Launch Day",
    event_date: "2026-09-01",
    start_time: "09:00:00",
    end_time: "17:00:00",
    venue_name: "Main Hall",
    venue_address: null,
    price: 0,
    currency: "PHP",
  },
};

describe("ticket.dao.findByIdWithEvent", () => {
  it("selects the card embed, filters by id, and returns the row", async () => {
    const { client, chain } = queryStub(() => ({ data: row, error: null }));

    const ticket = await ticketDao.findByIdWithEvent(client, 42);

    expect(ticket).toEqual(row);
    expect(chain.select).toHaveBeenCalledWith(
      "*, EVENT(title, event_date, start_time, end_time, venue_name, venue_address, price, currency)",
    );
    expect(chain.eq).toHaveBeenCalledWith("id", 42);
    expect(chain.maybeSingle).toHaveBeenCalled();
  });

  it("resolves null on a clean miss", async () => {
    const { client } = queryStub(() => ({ data: null, error: null }));

    await expect(ticketDao.findByIdWithEvent(client, 999)).resolves.toBeNull();
  });

  it("surfaces a failed read via throwOnDbError", async () => {
    const { client } = queryStub(() => ({ data: null, error: { message: "boom", code: "PGRST" } }));

    await expect(ticketDao.findByIdWithEvent(client, 42)).rejects.toThrow("boom");
  });
});

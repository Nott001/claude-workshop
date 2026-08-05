import { describe, it, expect } from "vitest";
import * as ticketDao from "@/shared/db/dao/ticket.dao";

/**
 * Records the select string each list builds, so the assertions below are about
 * the query actually sent rather than a fixture someone kept in step by hand.
 */
function recordingClient(rows: unknown[]) {
  const selects: string[] = [];
  const result = { data: rows };
  const builder = {
    select(columns: string) {
      selects.push(columns);
      return builder;
    },
    eq: () => builder,
    order: () => result,
  };
  return { selects, client: { from: () => builder } as never };
}

const row = {
  id: 1,
  payment_id: 99,
  qr_token: "tok",
  PAYMENT: { status: "paid", paid_at: "2026-08-01T00:00:00Z" },
  EVENT: { title: "Alpha" },
};

describe("ticket list payload", () => {
  // The tickets page renders payment status and the QR straight off these rows.
  // If either stops arriving the page silently loses a field, so this is the
  // test that keeps the per-card request deleted.
  it("carries the payment embed for a user's own tickets", async () => {
    const { selects, client } = recordingClient([row]);

    const tickets = await ticketDao.listByUser(client, 5);

    expect(selects[0]).toContain("PAYMENT(status, paid_at)");
    expect(tickets[0].PAYMENT).toEqual({ status: "paid", paid_at: "2026-08-01T00:00:00Z" });
  });

  it("carries the payment embed for the staff listing too", async () => {
    const { selects, client } = recordingClient([row]);

    const tickets = await ticketDao.listAll(client);

    expect(selects[0]).toContain("PAYMENT(status, paid_at)");
    expect(tickets[0].PAYMENT).not.toBeNull();
  });

  it("keeps the event embed both lists already relied on", async () => {
    const { selects, client } = recordingClient([row]);

    await ticketDao.listByUser(client, 5);

    expect(selects[0]).toContain("EVENT(title");
  });

  it("returns an empty list rather than null when the query yields nothing", async () => {
    const { client } = recordingClient([]);

    await expect(ticketDao.listAll(client)).resolves.toEqual([]);
  });
});

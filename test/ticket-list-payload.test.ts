import { describe, it, expect } from "vitest";
import * as ticketDao from "@/shared/db/dao/ticket.dao";
import { fakePostgrest } from "./helpers/fake-postgrest";

const row = {
  id: 1,
  payment_id: 99,
  qr_token: "tok",
  EVENT: { title: "Alpha" },
};

describe("ticket list payload", () => {
  // The tickets page renders EVENT details and the QR (token) straight off
  // these rows. If either stops arriving the page silently loses a field, so
  // this is the test that keeps the per-card request deleted.
  it("leaves payment bookkeeping out but still carries the token for a user's own tickets", async () => {
    const { client, selects } = fakePostgrest([row]);

    const { data: tickets } = await ticketDao.listByUser(client, 5);

    // Issue #240 dropped the PAYMENT embed from the card payload.
    expect(selects[0]).not.toContain("PAYMENT(");
    expect(tickets[0].qr_token).toBe("tok");
  });

  it("leaves payment bookkeeping out of the staff listing too", async () => {
    const { client, selects } = fakePostgrest([row]);

    const { data: tickets } = await ticketDao.listAll(client);

    expect(selects[0]).not.toContain("PAYMENT(");
    expect(tickets[0].qr_token).toBe("tok");
  });

  it("keeps the event embed both lists already relied on", async () => {
    const { client, selects } = fakePostgrest([row]);

    await ticketDao.listByUser(client, 5);

    expect(selects[0]).toContain("EVENT(title");
  });

  it("returns an empty list rather than null when the query yields nothing", async () => {
    const { client } = fakePostgrest([]);

    await expect(ticketDao.listAll(client)).resolves.toEqual({ data: [], total: 0, page: 1, limit: 50 });
  });
});

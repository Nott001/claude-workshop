// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { TicketPass } from "@/modules/commerce/components/ticket-pass";
import type { TicketWithEvent } from "@/shared/db/dao/ticket.dao";

afterEach(cleanup);

/** What tickets issued before #240 still carry: 64 hex characters, in one
 *  unbroken run with nowhere for the layout to wrap. */
const LEGACY_TOKEN = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";

const ticket = (qr_token: string) =>
  ({
    id: 1,
    qr_token,
    status: "issued",
    issued_at: "2026-05-01T00:00:00Z",
    checked_in_at: null,
    EVENT: {
      id: 7,
      title: "Live QA Workshop",
      event_date: "2026-05-01",
      start_time: "09:00",
      end_time: "12:00",
      venue_name: "Startup Lab",
      venue_address: null,
    },
  }) as unknown as TicketWithEvent;

describe("ticket check-in code", () => {
  it("lets a long code wrap instead of leaving the ticket", () => {
    render(<TicketPass ticket={ticket(LEGACY_TOKEN)} />);

    // jsdom does no layout, so the guarantee is asserted on the rule that
    // provides it. #240 shortened new tokens to six characters but never
    // rewrote the tickets already holding sixty-four, and one of those measured
    // 896px inside a 256px pass — the reported "code extends outside the box".
    const code = screen.getByText(LEGACY_TOKEN);
    expect(code.className).toContain("break-all");
  });

  it("still shows the code itself, which is the fallback when a camera fails", () => {
    render(<TicketPass ticket={ticket("a3f9c1")} />);

    expect(screen.getByText("a3f9c1")).toBeTruthy();
  });
});

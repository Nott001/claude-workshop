// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PasswordRequirements } from "@/modules/auth/components/password-requirements";
import { evaluatePassword } from "@/shared/lib/password-policy";

afterEach(cleanup);

describe("PasswordRequirements", () => {
  it("stays out of the way until there is something to judge", () => {
    const { container } = render(<PasswordRequirements password="" />);

    expect(container.textContent).toBe("");
  });

  it("lists every rule the policy defines, rather than its own copy of them", () => {
    render(<PasswordRequirements password="abc" />);

    for (const rule of evaluatePassword("abc").rules) {
      expect(screen.getByText(rule.label)).toBeTruthy();
    }
  });

  it("counts the met rules for a screen reader instead of announcing the whole list", () => {
    render(<PasswordRequirements password="the quiet kettle sings" />);

    expect(screen.getByRole("status").textContent).toBe("5 of 5 password requirements met.");
  });

  it("reports progress on a password that only fails on length", () => {
    render(<PasswordRequirements password="kettle" />);

    expect(screen.getByRole("status").textContent).toBe("4 of 5 password requirements met.");
  });

  it("reflects the account context it is given", () => {
    render(<PasswordRequirements password="adalovelace tea" context={{ fullName: "Ada Lovelace" }} />);

    expect(screen.getByRole("status").textContent).toBe("4 of 5 password requirements met.");
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MessageComposer } from "@/modules/chat/components/message-composer";

afterEach(cleanup);

describe("MessageComposer", () => {
  it("submits the current value through onSend", () => {
    const onSend = vi.fn();
    render(<MessageComposer value="hello" onChange={vi.fn()} onSend={onSend} sending={false} error={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("locks the send button while the value is empty or while sending", () => {
    const { rerender } = render(<MessageComposer value="" onChange={vi.fn()} onSend={vi.fn()} sending={false} error={null} />);
    expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true);

    rerender(<MessageComposer value="text" onChange={vi.fn()} onSend={vi.fn()} sending={true} error={null} />);
    expect((screen.getByRole("button", { name: "Sending..." }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("renders the error and a custom placeholder", () => {
    render(
      <MessageComposer
        value=""
        onChange={vi.fn()}
        onSend={vi.fn()}
        sending={false}
        error="Too many messages. Please wait a moment."
        placeholder="Ask a question..."
      />,
    );

    expect(screen.getByText("Too many messages. Please wait a moment.")).toBeTruthy();
    expect(screen.getByPlaceholderText("Ask a question...")).toBeTruthy();
  });
});

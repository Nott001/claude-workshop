// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { CurrentTopicCard } from "@/modules/courses/components/current-topic-card";
import type { CurrentTopic } from "@/modules/courses/lib/current-topic";

function topic(overrides: Partial<CurrentTopic> = {}): CurrentTopic {
  return {
    lesson: {
      id: 21,
      module_id: 2,
      name: "Using Claude Projects",
      description: "Using Claude Projects",
      content_type: "link",
      content_url: "https://claude.ai/projects",
      sequence_order: 1,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    moduleName: "Applied workflows",
    startTime: "10:00:00",
    endTime: "12:00:00",
    speakerName: "Ada Lovelace",
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("CurrentTopicCard", () => {
  it("shows the current topic lesson and its module time slot", () => {
    render(
      <CurrentTopicCard
        topic={topic({ speakerName: null })}
        isStaff={false}
        settingHighlight={false}
        onClearHighlight={() => {}}
      />,
    );

    expect(screen.getByText("Current topic")).toBeTruthy();
    expect(screen.getByText("Using Claude Projects")).toBeTruthy();
    expect(screen.getByText("10:00 AM – 12:00 PM")).toBeTruthy();
  });

  it("names the topic's module speaker on the schedule badge", () => {
    render(<CurrentTopicCard topic={topic()} isStaff={false} settingHighlight={false} onClearHighlight={() => {}} />);

    expect(screen.getByText(/Ada Lovelace/)).toBeTruthy();
  });

  it("hides the speaker when the module has none", () => {
    render(
      <CurrentTopicCard
        topic={topic({ speakerName: null })}
        isStaff={false}
        settingHighlight={false}
        onClearHighlight={() => {}}
      />,
    );

    expect(screen.queryByText(/·/)).toBeNull();
  });

  it("shows the empty state when there is no topic", () => {
    render(<CurrentTopicCard topic={null} isStaff={false} settingHighlight={false} onClearHighlight={() => {}} />);

    expect(screen.getByText("No lesson is being highlighted right now.")).toBeTruthy();
    expect(screen.queryByText(/Pick a lesson below/)).toBeNull();
  });

  it("hints staff to pick a lesson from the empty state", () => {
    render(<CurrentTopicCard topic={null} isStaff settingHighlight={false} onClearHighlight={() => {}} />);

    expect(screen.getByText("Pick a lesson below to point everyone to it.")).toBeTruthy();
  });

  it("shows the clear-highlight control to staff only", () => {
    const { rerender } = render(
      <CurrentTopicCard topic={topic()} isStaff={false} settingHighlight={false} onClearHighlight={() => {}} />,
    );
    expect(screen.queryByRole("button", { name: "Clear highlight" })).toBeNull();

    rerender(<CurrentTopicCard topic={topic()} isStaff settingHighlight={false} onClearHighlight={() => {}} />);
    expect(screen.getByRole("button", { name: "Clear highlight" })).toBeTruthy();
  });

  it("calls onClearHighlight when staff clears, disabled while setting", () => {
    const onClear = vi.fn();
    const { rerender } = render(
      <CurrentTopicCard topic={topic()} isStaff settingHighlight={false} onClearHighlight={onClear} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear highlight" }));
    expect(onClear).toHaveBeenCalledTimes(1);

    rerender(<CurrentTopicCard topic={topic()} isStaff settingHighlight onClearHighlight={onClear} />);
    expect((screen.getByRole("button", { name: "Clear highlight" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("renders the muted description under the name when showDescription is set", () => {
    render(
      <CurrentTopicCard
        topic={topic({ lesson: { ...topic().lesson, description: "Hands-on with Claude" } })}
        isStaff={false}
        settingHighlight={false}
        onClearHighlight={() => {}}
        showDescription
      />,
    );

    const description = screen.getByText("Hands-on with Claude");
    expect(description).toBeTruthy();
    expect(description.className).toContain("text-muted-fg");
  });

  it("hides a present description without showDescription", () => {
    render(
      <CurrentTopicCard
        topic={topic({ lesson: { ...topic().lesson, description: "Hands-on with Claude" } })}
        isStaff={false}
        settingHighlight={false}
        onClearHighlight={() => {}}
      />,
    );

    expect(screen.getByText("Using Claude Projects")).toBeTruthy();
    expect(screen.queryByText("Hands-on with Claude")).toBeNull();
  });

  it("renders no description line when showDescription is set but the lesson has none", () => {
    render(
      <CurrentTopicCard
        topic={topic({ lesson: { ...topic().lesson, description: null } })}
        isStaff={false}
        settingHighlight={false}
        onClearHighlight={() => {}}
        showDescription
      />,
    );

    expect(screen.getByText("Using Claude Projects")).toBeTruthy();
    expect(screen.getAllByText("Using Claude Projects")).toHaveLength(1);
  });
});

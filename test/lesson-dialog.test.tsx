// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { LessonDialog } from "@/modules/courses/components/lesson-dialog";

afterEach(() => {
  cleanup();
});

function renderDialog(
  options: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    onAddLesson?: (data: { name: string; description: string; file: File | null; url: string }) => Promise<string | null>;
  } = {},
) {
  const onOpenChange = options.onOpenChange ?? vi.fn();
  const onAddLesson = options.onAddLesson ?? vi.fn(async () => null);
  render(<LessonDialog open={options.open ?? true} onOpenChange={onOpenChange} onAddLesson={onAddLesson} />);
  return { onOpenChange, onAddLesson };
}

function form() {
  return document.querySelector("form") as HTMLFormElement;
}

function fileInput() {
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

describe("LessonDialog", () => {
  it("renders the name, description, file, and URL fields when open", () => {
    renderDialog();

    expect(screen.getByPlaceholderText("e.g. Introduction to the topic")).toBeTruthy();
    expect(screen.getByPlaceholderText("e.g. A short walkthrough of the platform")).toBeTruthy();
    expect(screen.getByText("Upload file")).toBeTruthy();
    expect(screen.getByPlaceholderText("https://...")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Add lesson/ })).toBeTruthy();
  });

  it("renders nothing when closed", () => {
    renderDialog({ open: false });

    expect(screen.queryByPlaceholderText("e.g. Introduction to the topic")).toBeNull();
  });

  it("submits name, trimmed description, and url, then closes", async () => {
    const { onAddLesson, onOpenChange } = renderDialog();

    fireEvent.change(screen.getByPlaceholderText("e.g. Introduction to the topic"), { target: { value: "  Intro  " } });
    fireEvent.change(screen.getByPlaceholderText("e.g. A short walkthrough of the platform"), {
      target: { value: " A quick start " },
    });
    fireEvent.change(screen.getByPlaceholderText("https://..."), { target: { value: "https://example.com/v" } });
    fireEvent.click(screen.getByRole("button", { name: /Add lesson/ }));

    await waitFor(() =>
      expect(onAddLesson).toHaveBeenCalledWith({
        name: "Intro",
        description: "A quick start",
        file: null,
        url: "https://example.com/v",
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("returns early without an add when the name is blank", () => {
    const { onAddLesson } = renderDialog();

    fireEvent.submit(form());

    expect(onAddLesson).not.toHaveBeenCalled();
  });

  it("returns early without an add when there is neither file nor url", () => {
    const { onAddLesson } = renderDialog();

    fireEvent.change(screen.getByPlaceholderText("e.g. Introduction to the topic"), { target: { value: "Intro" } });
    fireEvent.submit(form());

    expect(onAddLesson).not.toHaveBeenCalled();
  });

  it("shows the add error and keeps the dialog open", async () => {
    const onAddLesson = vi.fn(async () => "Could not store file");
    const { onOpenChange } = renderDialog({ onAddLesson });

    fireEvent.change(screen.getByPlaceholderText("e.g. Introduction to the topic"), { target: { value: "Intro" } });
    fireEvent.change(screen.getByPlaceholderText("https://..."), { target: { value: "https://example.com/v" } });
    fireEvent.click(screen.getByRole("button", { name: /Add lesson/ }));

    expect(await screen.findByText("Could not store file")).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("shows Uploading... until the add resolves, then closes", async () => {
    let resolve!: (value: string | null) => void;
    const onAddLesson = vi.fn(() => new Promise<string | null>((r) => (resolve = r)));
    const { onOpenChange } = renderDialog({ onAddLesson });

    fireEvent.change(screen.getByPlaceholderText("e.g. Introduction to the topic"), { target: { value: "Intro" } });
    fireEvent.change(screen.getByPlaceholderText("https://..."), { target: { value: "https://example.com/v" } });
    fireEvent.click(screen.getByRole("button", { name: /Add lesson/ }));

    expect(await screen.findByText("Uploading...")).toBeTruthy();

    resolve(null);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("shows the picked file's name and lets a pasted url override it", () => {
    const { onAddLesson } = renderDialog();
    const file = new File(["body"], "notes.pdf", { type: "application/pdf" });

    fireEvent.change(fileInput(), { target: { files: [file] } });
    expect(screen.getByText("Selected: notes.pdf")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("https://..."), { target: { value: "https://example.com/v" } });
    expect(screen.queryByText("Selected: notes.pdf")).toBeNull();

    fireEvent.change(screen.getByPlaceholderText("e.g. Introduction to the topic"), { target: { value: "Intro" } });
    fireEvent.click(screen.getByRole("button", { name: /Add lesson/ }));
    expect(onAddLesson).toHaveBeenCalledWith({
      name: "Intro",
      description: "",
      file: null,
      url: "https://example.com/v",
    });
  });

  it("cancels through onOpenChange(false)", () => {
    const { onOpenChange } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

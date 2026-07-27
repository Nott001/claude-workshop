"use client";

export function DeleteConfirmModal({
  show,
  deleteConfirmText,
  onConfirmTextChange,
  onConfirm,
  onCancel,
  deleting,
}: {
  show: boolean;
  deleteConfirmText: string;
  onConfirmTextChange: (text: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay">
      <div className="mx-4 w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-lg">
        <div className="mb-4 flex items-center gap-3">
          <span className="material-symbols-rounded text-2xl text-error">warning</span>
          <h3 className="text-sm font-semibold text-fg">Delete event</h3>
        </div>
        <p className="mb-2 text-sm text-muted-fg">
          This event has existing payments. Deleting it will also remove all associated data, including payments, tickets, and
          chat messages. This action <strong>cannot be undone</strong>.
        </p>
        <p className="mb-4 text-sm text-muted-fg">
          Type <strong>understood</strong> to confirm.
        </p>
        <input
          type="text"
          value={deleteConfirmText}
          onChange={(e) => onConfirmTextChange(e.target.value)}
          placeholder='type "understood"'
          className="mb-4 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg outline-none focus:border-red-400"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-xs font-medium text-fg transition-colors hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleteConfirmText !== "understood" || deleting}
            className="rounded-lg bg-error/100 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-error disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete event"}
          </button>
        </div>
      </div>
    </div>
  );
}

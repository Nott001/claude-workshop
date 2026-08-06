"use client";

import { Button } from "@/shared/components/button";

interface MessageComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  sending: boolean;
  error: string | null;
}

export function MessageComposer({ value, onChange, onSend, sending, error }: MessageComposerProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
      className="shrink-0 border-t border-border px-4 py-3"
    >
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type a message..."
          maxLength={1000}
          className="min-w-0 flex-1 rounded-lg border border-border px-3 py-2 text-sm text-fg outline-none placeholder:text-muted-fg focus:border-brand focus:ring-2 focus:ring-ring/20"
        />
        <Button type="submit" size="sm" disabled={sending || !value.trim()}>
          {sending ? "Sending..." : "Send"}
        </Button>
      </div>
      {error && <p className="mt-1.5 text-xs text-error">{error}</p>}
    </form>
  );
}

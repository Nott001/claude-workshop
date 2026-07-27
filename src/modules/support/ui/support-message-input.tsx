"use client";

import { useState } from "react";

interface SupportMessageInputProps {
  sessionActive: boolean;
  sending: boolean;
  error: string | null;
  onSend: (text: string) => void;
}

export function SupportMessageInput({ sessionActive, sending, error, onSend }: SupportMessageInputProps) {
  const [text, setText] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending || !sessionActive) return;
    onSend(text.trim());
    setText("");
  }

  return (
    <form onSubmit={handleSubmit} className="shrink-0 border-t border-border bg-surface px-6 py-4">
      <div className="mx-auto flex max-w-2xl gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={sessionActive ? "Type a reply..." : "This conversation has ended."}
          maxLength={1000}
          disabled={!sessionActive}
          className="min-w-0 flex-1 rounded-lg border border-border px-3 py-2 text-sm text-fg outline-none placeholder:text-muted-fg focus:border-brand focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={sending || !text.trim() || !sessionActive}
          className="flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand/80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? (
            <div className="size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <>
              <span className="material-symbols-rounded text-sm">send</span>
              Send
            </>
          )}
        </button>
      </div>
      {error && <p className="mx-auto mt-1.5 max-w-2xl text-xs text-error">{error}</p>}
    </form>
  );
}

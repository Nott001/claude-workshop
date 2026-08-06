"use client";

import type { CaseSummary, ChatMessageWithUser } from "@/modules/chat/lib/use-support-cases";
import { CaseDetailHeader } from "./case-detail-header";
import { MessageList } from "./message-list";
import { MessageComposer } from "./message-composer";

interface CaseDetailProps {
  caseRow: CaseSummary;
  messages: ChatMessageWithUser[];
  loadingMessages: boolean;
  currentUserId: number | null;
  isOwner: boolean;
  isUnclaimed: boolean;
  acting: boolean;
  actionError: string | null;
  error: string | null;
  newMessage: string;
  sending: boolean;
  onChangeMessage: (value: string) => void;
  onClaim: () => void;
  onRelinquish: () => void;
  onEnd: () => void;
  onSend: () => void;
}

export function CaseDetail({
  caseRow,
  messages,
  loadingMessages,
  currentUserId,
  isOwner,
  isUnclaimed,
  acting,
  actionError,
  error,
  newMessage,
  sending,
  onChangeMessage,
  onClaim,
  onRelinquish,
  onEnd,
  onSend,
}: CaseDetailProps) {
  return (
    <>
      <CaseDetailHeader
        caseRow={caseRow}
        isOwner={isOwner}
        isUnclaimed={isUnclaimed}
        currentUserId={currentUserId}
        acting={acting}
        onClaim={onClaim}
        onRelinquish={onRelinquish}
        onEnd={onEnd}
      />

      {actionError && <p className="shrink-0 border-b border-border px-4 py-2 text-xs text-error">{actionError}</p>}

      {caseRow.assigned_to !== null && caseRow.assigned_to !== currentUserId && (
        <p className="shrink-0 border-b border-border bg-muted/50 px-4 py-2 text-xs text-muted-fg">
          This case is being handled by {caseRow.assigned_name ?? "another staff member"}.
        </p>
      )}

      <MessageList messages={messages} loading={loadingMessages} currentUserId={currentUserId} />

      {isOwner ? (
        <MessageComposer value={newMessage} onChange={onChangeMessage} onSend={onSend} sending={sending} error={error} />
      ) : isUnclaimed ? (
        <p className="shrink-0 border-t border-border px-4 py-3 text-center text-xs text-muted-fg">
          Claim this case to start replying.
        </p>
      ) : null}
    </>
  );
}

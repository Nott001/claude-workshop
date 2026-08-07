"use client";

import { useSupportCases } from "@/modules/chat/lib/use-support-cases";
import { CaseList } from "./case-list";
import { CaseDetail } from "./case-detail";

export default function StaffSupportInbox() {
  const q = useSupportCases();
  const isOwner = q.selected !== null && q.selected.assigned_to === q.currentUserId;
  const isUnclaimed = q.selected !== null && q.selected.assigned_to === null;

  return (
    <div className="flex overflow-hidden rounded-xl border border-border" style={{ height: "600px" }}>
      <CaseList
        cases={q.cases}
        loading={q.loadingCases}
        selectedId={q.selected?.id ?? null}
        currentUserId={q.currentUserId}
        onSelect={q.openCase}
      />
      <section className="flex min-w-0 flex-1 flex-col">
        {!q.selected ? (
          <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-fg">
            Select a case on the left to open it.
          </div>
        ) : (
          <CaseDetail
            caseRow={q.selected}
            messages={q.messages}
            loadingMessages={q.loadingMessages}
            currentUserId={q.currentUserId}
            isOwner={isOwner}
            isUnclaimed={isUnclaimed}
            acting={q.acting}
            actionError={q.actionError}
            error={q.error}
            newMessage={q.newMessage}
            sending={q.sending}
            onChangeMessage={q.setNewMessage}
            onClaim={q.claimCase}
            onRelinquish={q.relinquishCase}
            onEnd={q.endCase}
            onSend={q.sendMessage}
          />
        )}
      </section>
    </div>
  );
}

"use client";

import { SupportUserList } from "@/modules/support/ui/support-user-list";
import { SupportChatHeader } from "@/modules/support/ui/support-chat-header";
import { SupportMessageList } from "@/modules/support/ui/support-message-list";
import { SupportMessageInput } from "@/modules/support/ui/support-message-input";
import { useSupportChat } from "@/modules/support/lib/use-support-chat";

export default function SupportPage() {
  const {
    users,
    usersLoaded,
    selectedUserId,
    setSelectedUserId,
    selectedUser,
    sessionActive,
    allMessages,
    currentUserId,
    messagesLoading,
    sending,
    error,
    endingChat,
    deletingChat,
    handleSend,
    handleEndChat,
    handleDeleteChat,
  } = useSupportChat();

  return (
    <div className="flex h-full">
      <div className="flex w-[280px] flex-col border-r border-border bg-surface">
        <div className="flex shrink-0 items-center border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-fg">Support Inbox</span>
        </div>
        <SupportUserList
          users={users}
          selectedUserId={selectedUserId}
          loading={!usersLoaded}
          onSelectUser={setSelectedUserId}
        />
      </div>

      <div className="flex flex-1 flex-col bg-muted">
        {selectedUserId == null ? (
          <div className="flex flex-1 items-center justify-center p-4">
            <p className="text-sm text-muted-fg">Select a conversation to view messages.</p>
          </div>
        ) : (
          <>
            <SupportChatHeader
              user={selectedUser}
              sessionActive={sessionActive}
              endingChat={endingChat}
              deletingChat={deletingChat}
              onEndChat={handleEndChat}
              onDeleteChat={handleDeleteChat}
            />
            <SupportMessageList messages={allMessages} currentUserId={currentUserId} loading={messagesLoading} />
            <SupportMessageInput sessionActive={sessionActive} sending={sending} error={error} onSend={handleSend} />
          </>
        )}
      </div>
    </div>
  );
}

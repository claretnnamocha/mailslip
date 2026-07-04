"use client";

import { useMailStore } from "@/stores/mail-store";
import { cn, formatMessageDate, initials } from "@/lib/utils";
import { PaperclipIcon, StarIcon } from "./icons";
import { useTheme } from "@/components/theme-provider";

export function MessageList({ onSelect }: { onSelect?: () => void }) {
  const {
    messages,
    selectedId,
    setSelectedId,
    loadingList,
    folder,
    activeIdentityId,
    identities,
  } = useMailStore();
  const { density } = useTheme();
  const compact = density === "compact";

  const title =
    folder === "INBOX"
      ? activeIdentityId === "all"
        ? "All inboxes"
        : identities.find((i) => i.id === activeIdentityId)?.email || "Inbox"
      : folder;

  return (
    <section className="flex h-full w-full shrink-0 flex-col border-r border-border bg-surface md:w-[320px]">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
          <p className="text-[12px] text-text-3">
            {messages.filter((m) => !m.seen).length} unread
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loadingList && (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="skeleton h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3 w-1/2" />
                  <div className="skeleton h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loadingList && messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <p className="text-[15px] font-medium">All caught up</p>
            <p className="mt-1 text-[13px] text-text-2">
              Nothing in {folder === "INBOX" ? "your inbox" : folder.toLowerCase()} right now.
            </p>
          </div>
        )}

        {!loadingList &&
          messages.map((message) => {
            const active = selectedId === message.id;
            return (
              <button
                key={message.id}
                onClick={() => {
                  setSelectedId(message.id);
                  onSelect?.();
                }}
                className={cn(
                  "group flex w-full gap-3 border-b border-border text-left transition-colors duration-150",
                  compact ? "px-3 py-2.5" : "px-4 py-3.5",
                  active
                    ? "border-l-2 border-l-accent bg-accent-tint pl-[14px]"
                    : "hover:bg-hover",
                )}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-border-strong text-[11px] font-semibold text-text-2">
                  {initials(message.from.name, message.from.address)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "truncate text-[13px]",
                        message.seen ? "font-medium text-text" : "font-semibold text-text",
                      )}
                    >
                      {message.from.name || message.from.address}
                    </span>
                    <span className="ml-auto shrink-0 text-[11px] text-text-3">
                      {formatMessageDate(message.date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "truncate text-[12.5px]",
                        message.seen ? "text-text-2" : "font-medium text-text",
                      )}
                    >
                      {message.subject}
                    </span>
                    {!message.seen && (
                      <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="truncate text-[12px] text-text-3">{message.snippet}</span>
                    {message.hasAttachments && (
                      <PaperclipIcon size={12} className="shrink-0 text-text-3" />
                    )}
                    {message.flagged && (
                      <StarIcon size={12} className="shrink-0 text-accent" />
                    )}
                  </div>
                  {activeIdentityId === "all" && message.identityEmail && (
                    <span
                      className="mt-1 inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-medium mono"
                      style={{
                        color: message.identityColor || "var(--accent)",
                        background: "var(--accent-tint)",
                      }}
                    >
                      {message.identityEmail}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
      </div>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useMailStore } from "@/stores/mail-store";
import { cn, formatMessageDate, initials } from "@/lib/utils";
import { buildFolderTree, folderRole, groupedUnseen, type FolderNode } from "@/lib/mail/folder-map";
import { displaySubject, groupThreads, threadParticipants, type MailThread } from "@/lib/mail/thread";
import type { MailFolder, MailMessageSummary } from "@/lib/mail/types";
import {
  ArchiveIcon,
  BanIcon,
  ChevronIcon,
  EditIcon,
  FolderIcon,
  InboxIcon,
  PaperclipIcon,
  SendIcon,
  StarIcon,
  TrashIcon,
} from "./icons";
import { useTheme } from "@/components/theme-provider";

function folderIcon(folder: MailFolder) {
  switch (folderRole(folder)) {
    case "inbox":
      return InboxIcon;
    case "sent":
      return SendIcon;
    case "drafts":
      return EditIcon;
    case "archive":
      return ArchiveIcon;
    case "junk":
      return BanIcon;
    case "trash":
      return TrashIcon;
    default:
      return FolderIcon;
  }
}

export function MessageList({
  query = "",
  onSelect,
}: {
  query?: string;
  onSelect?: () => void;
}) {
  const {
    messages,
    selectedId,
    setSelectedId,
    closeMessage,
    loadingList,
    folder,
    setFolder,
    folders,
    foldersReady,
    activeIdentityId,
    identities,
  } = useMailStore();
  const { density } = useTheme();
  const compact = density === "compact";
  const [openPaths, setOpenPaths] = useState<string[]>([]);
  const [mailByFolder, setMailByFolder] = useState<Record<string, MailMessageSummary[]>>({});
  const seededFor = useRef<string | null>(null);
  const searching = query.trim().length > 0;
  const tree = buildFolderTree(folders);

  useEffect(() => {
    setOpenPaths([]);
    setMailByFolder({});
    seededFor.current = null;
  }, [activeIdentityId]);

  useEffect(() => {
    if (!foldersReady || folders.length === 0 || seededFor.current === activeIdentityId) return;
    const inbox = folders.find((item) => folderRole(item) === "inbox") || folders[0];
    if (!inbox) return;
    seededFor.current = activeIdentityId;
    setOpenPaths([inbox.path]);
    if (folder !== inbox.path) setFolder(inbox.path);
  }, [folders, foldersReady, folder, activeIdentityId, setFolder]);

  useEffect(() => {
    if (searching || loadingList) return;
    if (messages.some((message) => message.folder !== folder)) return;
    setMailByFolder((prev) => ({ ...prev, [folder]: messages }));
  }, [folder, messages, loadingList, searching]);

  function toggleFolder(item: MailFolder) {
    const willOpen = !openPaths.includes(item.path);
    setOpenPaths((prev) =>
      prev.includes(item.path) ? prev.filter((path) => path !== item.path) : [...prev, item.path],
    );
    if (willOpen && item.selectable !== false && item.path !== folder) setFolder(item.path);
  }

  return (
    <section className="flex h-full w-full shrink-0 flex-col border-r border-border bg-surface md:w-[380px]">
      <div className="flex-1 overflow-y-auto">
        {!foldersReady && !searching && (
          <div className="space-y-2 p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-9 w-full rounded-[10px]" />
            ))}
          </div>
        )}

        {foldersReady && !searching && tree.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <p className="text-[15px] font-medium">No folders</p>
            <p className="mt-1 text-[13px] text-text-2">
              {identities.find((identity) => identity.id === activeIdentityId)?.email || "This mailbox"} did
              not list any folders.
            </p>
          </div>
        )}

        {searching && (
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Search</h2>
            <p className="text-[12px] text-text-3">{messages.length} found</p>
          </div>
        )}

        {searching && loadingList && <ListSkeleton />}

        {searching &&
          !loadingList &&
          groupThreads(messages).map((thread) => (
            <MessageRow
              key={thread.id}
              thread={thread}
              active={thread.messages.some((message) => message.id === selectedId)}
              compact={compact}
              onClick={() => openMessage(thread.latest)}
            />
          ))}

        {searching && !loadingList && messages.length === 0 && (
          <div className="px-6 py-10 text-center">
            <p className="text-[15px] font-medium">No matches</p>
          </div>
        )}

        {!searching &&
          tree.map((node) => (
            <FolderBranch
              key={node.folder.path}
              node={node}
              depth={0}
              openPaths={openPaths}
              mailByFolder={mailByFolder}
              loadingPath={loadingList ? folder : null}
              selectedId={selectedId}
              compact={compact}
              onToggle={toggleFolder}
              onOpenMessage={openMessage}
            />
          ))}
      </div>
    </section>
  );

  function openMessage(message: MailMessageSummary) {
    if (message.id === selectedId) {
      closeMessage();
      return;
    }
    setSelectedId(message.id);
    onSelect?.();
  }
}

function FolderBranch({
  node,
  depth,
  openPaths,
  mailByFolder,
  loadingPath,
  selectedId,
  compact,
  onToggle,
  onOpenMessage,
}: {
  node: FolderNode<MailFolder>;
  depth: number;
  openPaths: string[];
  mailByFolder: Record<string, MailMessageSummary[]>;
  loadingPath: string | null;
  selectedId: string | null;
  compact: boolean;
  onToggle: (folder: MailFolder) => void;
  onOpenMessage: (message: MailMessageSummary) => void;
}) {
  const open = openPaths.includes(node.folder.path);
  const Icon = folderIcon(node.folder);
  const count = groupedUnseen(node);
  const mail = mailByFolder[node.folder.path];
  const loading = open && loadingPath === node.folder.path && !mail;
  const selectable = node.folder.selectable !== false;

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onToggle(node.folder)}
        className="flex w-full items-center gap-2 py-2 pr-3 text-left text-[13.5px] font-medium text-text hover:bg-hover"
        style={{ paddingLeft: 12 + depth * 14 }}
        title={node.folder.path}
      >
        <ChevronIcon
          size={14}
          className={cn("shrink-0 text-text-3 transition-transform", open && "rotate-90")}
        />
        <Icon size={16} className="shrink-0 text-text-2" />
        <span className="truncate">{node.folder.name}</span>
        {count > 0 && (
          <span className="ml-auto min-w-5 shrink-0 rounded-full bg-accent-tint px-1.5 text-center text-[11px] font-semibold tabular-nums text-text">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div>
          {node.children.map((child) => (
            <FolderBranch
              key={child.folder.path}
              node={child}
              depth={depth + 1}
              openPaths={openPaths}
              mailByFolder={mailByFolder}
              loadingPath={loadingPath}
              selectedId={selectedId}
              compact={compact}
              onToggle={onToggle}
              onOpenMessage={onOpenMessage}
            />
          ))}
          {selectable && loading && <ListSkeleton />}
          {selectable &&
            groupThreads(mail || []).map((thread) => (
              <MessageRow
                key={thread.id}
                thread={thread}
                active={thread.messages.some((message) => message.id === selectedId)}
                compact={compact}
                indent={depth + 1}
                onClick={() => onOpenMessage(thread.latest)}
              />
            ))}
          {selectable && mail && mail.length === 0 && !loading && (
            <p
              className="py-2 text-[12px] text-text-3"
              style={{ paddingLeft: 28 + (depth + 1) * 14 }}
            >
              No messages
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function MessageRow({
  thread,
  active,
  compact,
  indent = 0,
  onClick,
}: {
  thread: MailThread<MailMessageSummary>;
  active: boolean;
  compact: boolean;
  indent?: number;
  onClick: () => void;
}) {
  const message = thread.latest;
  const seen = thread.messages.every((item) => item.seen);
  const count = thread.messages.length;
  const people = threadParticipants(thread.messages);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full gap-3 border-b border-border text-left transition-colors duration-150",
        compact ? "py-2.5 pr-3" : "py-3.5 pr-3",
        active ? "border-l-2 border-l-accent bg-accent-tint" : "hover:bg-hover",
      )}
      style={{ paddingLeft: 16 + indent * 14 }}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-border-strong text-[11px] font-semibold text-text-2">
        {initials(message.from.name, message.from.address)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "min-w-0 truncate text-[13px]",
              seen ? "font-medium text-text" : "font-semibold text-text",
            )}
          >
            {people}
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-1.5">
            {thread.messages.some((item) => item.hasAttachments) && (
              <PaperclipIcon size={12} className="text-text-3" />
            )}
            {count > 1 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-border-strong px-1 text-[11px] font-semibold tabular-nums text-text-2">
                {count}
              </span>
            )}
            <span className="text-[11px] text-text-3">{formatMessageDate(message.date)}</span>
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span
            className={cn(
              "truncate text-[12.5px]",
              seen ? "text-text-2" : "font-medium text-text",
            )}
          >
            {displaySubject(message.subject)}
          </span>
          {!seen && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="truncate text-[12px] text-text-3">{message.snippet}</span>
          {thread.messages.some((item) => item.flagged) && (
            <StarIcon size={12} className="shrink-0 text-accent" />
          )}
        </div>
      </div>
    </button>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <div className="skeleton h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-1/2" />
            <div className="skeleton h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

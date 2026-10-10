"use client";

import { useEffect, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent } from "react";
import { useRouter } from "next/navigation";
import { useMailStore } from "@/stores/mail-store";
import { useDialog } from "@/components/dialog-provider";
import { Menu, useMenu } from "@/components/ui/menu";
import {
  blockSender,
  createMailbox,
  emptyMailbox,
  getFavoritePaths,
  getFlagColor,
  getListPrefs,
  getMutedThreadIds,
  markFolderRead,
  moveTargets,
  setFlagged,
  setListPrefs,
  setSeen,
  snoozeTarget,
  toggleFavoritePath,
  toggleMutedThread,
  FLAG_COLORS,
  type FlagColor,
  type ListPrefs,
} from "@/lib/mail/client-actions";
import {
  buildFolderMenuItems,
  buildListMoreItems,
  buildMessageMenuItems,
} from "./mail-menus";
import { cn, formatMessageDate, initials } from "@/lib/utils";
import { buildFolderTree, folderRole, groupedScopedUnseen, type FolderNode } from "@/lib/mail/folder-map";
import {
  displaySubject,
  groupThreads,
  threadContaining,
  threadParticipants,
  type MailThread,
} from "@/lib/mail/thread";
import { toast } from "sonner";
import type { MailFolder, MailMessageSummary } from "@/lib/mail/types";
import {
  ArchiveIcon,
  BanIcon,
  ChevronIcon,
  EditIcon,
  FilterIcon,
  FlagIcon,
  FolderIcon,
  InboxIcon,
  MoreIcon,
  PaperclipIcon,
  SendIcon,
  StarIcon,
  TrashIcon,
} from "./icons";
import { useTheme } from "@/components/theme-provider";

const DRAG_MIME = "application/x-mailslip-mail";

type MailDragPayload = {
  sourceFolder: string;
  messageIds: string[];
  moves: { uid: number; remoteId?: string; identityId: string; folder: string }[];
};

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

function threadsForList(
  mail: MailMessageSummary[],
  unreadOnly: boolean,
  mutedIds: string[] = [],
) {
  let threads = groupThreads(mail);
  if (mutedIds.length > 0) {
    const muted = new Set(mutedIds);
    threads = threads.filter((thread) => !muted.has(thread.id));
  }
  if (!unreadOnly) return threads;
  return threads.filter((thread) => thread.messages.some((message) => !message.seen));
}

type RowMenuHandler = (
  e: ReactMouseEvent,
  thread: MailThread<MailMessageSummary>,
  message: MailMessageSummary,
  subRow: boolean,
) => void;

type FolderMenuHandler = (e: ReactMouseEvent, folder: MailFolder) => void;

function flagSwatch(color: FlagColor) {
  return FLAG_COLORS.find((item) => item.id === color)?.swatch;
}

export function MessageList({
  query = "",
  unreadOnly = false,
  onUnreadChange,
  onSync,
  onSelect,
}: {
  query?: string;
  unreadOnly?: boolean;
  onUnreadChange?: (value: boolean) => void;
  onSync?: () => void;
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
    setMessages,
    openCompose,
  } = useMailStore();
  const { density } = useTheme();
  const router = useRouter();
  const { prompt, confirm } = useDialog();
  const menu = useMenu();
  const compact = density === "compact";
  const [listPrefs, setListPrefsState] = useState<ListPrefs>({
    showContactPhoto: true,
    showMailCategories: false,
  });
  const [favorites, setFavorites] = useState<string[]>([]);
  const [mutedIds, setMutedIds] = useState<string[]>([]);
  const [showMuted, setShowMuted] = useState(false);
  const [, setFlagTick] = useState(0);
  const [openPaths, setOpenPaths] = useState<string[]>([]);
  const [openThreadIds, setOpenThreadIds] = useState<string[]>([]);
  const [mailByFolder, setMailByFolder] = useState<Record<string, MailMessageSummary[]>>({});
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const seededFor = useRef<string | null>(null);
  const searching = query.trim().length > 0;
  const tree = buildFolderTree(folders);
  const hiddenMuted = showMuted ? [] : mutedIds;
  const searchThreads = threadsForList(messages, unreadOnly, hiddenMuted);
  const activeIdentity = identities.find((identity) => identity.id === activeIdentityId);
  const identityEmail = activeIdentity?.email || identities[0]?.email || "";
  const mailIdentityId = activeIdentityId !== "all" ? activeIdentityId : identities[0]?.id || "";
  const currentFolder = folders.find((item) => item.path === folder);
  const folderTitle = currentFolder?.name || (folder === "INBOX" ? "Inbox" : folder);
  const unreadCount = messages.filter((message) => !message.seen).length;
  const mutedInFolder = groupThreads(messages).filter((thread) => mutedIds.includes(thread.id)).length;

  useEffect(() => {
    setListPrefsState(getListPrefs());
    setFavorites(getFavoritePaths());
    setMutedIds(getMutedThreadIds());
  }, []);

  useEffect(() => {
    setOpenPaths([]);
    setOpenThreadIds([]);
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

  useEffect(() => {
    if (searching || !foldersReady) return;
    if (openPaths.length === 0) {
      closeMessage();
      setOpenThreadIds([]);
    }
  }, [openPaths, searching, foldersReady, closeMessage]);

  function toggleFolder(item: MailFolder) {
    const willOpen = !openPaths.includes(item.path);
    const prefix = `${item.path}${item.delimiter || "."}`;
    setOpenPaths((prev) =>
      willOpen
        ? [...prev, item.path]
        : prev.filter((path) => path !== item.path && !path.startsWith(prefix)),
    );
    if (willOpen && item.selectable !== false && item.path !== folder) setFolder(item.path);
  }

  function toggleThreadExpanded(threadId: string) {
    setOpenThreadIds((prev) =>
      prev.includes(threadId) ? prev.filter((id) => id !== threadId) : [...prev, threadId],
    );
  }

  function markThreadSeen(members: MailMessageSummary[]) {
    const unseen = members.filter((message) => !message.seen);
    if (unseen.length === 0) return;
    const ids = new Set(unseen.map((message) => message.id));
    setMailByFolder((prev) => {
      const next = { ...prev };
      for (const path of Object.keys(next)) {
        next[path] = next[path].map((message) =>
          ids.has(message.id) ? { ...message, seen: true } : message,
        );
      }
      return next;
    });
    if (unseen.some((message) => message.folder === folder)) {
      setMessages(
        messages.map((message) => (ids.has(message.id) ? { ...message, seen: true } : message)),
      );
    }
    void Promise.all(
      unseen.map((message) =>
        fetch(`/api/mail/messages/${message.uid}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identityId: message.identityId,
            folder: message.folder,
            remoteId: message.remoteId || String(message.uid),
            seen: true,
          }),
        }),
      ),
    );
  }

  async function moveDraggedMail(payload: MailDragPayload, destinationPath: string, destName: string) {
    if (payload.sourceFolder === destinationPath) return;
    try {
      await Promise.all(
        payload.moves.map((move) =>
          fetch(`/api/mail/messages/${move.uid}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              identityId: move.identityId,
              folder: move.folder,
              remoteId: move.remoteId || String(move.uid),
              action: "move",
              destination: destinationPath,
            }),
          }),
        ),
      );
      const removed = new Set(payload.messageIds);
      setMailByFolder((prev) => {
        const next = { ...prev };
        for (const path of Object.keys(next)) {
          next[path] = next[path].filter((message) => !removed.has(message.id));
        }
        return next;
      });
      if (folder === payload.sourceFolder) {
        setMessages(messages.filter((message) => !removed.has(message.id)));
      }
      if (selectedId && removed.has(selectedId)) closeMessage();
      if (folder === destinationPath && activeIdentityId !== "all") {
        const params = new URLSearchParams({ folder, identityId: activeIdentityId });
        const res = await fetch(`/api/mail/messages?${params}`);
        if (res.ok) setMessages(await res.json());
      }
      toast.success(`Moved to ${destName}`);
    } catch {
      toast.error("Could not move message");
    }
  }

  function dragPayloadForThread(
    thread: MailThread<MailMessageSummary>,
    sourceFolder: string,
  ): MailDragPayload {
    return {
      sourceFolder,
      messageIds: thread.messages.map((message) => message.id),
      moves: thread.messages.map((message) => ({
        uid: message.uid,
        remoteId: message.remoteId,
        identityId: message.identityId,
        folder: message.folder,
      })),
    };
  }

  function syncNow() {
    setMailByFolder((prev) => (prev[folder] ? { [folder]: prev[folder] } : {}));
    onSync?.();
  }

  function removeMessages(ids: Set<string>) {
    setMailByFolder((prev) => {
      const next = { ...prev };
      for (const path of Object.keys(next)) {
        next[path] = next[path].filter((message) => !ids.has(message.id));
      }
      return next;
    });
    setMessages(messages.filter((message) => !ids.has(message.id)));
    if (selectedId && ids.has(selectedId)) closeMessage();
  }

  function patchLocal(ids: Set<string>, patch: Partial<MailMessageSummary>) {
    setMailByFolder((prev) => {
      const next = { ...prev };
      for (const path of Object.keys(next)) {
        next[path] = next[path].map((message) =>
          ids.has(message.id) ? { ...message, ...patch } : message,
        );
      }
      return next;
    });
    setMessages(
      messages.map((message) => (ids.has(message.id) ? { ...message, ...patch } : message)),
    );
  }

  function roleDestination(role: "junk" | "trash" | "archive", fallback: string) {
    return folders.find((item) => folderRole(item) === role && item.selectable !== false)?.path || fallback;
  }

  async function moveWithToast(
    targets: MailMessageSummary[],
    destination: string,
    label: string,
  ) {
    try {
      await moveTargets(targets, destination);
      removeMessages(new Set(targets.map((message) => message.id)));
      toast.success(label);
    } catch {
      toast.error("Could not move message");
    }
  }

  async function composeFor(
    message: MailMessageSummary,
    thread: MailThread<MailMessageSummary>,
    mode: "reply" | "replyAll" | "forward",
  ) {
    const store = useMailStore.getState();
    const ready = () => {
      const state = useMailStore.getState();
      return (
        !state.loadingMessage &&
        state.selectedMessage &&
        thread.messages.some((item) => item.id === state.selectedMessage?.id)
      );
    };
    if (store.selectedId !== message.id && !ready()) setSelectedId(message.id);
    onSelect?.();
    const started = Date.now();
    while (!ready()) {
      if (Date.now() - started > 8000) {
        toast.error("Open the message first, then try again");
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    openCompose(mode);
  }

  function openMessageMenu(
    e: ReactMouseEvent,
    thread: MailThread<MailMessageSummary>,
    message: MailMessageSummary,
    subRow: boolean,
  ) {
    const targets = subRow ? [message] : thread.messages;
    const muted = mutedIds.includes(thread.id);
    const items = buildMessageMenuItems({
      thread,
      message,
      folders,
      muted,
      onOpen: () => openMessage(message, mailByFolder[message.folder]),
      onReply: () => void composeFor(message, thread, "reply"),
      onReplyAll: () => void composeFor(message, thread, "replyAll"),
      onForward: () => void composeFor(message, thread, "forward"),
      onForwardAsAttachment: () => {
        toast.message("Forwarding as an attachment isn’t available yet", {
          description: "Opening a regular forward instead.",
        });
        void composeFor(message, thread, "forward");
      },
      onSendAgain: () => toast.message("Send Again isn’t available yet"),
      onRedirect: () => {
        toast.message("Redirect isn’t available yet", {
          description: "Opening a regular forward instead.",
        });
        void composeFor(message, thread, "forward");
      },
      onRemind: async (hours) => {
        try {
          await snoozeTarget(thread.latest, new Date(Date.now() + hours * 60 * 60 * 1000));
          removeMessages(new Set(thread.messages.map((item) => item.id)));
          toast.success(
            hours < 24
              ? `Reminding you in ${hours} hour${hours === 1 ? "" : "s"}`
              : hours === 24
                ? "Reminding you tomorrow"
                : "Reminding you next week",
          );
        } catch {
          toast.error("Could not set reminder");
        }
      },
      onToggleSeen: async () => {
        const nextSeen = !targets.every((item) => item.seen);
        try {
          await setSeen(targets, nextSeen);
          patchLocal(new Set(targets.map((item) => item.id)), { seen: nextSeen });
          toast.success(nextSeen ? "Marked as read" : "Marked as unread");
        } catch {
          toast.error("Could not update message");
        }
      },
      onJunk: () => void moveWithToast(targets, roleDestination("junk", "Junk"), "Moved to Junk"),
      onMute: () => {
        setMutedIds(toggleMutedThread(thread.id));
        toast.success(muted ? "Thread unmuted" : "Thread muted");
      },
      onDelete: () => {
        if (folderRole({ path: message.folder, name: message.folder }) === "trash") {
          toast.message("Already in Trash");
          return;
        }
        void moveWithToast(targets, roleDestination("trash", "Trash"), "Moved to Trash");
      },
      onBlock: async () => {
        const address = message.from.address;
        const ok = await confirm({
          title: "Block sender?",
          description: `Mail from ${address} will be treated as blocked.`,
          confirmLabel: "Block",
          tone: "danger",
        });
        if (!ok) return;
        try {
          await blockSender(address);
          toast.success(`Blocked ${address}`);
        } catch {
          toast.error("Could not block sender");
        }
      },
      onFlag: async (color) => {
        setFlagTick((tick) => tick + 1);
        const flagged = color !== "none";
        try {
          await setFlagged(targets, flagged);
          patchLocal(new Set(targets.map((item) => item.id)), { flagged });
          toast.success(flagged ? `Flagged ${color}` : "Flag cleared");
        } catch {
          toast.error("Could not update flag");
        }
      },
      onArchive: () =>
        void moveWithToast(targets, roleDestination("archive", "Archive"), "Archived"),
      onMove: (path) => {
        const name = folders.find((item) => item.path === path)?.name || path;
        void moveWithToast(targets, path, `Moved to ${name}`);
      },
      onCopyHint: () => toast.message("Copy to isn’t available yet", {
        description: "Use Move to for now.",
      }),
      onApplyRules: () => {
        toast.message("Rules run on incoming mail", {
          description: "Opening your filter settings.",
        });
        router.push("/settings/filters");
      },
    });
    menu.openFromEvent(e, items);
  }

  function openFolderMenu(e: ReactMouseEvent, target: MailFolder) {
    const items = buildFolderMenuItems({
      folder: target,
      identityEmail,
      identityId: mailIdentityId,
      favorites,
      onNewMailbox: async () => {
        const name = await prompt({
          title: "New mailbox",
          description: `Create a mailbox in ${identityEmail}.`,
          label: "Name",
          placeholder: "Receipts",
          confirmLabel: "Create",
        });
        if (!name?.trim() || !mailIdentityId) return;
        try {
          await createMailbox(mailIdentityId, name.trim());
          toast.success(`Created “${name.trim()}”`);
          syncNow();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not create mailbox");
        }
      },
      onToggleFavorite: () => {
        const next = toggleFavoritePath(target.path);
        setFavorites(next);
        toast.success(
          next.includes(target.path) ? "Added to Favorites" : "Removed from Favorites",
        );
      },
      onExport: () => {
        const cached = mailByFolder[target.path] || (target.path === folder ? messages : []);
        if (cached.length === 0) {
          toast.message("Nothing to export yet", {
            description: "Open the mailbox to load its messages first.",
          });
          return;
        }
        const blob = new Blob([JSON.stringify(cached, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${target.name.replace(/[^\w.-]+/g, "_") || "mailbox"}.json`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success(`Exported ${cached.length} cached message${cached.length === 1 ? "" : "s"}`);
      },
      onEraseDeleted: () => void eraseFolder(target, "Erase deleted items?"),
      onEraseJunk: () => void eraseFolder(target, "Erase junk mail?"),
      onMarkAllRead: async () => {
        if (!mailIdentityId) return;
        try {
          await markFolderRead(mailIdentityId, target.path);
          setMailByFolder((prev) =>
            prev[target.path]
              ? {
                  ...prev,
                  [target.path]: prev[target.path].map((message) => ({ ...message, seen: true })),
                }
              : prev,
          );
          if (target.path === folder) {
            setMessages(messages.map((message) => ({ ...message, seen: true })));
          }
          toast.success(`Marked all in ${target.name} as read`);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not mark as read");
        }
      },
      onSync: () => {
        syncNow();
        toast.success(`Synchronizing ${identityEmail}…`);
      },
      onEditAccount: () => router.push("/settings/identities"),
      onAccountInfo: () =>
        toast.message(identityEmail || "Account", {
          description: activeIdentity
            ? `${activeIdentity.type} · ${activeIdentity.connected ? "Connected" : "Not connected"}`
            : undefined,
        }),
    });
    menu.openFromEvent(e, items);
  }

  async function eraseFolder(target: MailFolder, title: string) {
    if (!mailIdentityId) return;
    const ok = await confirm({
      title,
      description: `Messages in “${target.name}” will be permanently removed. This can’t be undone.`,
      confirmLabel: "Erase",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await emptyMailbox(mailIdentityId, target.path);
      setMailByFolder((prev) => ({ ...prev, [target.path]: [] }));
      if (target.path === folder) {
        setMessages([]);
        closeMessage();
      }
      toast.success(`Erased ${target.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not erase mailbox");
    }
  }

  function openMoreMenu(e: ReactMouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const items = buildListMoreItems({
      prefs: listPrefs,
      onToggleCategories: () => setListPrefsState(setListPrefs({ showMailCategories: !listPrefs.showMailCategories })),
      onTogglePhotos: () =>
        setListPrefsState(setListPrefs({ showContactPhoto: !listPrefs.showContactPhoto })),
      onAboutCategories: () =>
        toast.message("About Categories", {
          description: "Mail categories sort Primary, Promotions and Updates. Coming soon to Mailslip.",
        }),
    });
    e.stopPropagation();
    menu.openAt(rect.right - 220, rect.bottom + 6, items);
  }

  return (
    <section className="flex h-full w-full shrink-0 flex-col border-r border-border bg-surface md:w-[380px]">
      {!searching && (
        <div className="flex items-start gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] font-semibold tracking-[-0.01em]">{folderTitle}</h2>
            {identityEmail && (
              <p className="mono truncate text-[11px] text-text-3">{identityEmail}</p>
            )}
            <p className="mt-0.5 text-[12px] text-text-2">
              {messages.length} {messages.length === 1 ? "message" : "messages"}, {unreadCount} unread
            </p>
            {mutedInFolder > 0 && (
              <button
                type="button"
                aria-pressed={showMuted}
                onClick={() => setShowMuted((value) => !value)}
                className={cn(
                  "mono mt-1 rounded-[7px] border px-2 py-0.5 text-[10.5px] font-medium",
                  showMuted
                    ? "border-accent/30 bg-accent-tint text-accent"
                    : "border-border bg-surface-2 text-text-2 hover:bg-hover",
                )}
              >
                {showMuted ? "Hide" : "Show"} {mutedInFolder} muted
              </button>
            )}
          </div>
          <button
            type="button"
            aria-label="Filter unread"
            aria-pressed={unreadOnly}
            title="Show unread only"
            onClick={() => onUnreadChange?.(!unreadOnly)}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border",
              unreadOnly
                ? "border-accent/30 bg-accent-tint text-accent"
                : "border-border bg-surface-2 text-text-2 hover:bg-hover",
            )}
          >
            <FilterIcon size={15} />
          </button>
          <button
            type="button"
            aria-label="More list options"
            title="More"
            onClick={openMoreMenu}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-border bg-surface-2 text-text-2 hover:bg-hover"
          >
            <MoreIcon size={15} />
          </button>
        </div>
      )}
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
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">
              {unreadOnly ? "Unread search" : "Search"}
            </h2>
            <p className="text-[12px] text-text-3">{searchThreads.length} found</p>
          </div>
        )}

        {searching && loadingList && <ListSkeleton />}

        {searching &&
          !loadingList &&
          searchThreads.map((thread) => (
            <ThreadBlock
              key={thread.id}
              thread={thread}
              selectedId={selectedId}
              compact={compact}
              expanded={openThreadIds.includes(thread.id)}
              onToggleExpand={() => toggleThreadExpanded(thread.id)}
              onOpenMessage={openMessage}
              dragPayload={dragPayloadForThread(thread, folder)}
              showPhoto={listPrefs.showContactPhoto}
              onContextMenu={openMessageMenu}
            />
          ))}

        {searching && !loadingList && searchThreads.length === 0 && (
          <div className="px-6 py-10 text-center">
            <p className="text-[15px] font-medium">{unreadOnly ? "No unread matches" : "No matches"}</p>
          </div>
        )}

        {!searching &&
          tree.map((node) => (
            <FolderBranch
              key={node.folder.path}
              node={node}
              depth={0}
              openPaths={openPaths}
              openThreadIds={openThreadIds}
              mailByFolder={mailByFolder}
              unreadOnly={unreadOnly}
              mutedIds={hiddenMuted}
              favorites={favorites}
              showPhoto={listPrefs.showContactPhoto}
              onRowContextMenu={openMessageMenu}
              onFolderContextMenu={openFolderMenu}
              loadingPath={loadingList ? folder : null}
              selectedId={selectedId}
              compact={compact}
              dropTarget={dropTarget}
              onToggle={toggleFolder}
              onToggleThread={toggleThreadExpanded}
              onOpenMessage={openMessage}
              onDropTarget={setDropTarget}
              onMoveMail={moveDraggedMail}
              dragPayloadForThread={dragPayloadForThread}
            />
          ))}
      </div>
      <Menu
        open={menu.open}
        x={menu.x}
        y={menu.y}
        items={menu.items}
        onClose={menu.close}
      />
    </section>
  );

  function openMessage(message: MailMessageSummary, threadMail?: MailMessageSummary[]) {
    const pool = threadMail || mailByFolder[message.folder] || messages;
    const members = threadContaining(pool, message.id)?.messages || [message];
    markThreadSeen(members);
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
  openThreadIds,
  mailByFolder,
  unreadOnly,
  mutedIds,
  favorites,
  showPhoto,
  onRowContextMenu,
  onFolderContextMenu,
  loadingPath,
  selectedId,
  compact,
  dropTarget,
  onToggle,
  onToggleThread,
  onOpenMessage,
  onDropTarget,
  onMoveMail,
  dragPayloadForThread,
}: {
  node: FolderNode<MailFolder>;
  depth: number;
  openPaths: string[];
  openThreadIds: string[];
  mailByFolder: Record<string, MailMessageSummary[]>;
  unreadOnly: boolean;
  mutedIds: string[];
  favorites: string[];
  showPhoto: boolean;
  onRowContextMenu: RowMenuHandler;
  onFolderContextMenu: FolderMenuHandler;
  loadingPath: string | null;
  selectedId: string | null;
  compact: boolean;
  dropTarget: string | null;
  onToggle: (folder: MailFolder) => void;
  onToggleThread: (threadId: string) => void;
  onOpenMessage: (message: MailMessageSummary, threadMail?: MailMessageSummary[]) => void;
  onDropTarget: (path: string | null) => void;
  onMoveMail: (payload: MailDragPayload, destinationPath: string, destName: string) => void;
  dragPayloadForThread: (
    thread: MailThread<MailMessageSummary>,
    sourceFolder: string,
  ) => MailDragPayload;
}) {
  const open = openPaths.includes(node.folder.path);
  const Icon = folderIcon(node.folder);
  const count = groupedScopedUnseen(node, mailByFolder);
  const mail = mailByFolder[node.folder.path];
  const threads = mail ? threadsForList(mail, unreadOnly, mutedIds) : [];
  const isFavorite = favorites.includes(node.folder.path);
  const loading = open && loadingPath === node.folder.path && !mail;
  const selectable = node.folder.selectable !== false;
  const isDropTarget = dropTarget === node.folder.path && selectable;

  function onFolderDragOver(e: DragEvent) {
    if (!selectable || !e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    onDropTarget(node.folder.path);
  }

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onToggle(node.folder)}
        onContextMenu={(e) => onFolderContextMenu(e, node.folder)}
        onDragOver={onFolderDragOver}
        onDragLeave={() => onDropTarget(null)}
        onDrop={(e) => {
          e.preventDefault();
          onDropTarget(null);
          if (!selectable) return;
          const raw = e.dataTransfer.getData(DRAG_MIME);
          if (!raw) return;
          try {
            const payload = JSON.parse(raw) as MailDragPayload;
            void onMoveMail(payload, node.folder.path, node.folder.name);
          } catch {
            /* ignore */
          }
        }}
        className={cn(
          "flex w-full items-center gap-2 py-2 pr-3 text-left text-[13.5px] font-medium text-text hover:bg-hover",
          isDropTarget && "bg-accent-tint ring-1 ring-inset ring-accent/40",
        )}
        style={{ paddingLeft: 12 + depth * 14 }}
        title={node.folder.path}
      >
        <ChevronIcon
          size={14}
          className={cn("shrink-0 text-text-3 transition-transform", open && "rotate-90")}
        />
        <Icon size={16} className="shrink-0 text-text-2" />
        <span className="truncate">{node.folder.name}</span>
        {isFavorite && <StarIcon size={11} className="shrink-0 text-accent" />}
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
              openThreadIds={openThreadIds}
              mailByFolder={mailByFolder}
              unreadOnly={unreadOnly}
              mutedIds={mutedIds}
              favorites={favorites}
              showPhoto={showPhoto}
              onRowContextMenu={onRowContextMenu}
              onFolderContextMenu={onFolderContextMenu}
              loadingPath={loadingPath}
              selectedId={selectedId}
              compact={compact}
              dropTarget={dropTarget}
              onToggle={onToggle}
              onToggleThread={onToggleThread}
              onOpenMessage={onOpenMessage}
              onDropTarget={onDropTarget}
              onMoveMail={onMoveMail}
              dragPayloadForThread={dragPayloadForThread}
            />
          ))}
          {selectable && loading && <ListSkeleton />}
          {selectable &&
            threads.map((thread) => (
              <ThreadBlock
                key={thread.id}
                thread={thread}
                selectedId={selectedId}
                compact={compact}
                indent={depth + 1}
                expanded={openThreadIds.includes(thread.id)}
                onToggleExpand={() => onToggleThread(thread.id)}
                onOpenMessage={(message) => onOpenMessage(message, mail)}
                dragPayload={dragPayloadForThread(thread, node.folder.path)}
                showPhoto={showPhoto}
                onContextMenu={onRowContextMenu}
              />
            ))}
          {selectable && mail && threads.length === 0 && !loading && (
            <p
              className="py-2 text-[12px] text-text-3"
              style={{ paddingLeft: 28 + (depth + 1) * 14 }}
            >
              {unreadOnly && mail.length > 0 ? "No unread" : "No messages"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ThreadBlock({
  thread,
  selectedId,
  compact,
  indent = 0,
  expanded,
  onToggleExpand,
  onOpenMessage,
  dragPayload,
  showPhoto,
  onContextMenu,
}: {
  thread: MailThread<MailMessageSummary>;
  selectedId: string | null;
  compact: boolean;
  indent?: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onOpenMessage: (message: MailMessageSummary) => void;
  dragPayload: MailDragPayload;
  showPhoto: boolean;
  onContextMenu: RowMenuHandler;
}) {
  const count = thread.messages.length;
  const older = [...thread.messages]
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .slice(1);

  return (
    <div>
      <MessageRow
        thread={thread}
        active={thread.messages.some((message) => message.id === selectedId)}
        compact={compact}
        indent={indent}
        expandable={count > 1}
        expanded={expanded}
        onToggleExpand={onToggleExpand}
        onClick={() => onOpenMessage(thread.latest)}
        dragPayload={dragPayload}
        showPhoto={showPhoto}
        onContextMenu={onContextMenu}
      />
      {expanded &&
        older.map((message) => (
          <MessageRow
            key={message.id}
            thread={thread}
            message={message}
            active={message.id === selectedId}
            compact={compact}
            indent={indent + 1}
            subRow
            onClick={() => onOpenMessage(message)}
            dragPayload={dragPayload}
            showPhoto={showPhoto}
            onContextMenu={onContextMenu}
          />
        ))}
    </div>
  );
}

function MessageRow({
  thread,
  message: messageOverride,
  active,
  compact,
  indent = 0,
  subRow = false,
  expandable = false,
  expanded = false,
  onToggleExpand,
  onClick,
  dragPayload,
  showPhoto,
  onContextMenu,
}: {
  thread: MailThread<MailMessageSummary>;
  message?: MailMessageSummary;
  active: boolean;
  compact: boolean;
  indent?: number;
  subRow?: boolean;
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  onClick: () => void;
  dragPayload?: MailDragPayload;
  showPhoto: boolean;
  onContextMenu: RowMenuHandler;
}) {
  const message = messageOverride || thread.latest;
  const flagColor = getFlagColor(message.id);
  const flagTint = flagSwatch(flagColor);
  const seen = messageOverride ? message.seen : thread.messages.every((item) => item.seen);
  const count = thread.messages.length;
  const people = subRow
    ? message.from.name || message.from.address
    : threadParticipants(thread.messages);

  return (
    <div
      draggable={Boolean(dragPayload) && !subRow}
      onContextMenu={(e) => onContextMenu(e, thread, message, subRow)}
      onDragStart={(e) => {
        if (!dragPayload) return;
        e.dataTransfer.setData(DRAG_MIME, JSON.stringify(dragPayload));
        e.dataTransfer.effectAllowed = "move";
      }}
      className={cn(
        "group flex w-full border-b border-border text-left transition-colors duration-150",
        active ? "border-l-2 border-l-accent bg-accent-tint" : "hover:bg-hover",
      )}
    >
      {expandable && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand?.();
          }}
          className="flex shrink-0 items-center self-stretch pl-2 text-text-3 hover:text-text"
          style={{ marginLeft: 4 + indent * 14 }}
        >
          <ChevronIcon size={14} className={cn("transition-transform", expanded && "rotate-90")} />
        </button>
      )}
      <button
        type="button"
        onClick={onClick}
        style={!expandable ? { paddingLeft: 16 + indent * 14 } : undefined}
        className={cn(
          "flex min-w-0 flex-1 gap-3",
          compact ? "py-2.5 pr-3" : "py-3.5 pr-3",
          expandable && "pl-1",
        )}
      >
        {showPhoto && (
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-full bg-border-strong font-semibold text-text-2",
              subRow ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-[11px]",
            )}
          >
            {initials(message.from.name, message.from.address)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "min-w-0 truncate text-[13px]",
                seen ? "font-medium text-text" : "font-semibold text-text",
                subRow && "text-[12px]",
              )}
            >
              {people}
            </span>
            <span className="ml-auto flex shrink-0 items-center gap-1.5">
              {!subRow && thread.messages.some((item) => item.hasAttachments) && (
                <PaperclipIcon size={12} className="text-text-3" />
              )}
              {!subRow && count > 1 && (
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
            {flagColor !== "none" ? (
              <FlagIcon
                size={12}
                className="shrink-0"
                style={{ color: flagTint, fill: flagTint }}
              />
            ) : (
              !subRow &&
              thread.messages.some((item) => item.flagged) && (
                <StarIcon size={12} className="shrink-0 text-accent" />
              )
            )}
          </div>
        </div>
      </button>
    </div>
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

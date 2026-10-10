"use client";

import type { MenuItem } from "@/components/ui/menu";
import {
  FLAG_COLORS,
  type FlagColor,
  getFavoritePaths,
  setFlagColor,
  type ListPrefs,
} from "@/lib/mail/client-actions";
import { folderRole } from "@/lib/mail/folder-map";
import type { MailFolder, MailMessageSummary } from "@/lib/mail/types";
import type { MailThread } from "@/lib/mail/thread";
import {
  ArchiveIcon,
  BanIcon,
  ClockIcon,
  FlagIcon,
  FolderIcon,
  ForwardIcon,
  ReplyAllIcon,
  ReplyIcon,
  SendIcon,
  TrashIcon,
} from "./icons";

function FlagSwatches({
  messageId,
  onPick,
}: {
  messageId: string;
  onPick: (color: FlagColor) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 px-1">
      {FLAG_COLORS.map((color) => (
        <button
          key={color.id}
          type="button"
          title={color.label}
          aria-label={color.label}
          className="flex h-5 w-5 items-center justify-center rounded-full border border-border hover:scale-110"
          style={{
            background: color.id === "none" ? "transparent" : color.swatch,
          }}
          onClick={() => {
            setFlagColor(messageId, color.id);
            onPick(color.id);
          }}
        >
          {color.id === "none" && <span className="text-[10px] text-text-3">✕</span>}
        </button>
      ))}
    </div>
  );
}

export function buildMessageMenuItems(opts: {
  thread: MailThread<MailMessageSummary>;
  message: MailMessageSummary;
  folders: MailFolder[];
  muted: boolean;
  onOpen: () => void;
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
  onForwardAsAttachment: () => void;
  onSendAgain: () => void;
  onRedirect: () => void;
  onRemind: (hours: number) => void;
  onToggleSeen: () => void;
  onJunk: () => void;
  onMute: () => void;
  onDelete: () => void;
  onBlock: () => void;
  onFlag: (color: FlagColor) => void;
  onArchive: () => void;
  onMove: (path: string) => void;
  onCopyHint: () => void;
  onApplyRules: () => void;
}): MenuItem[] {
  const { thread, message, folders } = opts;
  const moveFolders = folders
    .filter((folder) => folder.selectable !== false && folder.path !== message.folder)
    .slice(0, 40);

  return [
    { id: "open", label: "Open", onSelect: opts.onOpen },
    { id: "send-again", label: "Send Again", icon: <SendIcon size={14} />, onSelect: opts.onSendAgain },
    { id: "reply", label: "Reply", icon: <ReplyIcon size={14} />, onSelect: opts.onReply },
    { id: "reply-all", label: "Reply All", icon: <ReplyAllIcon size={14} />, onSelect: opts.onReplyAll },
    { id: "forward", label: "Forward", icon: <ForwardIcon size={14} />, onSelect: opts.onForward },
    {
      id: "forward-attach",
      label: "Forward as Attachment",
      onSelect: opts.onForwardAsAttachment,
    },
    { id: "redirect", label: "Redirect", onSelect: opts.onRedirect },
    {
      id: "remind",
      label: "Remind Me",
      icon: <ClockIcon size={14} />,
      separatorBefore: true,
      submenu: [
        { id: "r1", label: "In 1 hour", onSelect: () => opts.onRemind(1) },
        { id: "r3", label: "In 3 hours", onSelect: () => opts.onRemind(3) },
        { id: "r24", label: "Tomorrow", onSelect: () => opts.onRemind(24) },
        { id: "r168", label: "Next week", onSelect: () => opts.onRemind(168) },
      ],
    },
    {
      id: "seen",
      label: thread.messages.every((item) => item.seen) ? "Mark as Unread" : "Mark as Read",
      separatorBefore: true,
      onSelect: opts.onToggleSeen,
    },
    { id: "junk", label: "Move to Junk", icon: <BanIcon size={14} />, onSelect: opts.onJunk },
    {
      id: "mute",
      label: opts.muted ? "Unmute" : "Mute",
      onSelect: opts.onMute,
    },
    { id: "delete", label: "Delete", icon: <TrashIcon size={14} />, danger: true, onSelect: opts.onDelete },
    { id: "block", label: "Block Sender", onSelect: opts.onBlock },
    {
      id: "flag",
      label: "Flag",
      icon: <FlagIcon size={14} />,
      separatorBefore: true,
      custom: (
        <FlagSwatches
          messageId={message.id}
          onPick={(color) => opts.onFlag(color)}
        />
      ),
    },
    {
      id: "archive",
      label: "Archive",
      icon: <ArchiveIcon size={14} />,
      separatorBefore: true,
      onSelect: opts.onArchive,
    },
    {
      id: "move",
      label: "Move to",
      icon: <FolderIcon size={14} />,
      submenu: moveFolders.map((folder) => ({
        id: `move-${folder.path}`,
        label: folder.name,
        onSelect: () => opts.onMove(folder.path),
      })),
    },
    {
      id: "copy",
      label: "Copy to",
      submenu: moveFolders.map((folder) => ({
        id: `copy-${folder.path}`,
        label: folder.name,
        onSelect: opts.onCopyHint,
      })),
    },
    {
      id: "rules",
      label: "Apply Rules",
      separatorBefore: true,
      onSelect: opts.onApplyRules,
    },
  ];
}

export function buildFolderMenuItems(opts: {
  folder: MailFolder;
  identityEmail: string;
  identityId: string;
  favorites: string[];
  onNewMailbox: () => void;
  onToggleFavorite: () => void;
  onExport: () => void;
  onEraseDeleted: () => void;
  onEraseJunk: () => void;
  onMarkAllRead: () => void;
  onSync: () => void;
  onEditAccount: () => void;
  onAccountInfo: () => void;
}): MenuItem[] {
  const role = folderRole(opts.folder);
  const isFavorite = opts.favorites.includes(opts.folder.path) || getFavoritePaths().includes(opts.folder.path);

  return [
    { id: "new", label: "New Mailbox…", onSelect: opts.onNewMailbox },
    {
      id: "fav",
      label: isFavorite ? "Remove from Favorites" : "Add to Favorites",
      onSelect: opts.onToggleFavorite,
    },
    { id: "export", label: "Export Mailbox…", onSelect: opts.onExport },
    {
      id: "erase-deleted",
      label: "Erase Deleted Items…",
      separatorBefore: true,
      disabled: role !== "trash",
      danger: true,
      onSelect: opts.onEraseDeleted,
    },
    {
      id: "erase-junk",
      label: "Erase Junk Mail…",
      disabled: role !== "junk",
      danger: true,
      onSelect: opts.onEraseJunk,
    },
    {
      id: "mark-read",
      label: "Mark All Messages as Read",
      onSelect: opts.onMarkAllRead,
    },
    {
      id: "sync",
      label: `Synchronize “${opts.identityEmail}”`,
      separatorBefore: true,
      onSelect: opts.onSync,
    },
    {
      id: "edit",
      label: `Edit “${opts.identityEmail}”…`,
      onSelect: opts.onEditAccount,
    },
    {
      id: "info",
      label: "Get Account Info",
      separatorBefore: true,
      onSelect: opts.onAccountInfo,
    },
  ];
}

export function buildListMoreItems(opts: {
  prefs: ListPrefs;
  onToggleCategories: () => void;
  onTogglePhotos: () => void;
  onAboutCategories: () => void;
}): MenuItem[] {
  return [
    {
      id: "categories",
      label: opts.prefs.showMailCategories ? "Hide Mail Categories" : "Show Mail Categories",
      onSelect: opts.onToggleCategories,
    },
    {
      id: "photos",
      label: opts.prefs.showContactPhoto ? "Hide Contact Photo" : "Show Contact Photo",
      onSelect: opts.onTogglePhotos,
    },
    {
      id: "about",
      label: "About Categories…",
      separatorBefore: true,
      onSelect: opts.onAboutCategories,
    },
  ];
}

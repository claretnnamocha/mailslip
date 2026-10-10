"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import DOMPurify from "isomorphic-dompurify";
import { useMailStore } from "@/stores/mail-store";
import { formatMessageDate, initials } from "@/lib/utils";
import { displaySubject, threadContaining } from "@/lib/mail/thread";
import type { MailMessage } from "@/lib/mail/types";
import { Button } from "@/components/ui/button";
import { Menu, useMenu, type MenuItem } from "@/components/ui/menu";
import { useDialog } from "@/components/dialog-provider";
import {
  FLAG_COLORS,
  moveTargets,
  setFlagColor,
  setFlagged,
  setSeen,
  snoozeTarget,
  unsubscribeUrlFromHeaders,
} from "@/lib/mail/client-actions";
import { folderRole } from "@/lib/mail/folder-map";
import {
  ArchiveIcon,
  BanIcon,
  EyeIcon,
  EyeOffIcon,
  FlagIcon,
  FolderIcon,
  ForwardIcon,
  ReplyAllIcon,
  ReplyIcon,
  StarIcon,
  TrashIcon,
  ClockIcon,
  ShieldIcon,
  XIcon,
} from "./icons";
import { toast } from "sonner";

function isPgpBody(text?: string | null, html?: string | null) {
  const source = text || html || "";
  return source.includes("-----BEGIN PGP MESSAGE-----");
}

function hasRemoteImages(html?: string | null) {
  if (!html) return false;
  return /<img[^>]+src=["']https?:\/\//i.test(html) || /url\(\s*['"]?https?:\/\//i.test(html);
}

function senderKey(address: string) {
  return address.trim().toLowerCase();
}

export function MessageView() {
  const {
    selectedId,
    selectedMessage,
    setSelectedMessage,
    closeMessage,
    setLoadingMessage,
    loadingMessage,
    messages,
    setMessages,
    openCompose,
    folders,
  } = useMailStore();
  const { prompt, alert, confirm } = useDialog();
  const menu = useMenu();
  const [showRemoteOnce, setShowRemoteOnce] = useState(false);
  const [trustedSenders, setTrustedSenders] = useState<string[]>([]);
  const [headersOpen, setHeadersOpen] = useState(false);
  const [decrypted, setDecrypted] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [threadMessages, setThreadMessages] = useState<MailMessage[]>([]);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  useEffect(() => {
    setDecrypted(null);
    setThreadMessages([]);
    setShowRemoteOnce(false);
    setTrustedSenders([]);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedMessage(null);
      setThreadMessages([]);
      return;
    }
    const summary = messagesRef.current.find((m) => m.id === selectedId);
    if (!summary) return;
    const members = threadContaining(messagesRef.current, selectedId)?.messages || [summary];
    const unseenEarly = members.filter((message) => !message.seen);
    if (unseenEarly.length > 0) {
      const seenIds = new Set(unseenEarly.map((message) => message.id));
      setMessages(
        messagesRef.current.map((message) =>
          seenIds.has(message.id) ? { ...message, seen: true } : message,
        ),
      );
      void Promise.all(
        unseenEarly.map((message) =>
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

    let cancelled = false;
    (async () => {
      setLoadingMessage(true);
      try {
        const params = new URLSearchParams({
          identityId: summary.identityId,
          folder: summary.folder,
          ids: members.map((message) => message.remoteId || String(message.uid)).join(","),
        });
        const res = await fetch(`/api/mail/thread?${params}`);
        if (!res.ok) throw new Error("Failed to load message");
        const data = (await res.json()) as MailMessage[];
        if (cancelled) return;
        const ordered = [...data].sort((a, b) => +new Date(a.date) - +new Date(b.date));
        setThreadMessages(ordered);
        setSelectedMessage(ordered[ordered.length - 1] || null);
      } catch {
        if (!cancelled) toast.error("Could not open message");
      } finally {
        if (!cancelled) setLoadingMessage(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedId, setLoadingMessage, setMessages, setSelectedMessage]);

  useEffect(() => {
    const pool = threadMessages.length > 0 ? threadMessages : selectedMessage ? [selectedMessage] : [];
    const addresses = [
      ...new Set(pool.map((message) => senderKey(message.from.address)).filter(Boolean)),
    ];
    if (addresses.length === 0) return;
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams({ addresses: addresses.join(",") });
      const res = await fetch(`/api/settings/image-trust?${params}`);
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { trusted?: string[] };
      if (!cancelled) setTrustedSenders(data.trusted || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, threadMessages, selectedMessage]);

  if (!selectedId) {
    return (
      <section className="hidden h-full flex-1 items-center justify-center bg-bg md:flex">
        <div className="text-center">
          <p className="text-[15px] font-medium">Select a message</p>
          <p className="mt-1 text-[13px] text-text-2">
            Your reading pane stays calm until you need it.
          </p>
        </div>
      </section>
    );
  }

  if (loadingMessage || !selectedMessage) {
    return (
      <section className="flex h-full flex-1 flex-col bg-bg">
        <div className="flex items-center justify-end border-b border-border px-4 py-3">
          <Button size="sm" variant="ghost" aria-label="Close message" onClick={closeMessage}>
            <XIcon size={16} />
          </Button>
        </div>
        <div className="p-8">
          <div className="skeleton mb-4 h-6 w-2/3" />
          <div className="skeleton mb-6 h-4 w-1/3" />
          <div className="space-y-3">
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-5/6" />
          </div>
        </div>
      </section>
    );
  }

  const current = selectedMessage;
  const opened = threadMessages.length > 0 ? threadMessages : [current];
  const trustedSet = new Set(trustedSenders);

  function imagesAllowed(message: MailMessage) {
    return showRemoteOnce || trustedSet.has(senderKey(message.from.address));
  }

  const blockedImageSenders = [
    ...new Set(
      opened
        .filter((message) => hasRemoteImages(message.html) && !imagesAllowed(message))
        .map((message) => senderKey(message.from.address)),
    ),
  ];

  async function alwaysAllowImages(address: string) {
    const value = senderKey(address);
    const res = await fetch("/api/settings/image-trust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: value }),
    });
    if (!res.ok) {
      toast.error("Could not save image preference");
      return;
    }
    setTrustedSenders((prev) => (prev.includes(value) ? prev : [...prev, value]));
    toast.success(`Images allowed from ${value}`);
  }

  function messageHtml(message: MailMessage) {
    if (decrypted && message.id === current.id) {
      return `<pre style="white-space:pre-wrap;font-family:inherit">${decrypted
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</pre>`;
    }
    if (message.html) return DOMPurify.sanitize(message.html);
    return `<pre style="white-space:pre-wrap;font-family:inherit">${(message.text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")}</pre>`;
  }

  async function decryptPgp() {
    const armored = selectedMessage?.text || selectedMessage?.html || "";
    const passphrase = await prompt({
      title: "Decrypt message",
      description: "Enter your private key passphrase if it has one. Leave blank if none.",
      label: "Passphrase",
      inputType: "password",
      confirmLabel: "Decrypt",
    });
    if (passphrase === null) return;
    setDecrypting(true);
    try {
      const res = await fetch("/api/mail/decrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ armored, passphrase: passphrase || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Decrypt failed");
      setDecrypted(data.plaintext);
      toast.success("Message decrypted");
    } catch (e) {
      await alert({
        title: "Could not decrypt",
        description: e instanceof Error ? e.message : "Decrypt failed",
      });
    } finally {
      setDecrypting(false);
    }
  }

  function threadTargets() {
    const thread = threadContaining(messages, selectedId!);
    return thread?.messages || messages.filter((message) => message.id === selectedId);
  }

  function roleDestination(role: "junk" | "trash" | "archive", fallback: string) {
    return (
      folders.find((item) => folderRole(item) === role && item.selectable !== false)?.path ||
      fallback
    );
  }

  async function moveSelected(destination: string, label: string) {
    const targets = threadTargets();
    if (targets.length === 0) return;
    try {
      await moveTargets(targets, destination);
      const removed = new Set(targets.map((message) => message.id));
      setMessages(messages.filter((message) => !removed.has(message.id)));
      closeMessage();
      toast.success(label);
    } catch {
      toast.error("Could not move message");
    }
  }

  function act(action: "archive" | "trash" | "junk") {
    if (action === "archive") return moveSelected(roleDestination("archive", "Archive"), "Archived");
    if (action === "junk") return moveSelected(roleDestination("junk", "Junk"), "Moved to Junk");
    return moveSelected(roleDestination("trash", "Trash"), "Moved to trash");
  }

  async function applyFlag(flagged: boolean) {
    const targets = threadTargets();
    if (targets.length === 0) return;
    try {
      await setFlagged(targets, flagged);
      const ids = new Set(targets.map((message) => message.id));
      setMessages(messages.map((message) => (ids.has(message.id) ? { ...message, flagged } : message)));
      setSelectedMessage({ ...current, flagged });
    } catch {
      toast.error("Could not update flag");
    }
  }

  async function toggleFlag() {
    const next = !current.flagged;
    if (!next) setFlagColor(current.id, "none");
    await applyFlag(next);
    toast.success(next ? "Flagged" : "Flag cleared");
  }

  async function markUnread() {
    const targets = threadTargets();
    if (targets.length === 0) return;
    try {
      await setSeen(targets, false);
      const ids = new Set(targets.map((message) => message.id));
      setMessages(messages.map((message) => (ids.has(message.id) ? { ...message, seen: false } : message)));
      closeMessage();
      toast.success("Marked as unread");
    } catch {
      toast.error("Could not update message");
    }
  }

  async function remind(hours: number, label: string) {
    const targets = threadTargets();
    const summary = targets[targets.length - 1];
    if (!summary) return;
    try {
      await snoozeTarget(summary, new Date(Date.now() + hours * 60 * 60 * 1000));
      const removed = new Set(targets.map((message) => message.id));
      setMessages(messages.filter((message) => !removed.has(message.id)));
      closeMessage();
      toast.success(`Reminding you ${label}`);
    } catch {
      toast.error("Could not set reminder");
    }
  }

  function openToolbarMenu(e: ReactMouseEvent<HTMLElement>, items: MenuItem[]) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    menu.openAt(rect.left, rect.bottom + 6, items);
  }

  function openMoveMenu(e: ReactMouseEvent<HTMLElement>) {
    const folderPath = threadTargets()[0]?.folder;
    const items: MenuItem[] = folders
      .filter((item) => item.selectable !== false && item.path !== folderPath)
      .map((item) => ({
        id: `move-${item.path}`,
        label: item.name,
        icon: <FolderIcon size={14} />,
        onSelect: () => void moveSelected(item.path, `Moved to ${item.name}`),
      }));
    openToolbarMenu(
      e,
      items.length > 0 ? items : [{ id: "none", label: "No other folders", disabled: true }],
    );
  }

  function openRemindMenu(e: ReactMouseEvent<HTMLElement>) {
    openToolbarMenu(e, [
      { id: "r1", label: "In 1 hour", onSelect: () => void remind(1, "in 1 hour") },
      { id: "r3", label: "In 3 hours", onSelect: () => void remind(3, "in 3 hours") },
      { id: "r24", label: "Tomorrow", onSelect: () => void remind(24, "tomorrow") },
      { id: "r168", label: "Next week", onSelect: () => void remind(168, "next week") },
    ]);
  }

  function openFlagMenu(e: ReactMouseEvent<HTMLElement>) {
    openToolbarMenu(
      e,
      FLAG_COLORS.map((color) => ({
        id: `flag-${color.id}`,
        label: color.id === "none" ? "Clear flag" : color.label,
        icon: (
          <span
            className="inline-block h-3 w-3 rounded-full border border-border"
            style={{ background: color.id === "none" ? "transparent" : color.swatch }}
          />
        ),
        separatorBefore: color.id === "none" ? false : undefined,
        onSelect: () => {
          setFlagColor(current.id, color.id);
          void applyFlag(color.id !== "none").then(() =>
            toast.success(color.id === "none" ? "Flag cleared" : `Flagged ${color.label.toLowerCase()}`),
          );
        },
      })),
    );
  }

  const unsubscribeUrl = unsubscribeUrlFromHeaders(current.headers);

  async function unsubscribe() {
    if (!unsubscribeUrl) return;
    const ok = await confirm({
      title: "Unsubscribe from this sender?",
      description: unsubscribeUrl.startsWith("mailto:")
        ? "This opens a pre-filled email in your mail app to request removal."
        : "This opens the sender’s unsubscribe page in a new tab.",
      confirmLabel: "Unsubscribe",
    });
    if (!ok) return;
    if (unsubscribeUrl.startsWith("mailto:")) window.location.href = unsubscribeUrl;
    else window.open(unsubscribeUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="flex h-full flex-1 flex-col overflow-hidden bg-bg">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <Button size="sm" variant="ghost" onClick={() => openCompose("reply")}>
          <ReplyIcon size={16} /> Reply
        </Button>
        <Button size="sm" variant="ghost" onClick={() => openCompose("replyAll")}>
          <ReplyAllIcon size={16} /> Reply all
        </Button>
        <Button size="sm" variant="ghost" onClick={() => openCompose("forward")}>
          <ForwardIcon size={16} /> Forward
        </Button>
        <div className="mx-1 h-4 w-px bg-border" />
        <Button size="sm" variant="ghost" title="Archive" aria-label="Archive" onClick={() => void act("archive")}>
          <ArchiveIcon size={16} />
        </Button>
        <Button size="sm" variant="ghost" title="Move to Trash" aria-label="Trash" onClick={() => void act("trash")}>
          <TrashIcon size={16} />
        </Button>
        <Button size="sm" variant="ghost" title="Move to Junk" aria-label="Junk" onClick={() => void act("junk")}>
          <BanIcon size={16} />
        </Button>
        <Button size="sm" variant="ghost" title="Move to…" aria-label="Move to" onClick={openMoveMenu}>
          <FolderIcon size={16} />
        </Button>
        <div className="mx-1 h-4 w-px bg-border" />
        <Button size="sm" variant="ghost" title="Mark as unread" aria-label="Mark as unread" onClick={() => void markUnread()}>
          {current.seen ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          title="Star"
          aria-label="Star"
          aria-pressed={current.flagged}
          className={current.flagged ? "text-accent" : undefined}
          onClick={() => void toggleFlag()}
        >
          <StarIcon size={16} />
        </Button>
        <Button size="sm" variant="ghost" title="Flag color" aria-label="Flag" onClick={openFlagMenu}>
          <FlagIcon size={16} />
        </Button>
        <Button size="sm" variant="ghost" title="Remind me" aria-label="Remind me" onClick={openRemindMenu}>
          <ClockIcon size={16} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          aria-label="Close message"
          onClick={closeMessage}
        >
          <XIcon size={16} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-text">
          {displaySubject(selectedMessage.subject)}
        </h1>
        {opened.length > 1 && (
          <p className="mt-1 text-[13px] text-text-3">{opened.length} messages in this thread</p>
        )}

        {unsubscribeUrl && (
          <div className="mt-4 flex flex-col gap-2 rounded-[10px] border border-border bg-surface px-3 py-2.5 text-[12px] text-text-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              This message is from a mailing list.
              <span className="mono ml-2 rounded-[6px] border border-border bg-surface-2 px-1.5 py-0.5 text-[10.5px] text-text-3">
                List-Unsubscribe
              </span>
            </span>
            <button
              type="button"
              className="self-start font-medium text-accent sm:self-auto"
              onClick={() => void unsubscribe()}
            >
              Unsubscribe
            </button>
          </div>
        )}

        {blockedImageSenders.length > 0 && (
          <div className="mt-4 flex flex-col gap-2 rounded-[10px] border border-border bg-surface px-3 py-2.5 text-[12px] text-text-2 sm:flex-row sm:items-center sm:justify-between">
            <span>Remote images are blocked for privacy.</span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <button
                type="button"
                className="font-medium text-accent"
                onClick={() => setShowRemoteOnce(true)}
              >
                Show once
              </button>
              {blockedImageSenders.map((address) => (
                <button
                  key={address}
                  type="button"
                  className="font-medium text-accent"
                  onClick={() => void alwaysAllowImages(address)}
                >
                  Always allow {address}
                </button>
              ))}
            </div>
          </div>
        )}

        {opened.map((message, index) => {
          const pgpLocked = !decrypted && isPgpBody(message.text, message.html);
          return (
            <div key={message.id}>
              {index > 0 && (
                <div className="my-8 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="shrink-0 text-[11px] uppercase tracking-[0.08em] text-text-3">
                    {formatMessageDate(message.date)}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              )}

              <div className={index === 0 ? "mt-5 flex gap-3" : "flex gap-3"}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-border-strong text-[12px] font-semibold text-text-2">
                  {initials(message.from.name, message.from.address)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="font-semibold">{message.from.name || message.from.address}</span>
                    <span className="mono text-[12px] text-text-3">{message.from.address}</span>
                    <span className="ml-auto text-[12px] text-text-3">
                      {formatMessageDate(message.date)}
                    </span>
                  </div>
                  {index === opened.length - 1 && (
                    <button
                      onClick={() => setHeadersOpen((v) => !v)}
                      className="mt-1 text-[12px] text-text-2 hover:text-text"
                    >
                      {headersOpen ? "Hide details" : "Show details"}
                    </button>
                  )}
                  {index === opened.length - 1 && headersOpen && (
                    <div className="mt-2 space-y-1 text-[12px] text-text-2">
                      <div>
                        <span className="text-text-3">To </span>
                        {message.to.map((t) => t.address).join(", ")}
                      </div>
                      {message.cc.length > 0 && (
                        <div>
                          <span className="text-text-3">Cc </span>
                          {message.cc.map((t) => t.address).join(", ")}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {message.attachments.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {message.attachments.map((a) => (
                    <div
                      key={`${message.id}-${a.filename}`}
                      className="rounded-[10px] border border-border bg-surface px-3 py-2 text-[12px]"
                    >
                      <div className="font-medium">{a.filename}</div>
                      <div className="text-text-3 mono">{(a.size / 1024).toFixed(0)} KB</div>
                    </div>
                  ))}
                </div>
              )}

              {pgpLocked && message.id === selectedMessage.id && (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-[10px] border border-border bg-accent-tint px-3 py-2 text-[12px] text-text">
                  <span className="flex items-center gap-2">
                    <ShieldIcon size={14} />
                    This message is PGP-encrypted.
                  </span>
                  <Button size="sm" variant="secondary" onClick={decryptPgp} disabled={decrypting}>
                    {decrypting ? "Decrypting…" : "Decrypt"}
                  </Button>
                </div>
              )}

              <article
                className={`email-content mt-4 rounded-[12px] border border-border bg-email-sheet p-6 text-[15px] leading-[1.6] text-email-body shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${
                  imagesAllowed(message) ? "" : "block-remote"
                }`}
                dangerouslySetInnerHTML={{ __html: messageHtml(message) }}
              />
            </div>
          );
        })}
      </div>
      <Menu open={menu.open} x={menu.x} y={menu.y} items={menu.items} onClose={menu.close} />
    </section>
  );
}

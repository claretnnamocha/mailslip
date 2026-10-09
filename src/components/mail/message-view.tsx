"use client";

import { useEffect, useRef, useState } from "react";
import DOMPurify from "isomorphic-dompurify";
import { useMailStore } from "@/stores/mail-store";
import { formatMessageDate, initials } from "@/lib/utils";
import { displaySubject, threadContaining } from "@/lib/mail/thread";
import type { MailMessage } from "@/lib/mail/types";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/dialog-provider";
import {
  ArchiveIcon,
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
  } = useMailStore();
  const { prompt, alert } = useDialog();
  const [showRemote, setShowRemote] = useState(false);
  const [headersOpen, setHeadersOpen] = useState(false);
  const [decrypted, setDecrypted] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [threadMessages, setThreadMessages] = useState<MailMessage[]>([]);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  useEffect(() => {
    setDecrypted(null);
    setThreadMessages([]);
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
        const unseen = members.filter((message) => !message.seen);
        await Promise.all(
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
        if (!cancelled && unseen.length > 0) {
          const seenIds = new Set(unseen.map((message) => message.id));
          setMessages(
            messagesRef.current.map((message) =>
              seenIds.has(message.id) ? { ...message, seen: true } : message,
            ),
          );
        }
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

  async function act(action: "archive" | "trash" | "flag") {
    const thread = threadContaining(messages, selectedId);
    const targets = thread?.messages || messages.filter((message) => message.id === selectedId);
    const summary = targets[targets.length - 1];
    if (!summary) return;
    if (action === "flag") {
      await fetch(`/api/mail/messages/${summary.uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identityId: summary.identityId,
          folder: summary.folder,
          remoteId: summary.remoteId || String(summary.uid),
          flagged: !selectedMessage?.flagged,
        }),
      });
      toast.success(selectedMessage?.flagged ? "Unstarred" : "Starred");
      return;
    }
    const destination = action === "archive" ? "Archive" : "Trash";
    await Promise.all(
      targets.map((message) =>
        fetch(`/api/mail/messages/${message.uid}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identityId: message.identityId,
            folder: message.folder,
            remoteId: message.remoteId || String(message.uid),
            action: "move",
            destination,
          }),
        }),
      ),
    );
    const removed = new Set(targets.map((message) => message.id));
    setMessages(messages.filter((message) => !removed.has(message.id)));
    closeMessage();
    toast.success(action === "archive" ? "Archived" : "Moved to trash");
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
        <Button size="sm" variant="ghost" onClick={() => act("archive")}>
          <ArchiveIcon size={16} />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => act("trash")}>
          <TrashIcon size={16} />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => act("flag")}>
          <StarIcon size={16} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            const summary = messages.find((m) => m.id === selectedId);
            if (!summary) return;
            const wakeAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
            await fetch(`/api/mail/messages/${summary.uid}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                identityId: summary.identityId,
                folder: summary.folder,
                remoteId: summary.remoteId,
                action: "snooze",
                wakeAt,
              }),
            });
            toast.success("Snoozed for 3 hours");
          }}
        >
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
                  showRemote ? "" : "block-remote"
                }`}
                dangerouslySetInnerHTML={{ __html: messageHtml(message) }}
              />
            </div>
          );
        })}

        {!showRemote && opened.some((message) => message.html?.includes("http")) && (
          <div className="mt-4 flex items-center justify-between rounded-[10px] border border-border bg-surface px-3 py-2 text-[12px] text-text-2">
            <span>Remote images are blocked.</span>
            <button className="font-medium text-accent" onClick={() => setShowRemote(true)}>
              Show
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

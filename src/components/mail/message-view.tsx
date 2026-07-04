"use client";

import { useEffect, useState } from "react";
import DOMPurify from "isomorphic-dompurify";
import { useMailStore } from "@/stores/mail-store";
import { formatMessageDate, initials } from "@/lib/utils";
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
    setLoadingMessage,
    loadingMessage,
    messages,
    openCompose,
  } = useMailStore();
  const { prompt, alert } = useDialog();
  const [showRemote, setShowRemote] = useState(false);
  const [headersOpen, setHeadersOpen] = useState(false);
  const [decrypted, setDecrypted] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);

  useEffect(() => {
    setDecrypted(null);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedMessage(null);
      return;
    }
    const summary = messages.find((m) => m.id === selectedId);
    if (!summary) return;

    let cancelled = false;
    (async () => {
      setLoadingMessage(true);
      try {
        const remoteId = encodeURIComponent(summary.remoteId || String(summary.uid));
        const res = await fetch(
          `/api/mail/messages/${summary.uid}?identityId=${summary.identityId}&folder=${encodeURIComponent(summary.folder)}&remoteId=${remoteId}`,
        );
        if (!res.ok) throw new Error("Failed to load message");
        const data = await res.json();
        if (!cancelled) setSelectedMessage(data);
        await fetch(`/api/mail/messages/${summary.uid}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identityId: summary.identityId,
            folder: summary.folder,
            remoteId: summary.remoteId || String(summary.uid),
            seen: true,
          }),
        });
      } catch {
        if (!cancelled) toast.error("Could not open message");
      } finally {
        if (!cancelled) setLoadingMessage(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedId, messages, setLoadingMessage, setSelectedMessage]);

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
      <section className="flex h-full flex-1 flex-col bg-bg p-8">
        <div className="skeleton mb-4 h-6 w-2/3" />
        <div className="skeleton mb-6 h-4 w-1/3" />
        <div className="space-y-3">
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-5/6" />
        </div>
      </section>
    );
  }

  const html = decrypted
    ? `<pre style="white-space:pre-wrap;font-family:inherit">${decrypted
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</pre>`
    : selectedMessage.html
      ? DOMPurify.sanitize(selectedMessage.html)
      : `<pre style="white-space:pre-wrap;font-family:inherit">${(selectedMessage.text || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}</pre>`;
  const pgpLocked = !decrypted && isPgpBody(selectedMessage.text, selectedMessage.html);

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
    const summary = messages.find((m) => m.id === selectedId);
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
    await fetch(`/api/mail/messages/${summary.uid}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identityId: summary.identityId,
        folder: summary.folder,
        remoteId: summary.remoteId || String(summary.uid),
        action: "move",
        destination,
      }),
    });
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
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-text">
          {selectedMessage.subject}
        </h1>

        <div className="mt-5 flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-border-strong text-[12px] font-semibold text-text-2">
            {initials(selectedMessage.from.name, selectedMessage.from.address)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-semibold">
                {selectedMessage.from.name || selectedMessage.from.address}
              </span>
              <span className="mono text-[12px] text-text-3">
                {selectedMessage.from.address}
              </span>
              <span className="ml-auto text-[12px] text-text-3">
                {formatMessageDate(selectedMessage.date)}
              </span>
            </div>
            <button
              onClick={() => setHeadersOpen((v) => !v)}
              className="mt-1 text-[12px] text-text-2 hover:text-text"
            >
              {headersOpen ? "Hide details" : "Show details"}
            </button>
            {headersOpen && (
              <div className="mt-2 space-y-1 text-[12px] text-text-2">
                <div>
                  <span className="text-text-3">To </span>
                  {selectedMessage.to.map((t) => t.address).join(", ")}
                </div>
                {selectedMessage.cc.length > 0 && (
                  <div>
                    <span className="text-text-3">Cc </span>
                    {selectedMessage.cc.map((t) => t.address).join(", ")}
                  </div>
                )}
                {selectedMessage.identityEmail && (
                  <div>
                    <span className="text-text-3">Via </span>
                    <span className="mono">{selectedMessage.identityEmail}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {selectedMessage.attachments.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {selectedMessage.attachments.map((a) => (
              <div
                key={a.filename}
                className="rounded-[10px] border border-border bg-surface px-3 py-2 text-[12px]"
              >
                <div className="font-medium">{a.filename}</div>
                <div className="text-text-3 mono">
                  {(a.size / 1024).toFixed(0)} KB
                </div>
              </div>
            ))}
            <Button size="sm" variant="secondary">
              Download all
            </Button>
          </div>
        )}

        {!showRemote && selectedMessage.html?.includes("http") && (
          <div className="mt-4 flex items-center justify-between rounded-[10px] border border-border bg-surface px-3 py-2 text-[12px] text-text-2">
            <span>Remote images are blocked.</span>
            <div className="flex gap-2">
              <button className="font-medium text-accent" onClick={() => setShowRemote(true)}>
                Show
              </button>
            </div>
          </div>
        )}

        {pgpLocked && (
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

        {decrypted && (
          <div className="mt-4 rounded-[10px] border border-border bg-surface px-3 py-2 text-[12px] text-ok">
            Decrypted with your private key.
          </div>
        )}

        <article
          className={`email-content mt-6 rounded-[12px] border border-border bg-email-sheet p-6 text-[15px] leading-[1.6] text-email-body shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${
            showRemote ? "" : "block-remote"
          }`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </section>
  );
}

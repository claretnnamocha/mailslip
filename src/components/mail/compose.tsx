"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useMailStore } from "@/stores/mail-store";
import { cn, parseAddressList } from "@/lib/utils";
import {
  BoldIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  MaximizeIcon,
  PaperclipIcon,
  XIcon,
} from "./icons";

export function Compose() {
  const {
    composeOpen,
    composeMode,
    composeFullscreen,
    setComposeFullscreen,
    closeCompose,
    identities,
    activeIdentityId,
    selectedMessage,
  } = useMailStore();

  const defaultIdentity =
    activeIdentityId !== "all"
      ? activeIdentityId
      : identities[0]?.id || "";

  const [identityId, setIdentityId] = useState(defaultIdentity);
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [plain, setPlain] = useState(false);
  const [sending, setSending] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  const replyDefaults = useMemo(() => {
    if (!selectedMessage || composeMode === "new") return null;
    if (composeMode === "forward") {
      return {
        to: "",
        subject: selectedMessage.subject.startsWith("Fwd:")
          ? selectedMessage.subject
          : `Fwd: ${selectedMessage.subject}`,
        body: `\n\n---------- Forwarded message ----------\nFrom: ${selectedMessage.from.address}\nSubject: ${selectedMessage.subject}\n\n${selectedMessage.text || ""}`,
      };
    }
    const replyTo = selectedMessage.from.address;
    const all =
      composeMode === "replyAll"
        ? [
            replyTo,
            ...selectedMessage.to.map((t) => t.address),
            ...selectedMessage.cc.map((t) => t.address),
          ]
            .filter((v, i, a) => a.indexOf(v) === i)
            .join(", ")
        : replyTo;
    return {
      to: all,
      subject: selectedMessage.subject.startsWith("Re:")
        ? selectedMessage.subject
        : `Re: ${selectedMessage.subject}`,
      body: `\n\nOn ${selectedMessage.date}, ${selectedMessage.from.name || selectedMessage.from.address} wrote:\n> ${(selectedMessage.text || "").split("\n").join("\n> ")}`,
    };
  }, [selectedMessage, composeMode]);

  useEffect(() => {
    if (!composeOpen) return;
    setIdentityId(defaultIdentity);
    if (replyDefaults) {
      setTo(replyDefaults.to);
      setSubject(replyDefaults.subject);
      setBody(replyDefaults.body);
    } else {
      setTo("");
      setCc("");
      setBcc("");
      setSubject("");
      setBody("");
    }
  }, [composeOpen, replyDefaults, defaultIdentity]);

  useEffect(() => {
    if (!composeOpen) return;
    const t = setTimeout(() => setDraftSaved(true), 1200);
    return () => clearTimeout(t);
  }, [to, subject, body, composeOpen]);

  if (!composeOpen) return null;

  async function send() {
    if (!identityId) {
      toast.error("Choose a From identity");
      return;
    }
    if (!to.trim()) {
      toast.error("Add at least one recipient");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identityId,
          to: parseAddressList(to),
          cc: parseAddressList(cc),
          bcc: parseAddressList(bcc),
          subject,
          html: plain ? undefined : body.replace(/\n/g, "<br/>"),
          text: body,
          inReplyTo: selectedMessage?.messageId,
          references: selectedMessage?.references,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Send failed");
      }
      toast.success("Message sent", {
        description: "Undo send available for a few seconds",
        action: {
          label: "Undo",
          onClick: () => toast.message("Send cancelled"),
        },
      });
      closeCompose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  function discard() {
    if (to || subject || body) {
      if (!confirm("Discard this draft?")) return;
    }
    closeCompose();
  }

  return (
    <div
      className={cn(
        "fixed z-50 flex flex-col border border-border bg-surface shadow-[var(--shadow)]",
        composeFullscreen
          ? "inset-4 rounded-2xl"
          : "bottom-4 right-4 h-[560px] w-[min(560px,calc(100vw-2rem))] rounded-2xl",
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="text-[14px] font-semibold">
          {composeMode === "new" ? "New message" : composeMode === "forward" ? "Forward" : "Reply"}
        </div>
        <div className="flex items-center gap-1">
          {draftSaved && (
            <span className="mr-2 text-[12px] text-text-3">Draft saved</span>
          )}
          <button
            className="rounded-lg p-2 text-text-2 hover:bg-hover"
            onClick={() => setComposeFullscreen(!composeFullscreen)}
          >
            <MaximizeIcon size={16} />
          </button>
          <button className="rounded-lg p-2 text-text-2 hover:bg-hover" onClick={discard}>
            <XIcon size={16} />
          </button>
        </div>
      </div>

      <div className="space-y-0 border-b border-border px-4 py-2 text-[13px]">
        <div className="flex items-center gap-2 py-1.5">
          <span className="w-12 text-text-3">From</span>
          <select
            value={identityId}
            onChange={(e) => setIdentityId(e.target.value)}
            className="flex-1 bg-transparent mono text-text outline-none"
          >
            {identities.map((i) => (
              <option key={i.id} value={i.id}>
                {i.email}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 py-1.5">
          <span className="w-12 text-text-3">To</span>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="flex-1 bg-transparent mono outline-none placeholder:text-text-3"
            placeholder="recipient@example.com"
          />
          {!showCc && (
            <button className="text-text-3 hover:text-text" onClick={() => setShowCc(true)}>
              Cc/Bcc
            </button>
          )}
        </div>
        {showCc && (
          <>
            <div className="flex items-center gap-2 py-1.5">
              <span className="w-12 text-text-3">Cc</span>
              <input
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                className="flex-1 bg-transparent mono outline-none"
              />
            </div>
            <div className="flex items-center gap-2 py-1.5">
              <span className="w-12 text-text-3">Bcc</span>
              <input
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                className="flex-1 bg-transparent mono outline-none"
              />
            </div>
          </>
        )}
        <div className="flex items-center gap-2 py-1.5">
          <span className="w-12 text-text-3">Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="flex-1 bg-transparent outline-none"
            placeholder="Subject"
          />
        </div>
      </div>

      {!plain && (
        <div className="flex items-center gap-1 border-b border-border px-3 py-1.5 text-text-2">
          <button className="rounded-md p-1.5 hover:bg-hover"><BoldIcon size={15} /></button>
          <button className="rounded-md p-1.5 hover:bg-hover"><ItalicIcon size={15} /></button>
          <button className="rounded-md p-1.5 hover:bg-hover"><LinkIcon size={15} /></button>
          <button className="rounded-md p-1.5 hover:bg-hover"><ListIcon size={15} /></button>
          <button className="rounded-md p-1.5 hover:bg-hover"><PaperclipIcon size={15} /></button>
          <button
            className="ml-auto text-[12px] text-text-3 hover:text-text"
            onClick={() => setPlain(true)}
          >
            Plain text
          </button>
        </div>
      )}

      <textarea
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          setDraftSaved(false);
        }}
        className="flex-1 resize-none bg-transparent px-4 py-3 text-[14px] leading-relaxed outline-none"
        placeholder="Write your message…"
      />

      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <Button size="sm" variant="ghost" onClick={discard}>
          Discard
        </Button>
        <Button size="sm" onClick={send} disabled={sending}>
          {sending ? "Sending…" : "Send"}
        </Button>
      </div>
    </div>
  );
}

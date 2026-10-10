"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/dialog-provider";
import { useMailStore } from "@/stores/mail-store";
import { folderRole } from "@/lib/mail/folder-map";
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
    folder,
    setMessages,
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
  const [encrypt, setEncrypt] = useState(false);
  const [sign, setSign] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const { confirm, prompt } = useDialog();

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
    let passphrase: string | undefined;
    if (encrypt && sign) {
      const entered = await prompt({
        title: "PGP passphrase",
        description: "Enter the passphrase for your private key, if it has one.",
        label: "Passphrase",
        inputType: "password",
        confirmLabel: "Encrypt & send",
      });
      if (entered === null) return;
      passphrase = entered || undefined;
    }

    setSending(true);
    try {
      const undoAt = new Date(Date.now() + 10_000).toISOString();
      const replyFolder = selectedMessage?.folder;
      const copyToFolder =
        selectedMessage &&
        (composeMode === "reply" || composeMode === "replyAll") &&
        replyFolder &&
        folderRole({ path: replyFolder, name: replyFolder.split(/[./]/).pop() || replyFolder }) !==
          "sent"
          ? replyFolder
          : undefined;
      const references = selectedMessage?.messageId
        ? [
            ...(selectedMessage.references || []),
            selectedMessage.messageId,
          ].filter((id, index, list) => list.indexOf(id) === index)
        : selectedMessage?.references;
      const payload = {
        identityId,
        to: parseAddressList(to),
        cc: parseAddressList(cc),
        bcc: parseAddressList(bcc),
        subject,
        html: plain ? undefined : body.replace(/\n/g, "<br/>"),
        text: body,
        inReplyTo: selectedMessage?.messageId,
        references,
        copyToFolder,
        encrypt,
        sign: encrypt && sign,
        passphrase,
        scheduleAt: scheduleAt || undoAt,
      };
      const res = await fetch("/api/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Send failed");
      }
      const data = await res.json();
      if (data.scheduled && !scheduleAt) {
        const scheduledId = data.id as string;
        toast.success("Sending…", {
          description: "Undo available for 10 seconds",
          duration: 10_000,
          action: {
            label: "Undo",
            onClick: () => {
              void fetch(`/api/mail/scheduled/${scheduledId}`, { method: "DELETE" }).then(() =>
                toast.message("Send cancelled"),
              );
            },
          },
        });
      } else if (data.scheduled) {
        toast.success("Scheduled", { description: `Sends at ${new Date(data.sendAt).toLocaleString()}` });
      } else {
        toast.success("Message sent");
        if (activeIdentityId !== "all" && folder) {
          const params = new URLSearchParams({ folder, identityId: activeIdentityId });
          const listRes = await fetch(`/api/mail/messages?${params}`);
          if (listRes.ok) setMessages(await listRes.json());
        }
      }
      closeCompose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  async function discard() {
    if (to || subject || body) {
      const ok = await confirm({
        title: "Discard draft?",
        description: "This message has content that hasn’t been sent.",
        confirmLabel: "Discard",
        tone: "danger",
      });
      if (!ok) return;
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

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
        <Button size="sm" variant="ghost" onClick={discard}>
          Discard
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[12px] text-text-2">
            <input type="checkbox" checked={encrypt} onChange={(e) => setEncrypt(e.target.checked)} />
            PGP encrypt
          </label>
          {encrypt && (
            <label className="flex items-center gap-1.5 text-[12px] text-text-2">
              <input type="checkbox" checked={sign} onChange={(e) => setSign(e.target.checked)} />
              Sign
            </label>
          )}
          <input
            type="datetime-local"
            value={scheduleAt ? scheduleAt.slice(0, 16) : ""}
            onChange={(e) =>
              setScheduleAt(e.target.value ? new Date(e.target.value).toISOString() : "")
            }
            className="h-9 rounded-[9px] border border-border-strong bg-surface px-2 text-[12px]"
            title="Schedule send"
          />
          <Button size="sm" onClick={send} disabled={sending}>
            {sending ? "Sending…" : scheduleAt ? "Schedule" : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}

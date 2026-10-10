"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { Sidebar } from "./sidebar";
import { MessageList } from "./message-list";
import { MessageView } from "./message-view";
import { Compose } from "./compose";
import { useMailStore } from "@/stores/mail-store";
import { resolveFolderPath } from "@/lib/mail/folder-map";
import { groupThreads, threadContaining } from "@/lib/mail/thread";
import type { MailFolder } from "@/lib/mail/types";
import { cn } from "@/lib/utils";
import { MenuIcon, PlusIcon, SearchIcon, XIcon } from "./icons";

export function MailShell() {
  const router = useRouter();
  const [mobileNav, setMobileNav] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "message">("list");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const {
    identities,
    setIdentities,
    setWorkspaceRole,
    workspaceRole,
    activeIdentityId,
    setActiveIdentityId,
    folder,
    setFolder,
    setFolders,
    setMessages,
    setLoadingList,
    messages,
    selectedId,
    setSelectedId,
    closeMessage,
    openCompose,
    closeCompose,
    composeOpen,
    selectedMessage,
  } = useMailStore();
  const folderRef = useRef(folder);
  folderRef.current = folder;

  useEffect(() => {
    (async () => {
      const [idRes, teamRes] = await Promise.all([
        fetch("/api/identities"),
        fetch("/api/team"),
      ]);
      if (idRes.status === 401 || teamRes.status === 401) {
        await signOut({ callbackUrl: "/login" });
        return;
      }
      const team = teamRes.ok ? await teamRes.json() : null;
      const role = typeof team?.role === "string" ? team.role : null;
      const isAdmin = role === "OWNER" || role === "ADMIN";
      setWorkspaceRole(role);
      if (!idRes.ok) return;
      const data = await idRes.json();
      setIdentities(data);
      if (data.length === 0 && isAdmin) {
        router.replace("/onboarding");
      }
    })();
  }, [router, setIdentities, setWorkspaceRole]);

  useEffect(() => {
    if (identities.length === 0) return;
    if (activeIdentityId === "all" || !identities.some((identity) => identity.id === activeIdentityId)) {
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/mail/folders?identityId=${activeIdentityId}`);
      if (cancelled) return;
      if (!res.ok) {
        setFolders([]);
        return;
      }
      const list = (await res.json()) as MailFolder[];
      const byPath = new Map<string, MailFolder>();
      for (const item of list) {
        if (!byPath.has(item.path)) byPath.set(item.path, item);
      }
      const next = [...byPath.values()];
      setFolders(next);
      const current = folderRef.current;
      const resolved = resolveFolderPath(current, next);
      if (resolved !== current) setFolder(resolved);
    })();
    return () => {
      cancelled = true;
    };
  }, [identities, activeIdentityId, setFolder, setFolders]);

  useEffect(() => {
    if (identities.length === 0) return;
    if (activeIdentityId === "all" || !identities.some((identity) => identity.id === activeIdentityId)) {
      setActiveIdentityId(identities[0].id);
    }
  }, [identities, activeIdentityId, setActiveIdentityId]);

  useEffect(() => {
    if (identities.length === 0 || activeIdentityId === "all") return;
    let cancelled = false;
    (async () => {
      setLoadingList(true);
      try {
        const params = new URLSearchParams({ folder, identityId: activeIdentityId });
        if (query.trim()) params.set("q", query.trim());
        const res = await fetch(`/api/mail/messages?${params}`);
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        if (!cancelled) setMessages(data);
      } catch {
        if (!cancelled) setMessages([]);
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [identities, activeIdentityId, folder, query, setLoadingList, setMessages]);

  useEffect(() => {
    setMobileView(selectedId ? "message" : "list");
  }, [selectedId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (typing) return;

      if (e.key === "Escape") {
        if (document.querySelector('[role="alertdialog"]')) return;
        if (composeOpen) {
          e.preventDefault();
          closeCompose();
          return;
        }
        if (selectedId) {
          e.preventDefault();
          closeMessage();
        }
        return;
      }
      if (e.key === "/" || (e.key === "f" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (e.key === "c") {
        e.preventDefault();
        openCompose("new");
        return;
      }
      if (e.key === "r" && selectedMessage) {
        e.preventDefault();
        openCompose("reply");
        return;
      }
      if (e.key === "a" && selectedMessage) {
        e.preventDefault();
        openCompose("replyAll");
        return;
      }
      if (e.key === "f" && selectedMessage) {
        e.preventDefault();
        openCompose("forward");
        return;
      }
      if ((e.key === "e" || e.key === "#") && selectedId) {
        e.preventDefault();
        const thread = threadContaining(messages, selectedId);
        const targets = thread?.messages || messages.filter((message) => message.id === selectedId);
        if (targets.length === 0) return;
        const destination = e.key === "e" ? "Archive" : "Trash";
        void Promise.all(
          targets.map((summary) =>
            fetch(`/api/mail/messages/${summary.uid}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                identityId: summary.identityId,
                folder: summary.folder,
                remoteId: summary.remoteId,
                action: "move",
                destination,
              }),
            }),
          ),
        ).then(() => {
          toast.success(e.key === "e" ? "Archived" : "Moved to trash");
          const removed = new Set(targets.map((message) => message.id));
          setMessages(messages.filter((message) => !removed.has(message.id)));
          setSelectedId(null);
        });
        return;
      }
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        const threads = groupThreads(messages).filter((thread) =>
          unreadOnly ? thread.messages.some((message) => !message.seen) : true,
        );
        if (threads.length === 0) return;
        const idx = threads.findIndex((thread) => thread.messages.some((message) => message.id === selectedId));
        const next =
          e.key === "j"
            ? threads[Math.min(threads.length - 1, Math.max(0, idx) + 1)]
            : threads[Math.max(0, (idx < 0 ? 1 : idx) - 1)];
        if (next) setSelectedId(next.latest.id);
        return;
      }
      if (e.key === "?" ) {
        toast.message("Shortcuts", {
          description: "C compose · R reply · E archive · # trash · J/K move · Esc close · / search",
        });
      }
      if (e.key === "1") setFolder("INBOX");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    messages,
    selectedId,
    selectedMessage,
    openCompose,
    setFolder,
    setMessages,
    setSelectedId,
    closeMessage,
    closeCompose,
    composeOpen,
    unreadOnly,
  ]);

  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
      {mobileNav && (
        <button
          className="fixed inset-0 z-30 bg-black/20 md:hidden"
          onClick={() => setMobileNav(false)}
          aria-label="Close navigation"
        />
      )}
      <Sidebar mobileOpen={mobileNav} onClose={() => setMobileNav(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <button
            className="rounded-lg p-2 text-text-2 hover:bg-hover md:hidden"
            aria-label={mobileView === "message" ? "Close message" : "Open navigation"}
            onClick={() => {
              if (mobileView === "message") closeMessage();
              else setMobileNav(true);
            }}
          >
            {mobileView === "message" ? <XIcon size={18} /> : <MenuIcon size={18} />}
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-border-strong bg-surface px-3 py-2">
            <SearchIcon size={16} className="shrink-0 text-text-3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search mail"
              className="w-full bg-transparent text-[13px] outline-none placeholder:text-text-3"
            />
            {query && (
              <button
                className="text-[12px] text-text-3 hover:text-text"
                onClick={() => setQuery("")}
              >
                Clear
              </button>
            )}
          </div>
          <button
            type="button"
            aria-pressed={unreadOnly}
            onClick={() => setUnreadOnly((value) => !value)}
            className={cn(
              "mono shrink-0 rounded-[7px] border px-2.5 py-1.5 text-[11px] font-medium",
              unreadOnly
                ? "border-accent/30 bg-accent-tint text-accent"
                : "border-border bg-surface-2 text-text-2 hover:bg-hover",
            )}
          >
            Unread
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className={mobileView === "list" ? "flex w-full md:w-auto" : "hidden md:flex"}>
            <MessageList
              query={query}
              unreadOnly={unreadOnly}
              onSelect={() => setMobileView("message")}
            />
          </div>
          <div
            className={
              mobileView === "message"
                ? "flex min-w-0 flex-1"
                : "hidden md:flex md:min-w-0 md:flex-1"
            }
          >
            <MessageView />
          </div>
        </div>
      </div>

      <button
        className="fixed bottom-5 right-5 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white shadow-lg md:hidden"
        onClick={() => openCompose("new")}
        aria-label="Compose"
      >
        <PlusIcon size={20} />
      </button>

      {identities.length === 0 && workspaceRole && workspaceRole !== "OWNER" && workspaceRole !== "ADMIN" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-6">
          <div className="max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-[var(--shadow)]">
            <h2 className="text-[22px] font-semibold tracking-[-0.02em]">
              No mailbox yet
            </h2>
            <p className="mt-2 text-[14px] text-text-2">
              An admin connects mailboxes for members. You&apos;ll see mail here once one is assigned to you.
            </p>
          </div>
        </div>
      )}

      {searchOpen && !query && (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full border border-border bg-surface px-4 py-2 text-[12px] text-text-3 shadow-[var(--shadow)]">
          Press <span className="mono">?</span> for shortcuts
        </div>
      )}

      <Compose />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sidebar } from "./sidebar";
import { MessageList } from "./message-list";
import { MessageView } from "./message-view";
import { Compose } from "./compose";
import { useMailStore } from "@/stores/mail-store";
import { MenuIcon, PlusIcon, SearchIcon } from "./icons";

export function MailShell() {
  const router = useRouter();
  const [mobileNav, setMobileNav] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "message">("list");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const {
    identities,
    setIdentities,
    setWorkspaceRole,
    workspaceRole,
    activeIdentityId,
    folder,
    setFolder,
    setMessages,
    setLoadingList,
    messages,
    selectedId,
    setSelectedId,
    openCompose,
    selectedMessage,
  } = useMailStore();

  useEffect(() => {
    (async () => {
      const [idRes, teamRes] = await Promise.all([
        fetch("/api/identities"),
        fetch("/api/team"),
      ]);
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
    let cancelled = false;
    (async () => {
      setLoadingList(true);
      try {
        const params = new URLSearchParams({ folder });
        if (activeIdentityId !== "all") params.set("identityId", activeIdentityId);
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
    if (selectedId) setMobileView("message");
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
      if (e.key === "e" && selectedId) {
        e.preventDefault();
        const summary = messages.find((m) => m.id === selectedId);
        if (!summary) return;
        void fetch(`/api/mail/messages/${summary.uid}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identityId: summary.identityId,
            folder: summary.folder,
            remoteId: summary.remoteId,
            action: "move",
            destination: "Archive",
          }),
        }).then(() => {
          toast.success("Archived");
          setMessages(messages.filter((m) => m.id !== selectedId));
          setSelectedId(null);
        });
        return;
      }
      if (e.key === "#" && selectedId) {
        e.preventDefault();
        const summary = messages.find((m) => m.id === selectedId);
        if (!summary) return;
        void fetch(`/api/mail/messages/${summary.uid}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identityId: summary.identityId,
            folder: summary.folder,
            remoteId: summary.remoteId,
            action: "move",
            destination: "Trash",
          }),
        }).then(() => {
          toast.success("Moved to trash");
          setMessages(messages.filter((m) => m.id !== selectedId));
          setSelectedId(null);
        });
        return;
      }
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        if (messages.length === 0) return;
        const idx = messages.findIndex((m) => m.id === selectedId);
        const next =
          e.key === "j"
            ? messages[Math.min(messages.length - 1, Math.max(0, idx) + 1)]
            : messages[Math.max(0, (idx < 0 ? 1 : idx) - 1)];
        if (next) setSelectedId(next.id);
        return;
      }
      if (e.key === "?" ) {
        toast.message("Shortcuts", {
          description: "C compose · R reply · E archive · # trash · J/K move · / search",
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
            onClick={() => {
              if (mobileView === "message") setMobileView("list");
              else setMobileNav(true);
            }}
          >
            <MenuIcon size={18} />
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
        </div>

        <div className="flex min-h-0 flex-1">
          <div className={mobileView === "list" ? "flex w-full md:w-auto" : "hidden md:flex"}>
            <MessageList onSelect={() => setMobileView("message")} />
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

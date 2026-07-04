"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { MessageList } from "./message-list";
import { MessageView } from "./message-view";
import { Compose } from "./compose";
import { useMailStore } from "@/stores/mail-store";
import { MenuIcon, PlusIcon } from "./icons";
import { Button } from "@/components/ui/button";

export function MailShell() {
  const router = useRouter();
  const [mobileNav, setMobileNav] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "message">("list");
  const {
    identities,
    setIdentities,
    activeIdentityId,
    folder,
    setMessages,
    setLoadingList,
    selectedId,
    openCompose,
  } = useMailStore();

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/identities");
      if (!res.ok) return;
      const data = await res.json();
      setIdentities(data);
      if (data.length === 0) {
        router.replace("/onboarding");
      }
    })();
  }, [router, setIdentities]);

  useEffect(() => {
    if (identities.length === 0) return;
    let cancelled = false;
    (async () => {
      setLoadingList(true);
      try {
        const params = new URLSearchParams({ folder });
        if (activeIdentityId !== "all") params.set("identityId", activeIdentityId);
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
  }, [identities, activeIdentityId, folder, setLoadingList, setMessages]);

  useEffect(() => {
    if (selectedId) setMobileView("message");
  }, [selectedId]);

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
        <div className="flex items-center gap-2 border-b border-border px-3 py-2 md:hidden">
          <button
            className="rounded-lg p-2 text-text-2 hover:bg-hover"
            onClick={() => {
              if (mobileView === "message") setMobileView("list");
              else setMobileNav(true);
            }}
          >
            <MenuIcon size={18} />
          </button>
          <span className="text-[14px] font-semibold">Mailslip</span>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className={mobileView === "list" ? "flex w-full md:w-auto" : "hidden md:flex"}>
            <MessageList onSelect={() => setMobileView("message")} />
          </div>
          <div className={mobileView === "message" ? "flex min-w-0 flex-1" : "hidden md:flex md:min-w-0 md:flex-1"}>
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

      {identities.length === 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-6">
          <div className="max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-[var(--shadow)]">
            <h2 className="text-[22px] font-semibold tracking-[-0.02em]">
              Connect your first account
            </h2>
            <p className="mt-2 text-[14px] text-text-2">
              Mailslip is a client, not a host. Point it at a mailbox you already own.
            </p>
            <Button className="mt-6 w-full" onClick={() => router.push("/onboarding")}>
              Get started
            </Button>
          </div>
        </div>
      )}

      <Compose />
    </div>
  );
}

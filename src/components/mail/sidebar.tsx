"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { useMailStore } from "@/stores/mail-store";
import { cn, initials } from "@/lib/utils";
import {
  ArchiveIcon,
  EditIcon,
  InboxIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  SettingsIcon,
  TrashIcon,
  BanIcon,
} from "./icons";

const nav = [
  { id: "INBOX", label: "Inbox", icon: InboxIcon },
  { id: "Sent", label: "Sent", icon: SendIcon },
  { id: "Drafts", label: "Drafts", icon: EditIcon },
  { id: "Archive", label: "Archive", icon: ArchiveIcon },
  { id: "Trash", label: "Trash", icon: TrashIcon },
  { id: "Junk", label: "Spam", icon: BanIcon },
];

export function Sidebar({ mobileOpen, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  const { data: session } = useSession();
  const {
    folder,
    setFolder,
    identities,
    workspaceRole,
    activeIdentityId,
    setActiveIdentityId,
    openCompose,
  } = useMailStore();

  return (
    <aside
      className={cn(
        "flex h-full w-[220px] shrink-0 flex-col border-r border-border bg-surface-2",
        "fixed inset-y-0 left-0 z-40 transition-transform md:static md:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      )}
    >
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-3">
        <LogoMark size={28} />
        <span className="text-[15px] font-semibold tracking-[-0.01em]">
          Mail<span className="font-normal">slip</span>
        </span>
      </div>

      <div className="px-3 pb-3">
        <Button
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => {
            openCompose("new");
            onClose?.();
          }}
        >
          <PlusIcon size={16} />
          Compose
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2">
        <div className="mb-4 space-y-0.5">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = folder === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setFolder(item.id);
                  onClose?.();
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13.5px] font-medium transition-colors duration-150",
                  active
                    ? "bg-accent-tint text-text border-l-2 border-accent pl-[10px]"
                    : "text-text-2 hover:bg-hover hover:text-text",
                )}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="mb-2 px-3 text-[11px] font-medium uppercase tracking-[0.08em] text-text-3 mono">
          Identities
        </div>
        <div className="space-y-0.5">
          <button
            onClick={() => setActiveIdentityId("all")}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] transition-colors",
              activeIdentityId === "all"
                ? "bg-accent-tint text-text"
                : "text-text-2 hover:bg-hover",
            )}
          >
            <span className="h-2 w-2 rounded-full bg-text-3" />
            All inboxes
          </button>
          {identities.map((identity) => (
            <button
              key={identity.id}
              onClick={() => setActiveIdentityId(identity.id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] transition-colors",
                activeIdentityId === identity.id
                  ? "bg-accent-tint text-text"
                  : "text-text-2 hover:bg-hover",
              )}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: identity.color }}
              />
              <span className="mono truncate">{identity.email}</span>
            </button>
          ))}
          {(workspaceRole === "OWNER" || workspaceRole === "ADMIN") && (
            <Link
              href="/onboarding"
              className="flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] text-text-3 hover:bg-hover hover:text-text"
            >
              <PlusIcon size={14} />
              Add identity
            </Link>
          )}
        </div>
      </nav>

      <div className="border-t border-border p-3">
        <Link
          href="/mail?search=1"
          className="mb-1 flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] text-text-2 hover:bg-hover"
        >
          <SearchIcon size={16} />
          Search
        </Link>
        <Link
          href="/settings"
          className="mb-1 flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] text-text-2 hover:bg-hover"
        >
          <SettingsIcon size={16} />
          Settings
        </Link>
        <SignOutButton variant="sidebar" />
        <div className="mt-2 flex items-center gap-2.5 rounded-[10px] px-3 py-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-white">
            {initials(session?.user?.name, session?.user?.email)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-text">
              {session?.user?.name || "Account"}
            </span>
            <span className="block truncate text-[11px] text-text-3 mono">
              {session?.user?.email}
            </span>
          </span>
        </div>
      </div>
    </aside>
  );
}

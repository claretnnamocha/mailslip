"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/dialog-provider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useWorkspaceRole } from "@/lib/use-workspace-role";

type Identity = {
  id: string;
  email: string;
  displayName?: string | null;
  color: string;
  type: string;
  access: "SHARED" | "PERSONAL";
  ownerUserId?: string | null;
  connected: boolean;
  spfOk?: boolean | null;
  dkimOk?: boolean | null;
  dmarcOk?: boolean | null;
  mxOk?: boolean | null;
};

export default function IdentitiesSettingsPage() {
  const [identities, setIdentities] = useState<Identity[]>([]);
  const { data: session } = useSession();
  const { confirm } = useDialog();
  const { isAdmin } = useWorkspaceRole();
  const userId = session?.user?.id;

  async function load() {
    const res = await fetch("/api/identities");
    if (res.ok) setIdentities(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  function canManage(identity: Identity) {
    if (identity.access === "PERSONAL") return identity.ownerUserId === userId;
    return isAdmin || identity.ownerUserId === userId;
  }

  async function setAccess(identity: Identity, access: "SHARED" | "PERSONAL") {
    if (access === "PERSONAL") {
      const ok = await confirm({
        title: "Make this mailbox personal?",
        description:
          "Only you will be able to use and manage it. Other admins and teammates lose access, and it can no longer be assigned.",
        confirmLabel: "Make personal",
        tone: "danger",
      });
      if (!ok) return;
    }
    const res = await fetch(`/api/identities/${identity.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access }),
    });
    if (!res.ok) {
      toast.error("Could not update access");
      return;
    }
    toast.success(access === "PERSONAL" ? "Mailbox is now personal" : "Mailbox is shared with the workspace");
    load();
  }

  async function disconnect(id: string) {
    const ok = await confirm({
      title: "Disconnect identity?",
      description:
        "Mailslip will remove this connection. Mail on your own server is never touched.",
      confirmLabel: "Disconnect",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/identities/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not disconnect");
      return;
    }
    toast.success("Identity disconnected");
    load();
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[27px] font-semibold tracking-[-0.02em]">Mail identities</h1>
          <p className="mt-2 text-[15px] text-text-2">
            {isAdmin
              ? "Shared mailboxes can be assigned to teammates. Personal ones stay with one profile only."
              : "Mailboxes an admin has connected for you, plus any personal mailbox you own."}
          </p>
        </div>
        {isAdmin && (
          <Link href="/onboarding">
            <Button size="sm">Add identity</Button>
          </Link>
        )}
      </div>

      <div className="mt-8 space-y-3">
        {identities.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border-strong bg-surface p-8 text-center text-text-2">
            {isAdmin
              ? "No identities yet. Connect a mailbox, or set one up for a member from Team."
              : "No mailbox yet. An admin connects mailboxes for members."}
          </div>
        )}
        {identities.map((identity) => (
          <div
            key={identity.id}
            className="rounded-2xl border border-border bg-surface p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: identity.color }}
                />
                <div>
                  <div className="font-semibold">{identity.displayName || identity.email}</div>
                  <div className="mono text-[13px] text-text-2">{identity.email}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-text-3">
                    <span>{identity.type.replaceAll("_", " ").toLowerCase()}</span>
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                        identity.access === "PERSONAL"
                          ? "bg-accent-tint text-text"
                          : "bg-hover text-text-2",
                      )}
                    >
                      {identity.access === "PERSONAL" ? "Personal" : "Shared"}
                    </span>
                  </div>
                </div>
              </div>
              <span
                className={cn(
                  "mono flex items-center gap-1.5 text-[11px] font-medium",
                  identity.connected ? "text-ok" : "text-text-3",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    identity.connected ? "bg-ok" : "bg-text-3",
                  )}
                />
                {identity.connected ? "Connected" : "Disconnected"}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(
                [
                  ["MX", identity.mxOk],
                  ["SPF", identity.spfOk],
                  ["DKIM", identity.dkimOk],
                  ["DMARC", identity.dmarcOk],
                ] as const
              ).map(([label, ok]) => (
                <span
                  key={label}
                  className={cn(
                    "rounded-md px-2 py-1 text-[11px] mono",
                    ok === true && "bg-ok/10 text-ok",
                    ok === false && "bg-danger/10 text-danger",
                    ok == null && "bg-hover text-text-3",
                  )}
                >
                  {label}
                </span>
              ))}
            </div>
            {canManage(identity) && (
              <div className="mt-4 flex flex-wrap gap-2">
                {identity.access === "SHARED" ? (
                  <Button size="sm" variant="secondary" onClick={() => setAccess(identity, "PERSONAL")}>
                    Make personal
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => setAccess(identity, "SHARED")}>
                    Make shared
                  </Button>
                )}
                <Button size="sm" variant="danger" onClick={() => disconnect(identity.id)}>
                  Disconnect
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

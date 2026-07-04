"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Identity = {
  id: string;
  email: string;
  displayName?: string | null;
  color: string;
  type: string;
  connected: boolean;
  spfOk?: boolean | null;
  dkimOk?: boolean | null;
  dmarcOk?: boolean | null;
  mxOk?: boolean | null;
};

export default function IdentitiesSettingsPage() {
  const [identities, setIdentities] = useState<Identity[]>([]);

  async function load() {
    const res = await fetch("/api/identities");
    if (res.ok) setIdentities(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function disconnect(id: string) {
    if (!confirm("Disconnect this identity? Mail on your server is never touched.")) return;
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
            Mailboxes, scoped aliases, and domain addresses connected to your profile.
          </p>
        </div>
        <Link href="/onboarding">
          <Button size="sm">Add identity</Button>
        </Link>
      </div>

      <div className="mt-8 space-y-3">
        {identities.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border-strong bg-surface p-8 text-center text-text-2">
            No identities yet. Connect a mailbox you already own.
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
                  <div className="mt-1 text-[12px] text-text-3">
                    {identity.type.replaceAll("_", " ").toLowerCase()}
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
            <div className="mt-4">
              <Button size="sm" variant="danger" onClick={() => disconnect(identity.id)}>
                Disconnect
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

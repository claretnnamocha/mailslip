"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDialog } from "@/components/dialog-provider";
import { useWorkspaceRole } from "@/lib/use-workspace-role";
import { toast } from "sonner";

type Domain = {
  id: string;
  domain: string;
  verified: boolean;
  verificationToken: string;
  catchAllEnabled: boolean;
};

export default function DomainsSettingsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [domain, setDomain] = useState("");
  const { confirm } = useDialog();
  const { isAdmin, ready } = useWorkspaceRole();

  async function load() {
    const res = await fetch("/api/domains");
    if (res.ok) setDomains(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function addDomain(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Could not add domain");
      return;
    }
    setDomain("");
    toast.success("Domain added — verify ownership with the TXT record");
    load();
  }

  async function verify(id: string) {
    const res = await fetch(`/api/domains/${id}/verify`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Verification failed");
      return;
    }
    toast.success(data.verified ? "Domain verified" : "TXT record not found yet");
    load();
  }

  async function remove(id: string, name: string) {
    const ok = await confirm({
      title: `Remove ${name}?`,
      description:
        "This releases the domain from the workspace. Connected mailboxes stay connected, and another workspace can claim the domain.",
      confirmLabel: "Remove domain",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/domains/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Could not remove domain");
      return;
    }
    toast.success("Domain removed");
    load();
  }

  return (
    <div>
      <h1 className="text-[27px] font-semibold tracking-[-0.02em]">Domain</h1>
      <p className="mt-2 text-[15px] text-text-2">
        A domain is exclusively owned by one workspace. Verify with TXT, then send as any address.
      </p>

      {ready && isAdmin && (
      <form
        onSubmit={addDomain}
        className="mt-8 flex max-w-xl flex-col gap-3 rounded-2xl border border-border bg-surface p-6 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <Input
            label="Domain"
            mono
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="aurelia.studio"
            required
          />
        </div>
        <Button type="submit" size="sm">
          Add domain
        </Button>
      </form>
      )}

      <div className="mt-8 space-y-3">
        {domains.map((d) => (
          <div key={d.id} className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-semibold mono">{d.domain}</div>
                <div className="mt-1 text-[13px] text-text-2">
                  {d.verified ? "Verified" : "Pending verification"}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                {!d.verified && isAdmin && (
                  <Button size="sm" variant="secondary" onClick={() => verify(d.id)}>
                    Check TXT
                  </Button>
                )}
                {isAdmin && (
                  <Button size="sm" variant="danger" onClick={() => remove(d.id, d.domain)}>
                    Remove
                  </Button>
                )}
              </div>
            </div>
            {!d.verified && (
              <div className="mt-4 rounded-[11px] bg-surface-2 p-4 text-[13px]">
                <div className="text-text-2">Add this TXT record:</div>
                <div className="mt-2 mono text-[12px]">
                  Host: <strong>_mailslip-verify.{d.domain}</strong>
                  <br />
                  Value: <strong>{d.verificationToken}</strong>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

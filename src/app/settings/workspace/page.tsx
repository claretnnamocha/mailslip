"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useWorkspaceRole } from "@/lib/use-workspace-role";

type WorkspaceInfo = {
  id: string;
  name: string;
  brandName?: string | null;
  customDomain?: string | null;
  mode: string;
  platformHosts: string[];
};

export default function WorkspaceSettingsPage() {
  const { isAdmin, ready } = useWorkspaceRole();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [platformHosts, setPlatformHosts] = useState<string[]>([]);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/workspace");
    setLoading(false);
    if (!res.ok) {
      toast.error("Could not load workspace");
      return;
    }
    const data = (await res.json()) as WorkspaceInfo;
    setName(data.name || "");
    setBrandName(data.brandName || "");
    setCustomDomain(data.customDomain || "");
    setPlatformHosts(data.platformHosts || []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          brandName: brandName.trim() || null,
          customDomain: customDomain.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      setName(data.name || "");
      setBrandName(data.brandName || "");
      setCustomDomain(data.customDomain || "");
      toast.success(
        data.customDomain
          ? "Custom domain saved — point DNS here, then open that host to use your branded inbox"
          : "Workspace updated",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (!ready || loading) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-40 w-full max-w-xl rounded-2xl" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div>
        <h1 className="text-[27px] font-semibold tracking-[-0.02em]">Workspace</h1>
        <p className="mt-2 text-[15px] text-text-2">
          Only owners and admins can change the workspace domain and brand.
        </p>
      </div>
    );
  }

  const entry = platformHosts[0] || "mailslip.uselinqr.io";

  return (
    <div>
      <h1 className="text-[27px] font-semibold tracking-[-0.02em]">Workspace</h1>
      <p className="mt-2 max-w-xl text-[15px] text-text-2">
        Everyone signs up on the Mailslip entry host. Attach your own domain here for a private,
        self-hosted-style experience (sign-in only, your brand).
      </p>

      <form
        onSubmit={save}
        className="mt-8 max-w-xl space-y-4 rounded-2xl border border-border bg-surface p-6"
      >
        <Input label="Workspace name" value={name} onChange={(e) => setName(e.target.value)} required />
        <div>
          <Input
            label="Brand name"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="Acme Mail"
          />
          <p className="mt-1.5 text-[12px] text-text-3">Shown in browser tabs on your domain.</p>
        </div>
        <div>
          <Input
            label="Custom domain"
            mono
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
            placeholder="mail.acme.com"
          />
          <p className="mt-1.5 text-[12px] text-text-3">
            CNAME this host to {entry}. Leave blank to use only the platform entry.
          </p>
        </div>
        <div className="rounded-[11px] border border-border bg-surface-2 px-4 py-3 text-[13px] text-text-2">
          <p>
            <span className="font-medium text-text">Platform entry:</span>{" "}
            <span className="mono">{entry}</span> — landing, signup, and your team’s usual login.
          </p>
          <p className="mt-2">
            <span className="font-medium text-text">Custom domain:</span> sign-in only, branded like
            a self-hosted install. No public signup on that host.
          </p>
        </div>
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Saving…" : "Save workspace"}
        </Button>
      </form>
    </div>
  );
}

"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useWorkspaceRole } from "@/lib/use-workspace-role";

type DomainStatus = {
  hostname: string;
  hostnameStatus: string | null;
  certificateStatus: string | null;
  ready: boolean;
};

type WorkspaceInfo = {
  id: string;
  name: string;
  slug?: string | null;
  brandName?: string | null;
  customDomain?: string | null;
  allowsCustomDomain: boolean;
  tenantBaseDomain: string;
  tenantSlugSuffix: string;
  slugHost?: string | null;
  cnameTarget: string;
  domainStatus?: DomainStatus | null;
};

export default function WorkspaceSettingsPage() {
  const { isAdmin, ready } = useWorkspaceRole();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [slug, setSlug] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [tenantBase, setTenantBase] = useState("uselinqr.io");
  const [slugSuffix, setSlugSuffix] = useState("-mail");
  const [slugHost, setSlugHost] = useState<string | null>(null);
  const [cname, setCname] = useState("cname.mailslip.uselinqr.io");
  const [allowsByod, setAllowsByod] = useState(false);
  const [domainStatus, setDomainStatus] = useState<DomainStatus | null>(null);

  function apply(data: WorkspaceInfo) {
    setName(data.name || "");
    setBrandName(data.brandName || "");
    setSlug(data.slug || "");
    setCustomDomain(data.customDomain || "");
    setTenantBase(data.tenantBaseDomain || "uselinqr.io");
    setSlugSuffix(data.tenantSlugSuffix || "-mail");
    setSlugHost(data.slugHost || null);
    setCname(data.cnameTarget || "cname.mailslip.uselinqr.io");
    setAllowsByod(Boolean(data.allowsCustomDomain));
    setDomainStatus(data.domainStatus || null);
  }

  async function load() {
    setLoading(true);
    const res = await fetch("/api/workspace");
    setLoading(false);
    if (!res.ok) {
      toast.error("Could not load workspace");
      return;
    }
    apply((await res.json()) as WorkspaceInfo);
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
          slug: slug.trim() || null,
          customDomain: customDomain.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      apply(data as WorkspaceInfo);
      toast.success("Workspace saved");
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

  const previewHost = slug.trim()
    ? `${slug.trim().toLowerCase()}${slugSuffix}.${tenantBase}`
    : null;
  const domainDraft = customDomain.trim().toLowerCase();
  const showDomainHelp = Boolean(domainDraft);

  return (
    <div>
      <h1 className="text-[27px] font-semibold tracking-[-0.02em]">Workspace</h1>
      <p className="mt-2 max-w-xl text-[15px] text-text-2">
        Name, brand, and how people reach this workspace.
      </p>

      <form
        onSubmit={save}
        className="mt-8 max-w-xl space-y-4 rounded-2xl border border-border bg-surface p-6"
      >
        <Input label="Workspace name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input
          label="Brand name"
          value={brandName}
          onChange={(e) => setBrandName(e.target.value)}
          placeholder="Acme Mail"
        />
        <div>
          <Input
            label="Slug"
            mono
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="gbese"
          />
          {previewHost ? (
            <p className="mt-1.5 text-[12px] text-text-3">
              <a className="mono text-accent" href={`https://${previewHost}/login`}>
                https://{previewHost}
              </a>
            </p>
          ) : null}
        </div>
        <div>
          <Input
            label="Custom domain"
            mono
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
            placeholder="mail.acme.com"
            disabled={!allowsByod && !customDomain}
          />
          {!allowsByod && !customDomain ? (
            <p className="mt-1.5 text-[12px] text-text-3">Custom domains require a paid plan.</p>
          ) : null}
        </div>

        {showDomainHelp ? (
          <div className="rounded-[11px] border border-border bg-surface-2 px-4 py-3 text-[13px] text-text-2">
            <p>
              In DNS, add a <span className="font-medium text-text">CNAME</span> for{" "}
              <span className="mono text-text">{domainDraft}</span> →{" "}
              <span className="mono text-text">{cname}</span> (proxied).
            </p>
            {previewHost || slugHost ? (
              <p className="mt-2">
                Slug URL:{" "}
                <a
                  className="mono text-accent"
                  href={`https://${slugHost || previewHost}/login`}
                >
                  https://{slugHost || previewHost}
                </a>
              </p>
            ) : null}
            {domainStatus ? (
              <p className="mt-2 text-[12px] text-text-3">
                Status: {domainStatus.hostnameStatus || "pending"}
                {" · "}
                Certificate: {domainStatus.certificateStatus || "pending"}
                {domainStatus.ready ? " · Ready" : ""}
              </p>
            ) : null}
          </div>
        ) : null}

        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Saving…" : "Save workspace"}
        </Button>
      </form>
    </div>
  );
}

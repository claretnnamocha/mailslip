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
  mode: string;
  plan: string;
  allowsCustomDomain: boolean;
  platformHosts: string[];
  tenantBaseDomain: string;
  tenantSlugSuffix: string;
  slugHost?: string | null;
  cnameTarget: string;
  cloudflareSaas: boolean;
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
  const [platformHosts, setPlatformHosts] = useState<string[]>([]);
  const [tenantBase, setTenantBase] = useState("uselinqr.io");
  const [slugSuffix, setSlugSuffix] = useState("-mail");
  const [slugHost, setSlugHost] = useState<string | null>(null);
  const [cname, setCname] = useState("cname.mailslip.uselinqr.io");
  const [saas, setSaas] = useState(false);
  const [plan, setPlan] = useState("free");
  const [allowsByod, setAllowsByod] = useState(false);
  const [domainStatus, setDomainStatus] = useState<DomainStatus | null>(null);

  function apply(data: WorkspaceInfo) {
    setName(data.name || "");
    setBrandName(data.brandName || "");
    setSlug(data.slug || "");
    setCustomDomain(data.customDomain || "");
    setPlatformHosts(data.platformHosts || []);
    setTenantBase(data.tenantBaseDomain || "uselinqr.io");
    setSlugSuffix(data.tenantSlugSuffix || "-mail");
    setSlugHost(data.slugHost || null);
    setCname(data.cnameTarget || "cname.mailslip.uselinqr.io");
    setSaas(Boolean(data.cloudflareSaas));
    setPlan(data.plan || "free");
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
      if (data.slugHost) {
        toast.success(`Saved — open https://${data.slugHost}/login`);
      } else if (data.customDomain) {
        toast.success(
          `Saved — CNAME your domain to ${data.cnameTarget || cname}, then open it to sign in`,
        );
      } else {
        toast.success("Workspace updated");
      }
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
  const byodLocked = !allowsByod;
  const previewHost = slug.trim()
    ? `${slug.trim().toLowerCase()}${slugSuffix}.${tenantBase}`
    : `your-slug${slugSuffix}.${tenantBase}`;

  return (
    <div>
      <h1 className="text-[27px] font-semibold tracking-[-0.02em]">Workspace</h1>
      <p className="mt-2 max-w-xl text-[15px] text-text-2">
        Slug and custom domain are separate. Slug gives you a Mailslip subdomain; custom domain is
        optional BYOD. Either (or both) serve this workspace — sign-in only, your brand.
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
            label="Slug"
            mono
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="gbese"
          />
          <p className="mt-1.5 text-[12px] text-text-3">
            Mailslip subdomain only (independent of custom domain):{" "}
            <span className="mono text-text">https://{previewHost}</span>
            {slugHost ? (
              <>
                {" "}
                ·{" "}
                <a className="text-accent" href={`https://${slugHost}/login`}>
                  Open login
                </a>
              </>
            ) : null}
          </p>
        </div>
        <div>
          <Input
            label="Custom domain"
            mono
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
            placeholder="mail.acme.com"
          />
          {byodLocked ? (
            <p className="mt-1.5 text-[12px] text-text-3">
              Custom domains are paid. Plan: <span className="mono">{plan}</span>. Upgrade to attach
              your own hostname (CNAME to <span className="mono">{cname}</span>).
            </p>
          ) : (
            <p className="mt-1.5 text-[12px] text-text-3">
              Optional. Your own hostname (does not have to match the slug). CNAME to{" "}
              <span className="mono">{cname}</span> (proxied).
            </p>
          )}
        </div>
        {domainStatus ? (
          <div className="rounded-[11px] border border-border bg-surface-2 px-4 py-3 text-[13px] text-text-2">
            <p className="font-medium text-text">Cloudflare status</p>
            <p className="mt-1 mono text-[12px]">{domainStatus.hostname}</p>
            <p className="mt-2">
              Hostname:{" "}
              <span className="font-medium text-text">
                {domainStatus.hostnameStatus || "not registered"}
              </span>
              {" · "}
              Certificate:{" "}
              <span className="font-medium text-text">
                {domainStatus.certificateStatus || "—"}
              </span>
              {domainStatus.ready ? " · Ready" : ""}
            </p>
          </div>
        ) : null}
        <div className="rounded-[11px] border border-border bg-surface-2 px-4 py-3 text-[13px] text-text-2">
          <p>
            <span className="font-medium text-text">Plan:</span>{" "}
            <span className="mono">{plan}</span>
            {allowsByod ? " (BYOD enabled)" : " (slug + platform)"}
          </p>
          <p className="mt-2">
            <span className="font-medium text-text">Platform entry:</span>{" "}
            <span className="mono">{entry}</span> — landing, signup, team login.
          </p>
          <p className="mt-2">
            <span className="font-medium text-text">Slug hosts:</span>{" "}
            <span className="mono">
              {`{slug}${slugSuffix}.${tenantBase}`}
            </span>{" "}
            — set slug only; operator DNS is zone <span className="mono">*</span> → platform (free
            Universal SSL; other hostnames keep their own records).
          </p>
          <p className="mt-2">
            <span className="font-medium text-text">Custom domain DNS:</span>{" "}
            <span className="mono">{cname}</span>
            {saas ? " — Cloudflare registers when you save." : null}
          </p>
        </div>
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Saving…" : "Save workspace"}
        </Button>
      </form>
    </div>
  );
}

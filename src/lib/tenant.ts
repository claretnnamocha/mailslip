import { headers } from "next/headers";
import type { Workspace } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { HostingMode } from "@/lib/hosting";

export type TenantWorkspace = Pick<
  Workspace,
  "id" | "name" | "slug" | "customDomain" | "brandName" | "mode"
>;

export type HostContext = {
  /** Platform entry (e.g. mailslip.uselinqr.io): signup + pick your workspace via account. */
  kind: "platform" | "tenant";
  host: string;
  tenant: TenantWorkspace | null;
};

const RESERVED_SLUGS = new Set([
  "www",
  "mail",
  "cname",
  "api",
  "app",
  "admin",
  "static",
  "assets",
  "cdn",
  "saas-origin",
  "fallback",
  "status",
  "docs",
  "help",
  "support",
  "auth",
  "login",
  "register",
]);

function normalizeHost(raw: string | null | undefined) {
  if (!raw) return "";
  return raw.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
}

function authHost() {
  const fromEnv = (process.env.MAILSLIP_PLATFORM_HOST || "")
    .split(",")
    .map((value) => normalizeHost(value))
    .find(Boolean);
  if (fromEnv) return fromEnv;
  try {
    return normalizeHost(new URL(process.env.NEXTAUTH_URL || "http://localhost:3000").host);
  } catch {
    return "localhost";
  }
}

/** General entry hosts: cloud landing + signup. Comma-separated env + NEXTAUTH_URL host. */
export function platformHosts(): string[] {
  const configured = (process.env.MAILSLIP_PLATFORM_HOST || "")
    .split(",")
    .map((value) => normalizeHost(value))
    .filter(Boolean);
  const hosts = new Set(configured);
  const primary = authHost();
  if (primary) hosts.add(primary);
  return [...hosts];
}

/**
 * Base for `{slug}.{base}` tenant hosts.
 * Default = parent of platform host → gbese.uselinqr.io (covered by free
 * Universal SSL *.uselinqr.io). Use MAILSLIP_TENANT_BASE_DOMAIN=mailslip.uselinqr.io
 * only if you have an Advanced Certificate for *.mailslip.uselinqr.io.
 */
export function tenantBaseDomain(): string {
  const configured = normalizeHost(process.env.MAILSLIP_TENANT_BASE_DOMAIN);
  if (configured) return configured;
  const platform = platformHosts()[0] || "mailslip.uselinqr.io";
  const parts = platform.split(".").filter(Boolean);
  if (parts.length >= 3) return parts.slice(1).join(".");
  return platform;
}

export function tenantHostFromSlug(slug: string): string {
  return `${slug}.${tenantBaseDomain()}`;
}

/** Extract slug from gbese.mailslip.uselinqr.io → "gbese". */
export function slugFromTenantHost(hostRaw: string | null | undefined): string | null {
  const host = normalizeHost(hostRaw);
  const base = tenantBaseDomain();
  if (!host || !base || host === base) return null;
  if (!host.endsWith(`.${base}`)) return null;
  const slug = host.slice(0, -(base.length + 1));
  if (!slug || slug.includes(".")) return null;
  return slug;
}

export function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\..*$/, "")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export function isValidSlug(slug: string): boolean {
  if (!slug || slug.length < 2 || slug.length > 63) return false;
  if (RESERVED_SLUGS.has(slug)) return false;
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug);
}

export function isPlatformHost(hostRaw: string | null | undefined) {
  const host = normalizeHost(hostRaw);
  if (!host) return false;
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  return platformHosts().includes(host);
}

const tenantSelect = {
  id: true,
  name: true,
  slug: true,
  customDomain: true,
  brandName: true,
  mode: true,
} as const;

export async function resolveHostContext(
  hostRaw: string | null | undefined,
): Promise<HostContext> {
  const host = normalizeHost(hostRaw);

  if (isPlatformHost(host)) {
    return { kind: "platform", host, tenant: null };
  }

  if (!host) {
    return { kind: "platform", host: "", tenant: null };
  }

  const slug = slugFromTenantHost(host);
  if (slug) {
    const tenant = await prisma.workspace.findFirst({
      where: { slug },
      select: tenantSelect,
    });
    return { kind: "tenant", host, tenant };
  }

  const tenant = await prisma.workspace.findFirst({
    where: { customDomain: host },
    select: tenantSelect,
  });

  return { kind: "tenant", host, tenant };
}

export async function getRequestHost() {
  const h = await headers();
  // SaaS Worker sets X-Mailslip-Host (Workers cannot rewrite Host on fetch).
  return normalizeHost(
    h.get("x-mailslip-host") || h.get("x-forwarded-host") || h.get("host"),
  );
}

export async function getRequestHostContext(): Promise<HostContext> {
  return resolveHostContext(await getRequestHost());
}

/** Workspace bound to this custom domain / slug host, if any. Null on the platform entry. */
export async function getRequestTenant(): Promise<TenantWorkspace | null> {
  const ctx = await getRequestHostContext();
  return ctx.kind === "tenant" ? ctx.tenant : null;
}

export function tenantHostingMode(ctx: HostContext | TenantWorkspace | null): HostingMode {
  // Legacy: TenantWorkspace alone
  if (ctx && "kind" in ctx) {
    return ctx.kind === "platform" ? "cloud" : "self-hosted";
  }
  if (ctx && "customDomain" in ctx && (ctx.customDomain || ctx.slug)) return "self-hosted";
  // Env fallback for scripts / no request
  const raw = (process.env.MAILSLIP_MODE || "cloud")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-");
  if (raw === "self-hosted" || raw === "selfhosted" || raw === "self-host") return "self-hosted";
  return "cloud";
}

export function tenantBrandName(ctx: HostContext | TenantWorkspace | null) {
  if (ctx && "kind" in ctx) {
    if (ctx.kind === "platform") return "Mailslip";
    const brand = ctx.tenant?.brandName?.trim();
    return brand || "Mailslip";
  }
  if (ctx && "brandName" in ctx) {
    return ctx.brandName?.trim() || "Mailslip";
  }
  const vendor = process.env.MAILSLIP_VENDOR_NAME?.trim();
  return vendor || "Mailslip";
}

export function tenantAllowsSignup(ctx: HostContext | TenantWorkspace | null) {
  return tenantHostingMode(ctx) === "cloud";
}

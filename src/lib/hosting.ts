import type { Metadata } from "next";
import {
  getRequestHostContext,
  tenantAllowsSignup,
  tenantBrandName,
  tenantHostingMode,
  type HostContext,
} from "@/lib/tenant";

export type HostingMode = "cloud" | "self-hosted";

/** Env-only fallback (CLIs / no request). Prefer resolveHosting() in the app. */
export function hostingMode(): HostingMode {
  return tenantHostingMode(null);
}

export function allowsPublicSignup() {
  return hostingMode() === "cloud";
}

export function brandName() {
  return tenantBrandName(null);
}

export async function resolveHosting(context?: HostContext) {
  const ctx = context ?? (await getRequestHostContext());
  return {
    context: ctx,
    tenant: ctx.kind === "tenant" ? ctx.tenant : null,
    mode: tenantHostingMode(ctx),
    brand: tenantBrandName(ctx),
    allowSignup: tenantAllowsSignup(ctx),
    isPlatform: ctx.kind === "platform",
  };
}

export async function allowsPublicSignupAsync() {
  return (await resolveHosting()).allowSignup;
}

export async function brandNameAsync() {
  return (await resolveHosting()).brand;
}

export function rootTitleMetadata(brand = brandName()): Metadata["title"] {
  return {
    default: brand,
    template: `${brand}: %s`,
  };
}

export function pageTitle(page: string): Metadata {
  return { title: page };
}

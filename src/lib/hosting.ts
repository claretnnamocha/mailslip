import type { Metadata } from "next";

export type HostingMode = "cloud" | "self-hosted";

/** Cloud shows the landing page and public signup. Self-hosted is sign-in only. */
export function hostingMode(): HostingMode {
  const raw = (process.env.MAILSLIP_MODE || "cloud").trim().toLowerCase().replace(/_/g, "-");
  if (raw === "self-hosted" || raw === "selfhosted") return "self-hosted";
  return "cloud";
}

export function allowsPublicSignup() {
  return hostingMode() === "cloud";
}

/**
 * Product name in browser titles.
 * Self-hosted can override with MAILSLIP_VENDOR_NAME → "{Vendor}: Inbox".
 * Cloud (and self-hosted without a vendor) stays "Mailslip: …".
 */
export function brandName() {
  if (hostingMode() === "self-hosted") {
    const vendor = process.env.MAILSLIP_VENDOR_NAME?.trim();
    if (vendor) return vendor;
  }
  return "Mailslip";
}

/** Child routes set `title: "Inbox"` and render as `{brand}: Inbox`. */
export function rootTitleMetadata(): Metadata["title"] {
  const brand = brandName();
  return {
    default: brand,
    template: `${brand}: %s`,
  };
}

export function pageTitle(page: string): Metadata {
  return { title: page };
}

import { platformHosts } from "@/lib/tenant";

/**
 * Hostname customers CNAME to (Cloudflare for SaaS target).
 * Never use the platform entry (mailslip…) — that breaks CF→CF.
 */
export function cnameTarget(): string {
  const configured = (process.env.MAILSLIP_CNAME_TARGET || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
  if (configured) return configured;
  const entry = platformHosts()[0];
  if (!entry || entry === "localhost" || entry.endsWith(".localhost")) {
    return "cname.localhost";
  }
  return `cname.${entry}`;
}

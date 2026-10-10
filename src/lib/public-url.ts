/**
 * Platform / Auth URL helpers for multi-tenant BYOD.
 *
 * Auth.js createActionURL prefers AUTH_URL/NEXTAUTH_URL over request headers.
 * That pins cookies/callbacks to the platform host when the SaaS Worker proxies
 * custom domains. Seed MAILSLIP_PLATFORM_HOST from NEXTAUTH_URL, then clear the
 * Auth URL envs so trustHost + X-Forwarded-Host (from X-Mailslip-Host) win.
 */

let prepared = false;

export function prepareAuthHostEnv() {
  if (prepared || typeof process === "undefined") return;
  prepared = true;

  if (!process.env.MAILSLIP_PLATFORM_HOST?.trim()) {
    const raw = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
    if (raw) {
      try {
        process.env.MAILSLIP_PLATFORM_HOST = new URL(raw).host;
      } catch {
        /* ignore */
      }
    }
  }

  // Required for custom-domain sign-in (gbese.fun, etc.).
  delete process.env.AUTH_URL;
  delete process.env.NEXTAUTH_URL;
}

export function platformOrigin(): string {
  const host = (process.env.MAILSLIP_PLATFORM_HOST || "").split(",")[0]?.trim();
  if (host) return `https://${host.replace(/^https?:\/\//, "")}`;
  return "http://localhost:3000";
}

export function requestPublicOrigin(headers: Headers, fallbackUrl?: URL | string): string {
  const mailslip = headers.get("x-mailslip-host")?.split(",")[0]?.trim();
  const forwarded = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = mailslip || forwarded || headers.get("host")?.split(",")[0]?.trim();
  const proto = (
    headers.get("x-forwarded-proto") ||
    (typeof fallbackUrl === "string"
      ? new URL(fallbackUrl).protocol.replace(":", "")
      : fallbackUrl?.protocol.replace(":", "")) ||
    "https"
  ).replace(/:$/, "");
  if (host) return `${proto}://${host}`;
  if (fallbackUrl) return new URL(fallbackUrl).origin;
  return platformOrigin();
}

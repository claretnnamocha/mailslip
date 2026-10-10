/**
 * Platform / Auth URL helpers for multi-tenant BYOD.
 *
 * Auth.js createActionURL prefers AUTH_URL/NEXTAUTH_URL over request headers.
 * That pins cookies/callbacks to the platform host when the SaaS Worker proxies
 * custom domains. Seed MAILSLIP_PLATFORM_HOST from NEXTAUTH_URL, then clear the
 * Auth URL envs so trustHost + X-Forwarded-Host win.
 *
 * Railway often presents Host 0.0.0.0:8080 — never treat that as public.
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

export function isInternalHost(hostRaw: string | null | undefined): boolean {
  if (!hostRaw) return true;
  const host = hostRaw.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
  if (!host) return true;
  if (host === "0.0.0.0" || host === "127.0.0.1" || host === "::" || host === "[::]") {
    return true;
  }
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".railway.internal")) return true;
  return false;
}

export function platformHost(): string {
  return (
    (process.env.MAILSLIP_PLATFORM_HOST || "")
      .split(",")
      .map((value) => value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/:\d+$/, ""))
      .find(Boolean) || "localhost:3000"
  );
}

export function platformOrigin(): string {
  const host = platformHost();
  if (host.startsWith("localhost") || host.startsWith("127.")) {
    return `http://${host}`;
  }
  return `https://${host}`;
}

/** Public hostname for this request (customer domain or platform — never Railway bind addr). */
export function resolvePublicHost(headers: Headers): string {
  const candidates = [
    headers.get("x-mailslip-host"),
    headers.get("x-forwarded-host"),
    headers.get("host"),
  ];
  for (const raw of candidates) {
    const host = raw?.split(",")[0]?.trim().toLowerCase();
    if (host && !isInternalHost(host)) return host;
  }
  return platformHost();
}

export function requestPublicOrigin(headers: Headers, fallbackUrl?: URL | string): string {
  const host = resolvePublicHost(headers);
  const proto = (
    headers.get("x-forwarded-proto") ||
    (isInternalHost(host) ? "http" : "https") ||
    "https"
  ).replace(/:$/, "");
  const safeProto =
    host.startsWith("localhost") || host.startsWith("127.") ? "http" : proto === "http" ? "https" : proto;
  if (host) return `${safeProto}://${host}`;
  if (fallbackUrl) {
    const origin = new URL(fallbackUrl).origin;
    if (!origin.includes("0.0.0.0")) return origin;
  }
  return platformOrigin();
}

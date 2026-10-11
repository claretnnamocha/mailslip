/**
 * Cloudflare Worker — SaaS fallback origin for Mailslip (Free plan).
 *
 * Workers cannot override Host on fetch() (URL hostname wins). Railway only
 * serves Host: mailslip.uselinqr.io, so we fetch that URL and pass the customer
 * domain as X-Mailslip-Host (Mailslip tenancy reads it).
 *
 * Setup (once) — see docs/multi-tenant.md:
 * 1. Paste → Deploy; optional var ORIGIN_HOST=mailslip.uselinqr.io
 * 2. DNS: saas-origin AAAA 100:: (proxied, originless)
 * 3. Fallback Origin = saas-origin.uselinqr.io
 * 4. Worker routes (order matters; more specific wins):
 *      mailslip.uselinqr.io/*     → None
 *      folio.uselinqr.io/*        → None   (and any other sibling apps)
 *      saas-origin.uselinqr.io/*  → this Worker
 *      * / *                      → this Worker  (BYOD custom hostnames)
 *
 * Do NOT rely on */* alone without excluding other products on uselinqr.io —
 * that is what made folio.uselinqr.io serve Mailslip.
 */

const PLATFORM_ORIGIN = "https://mailslip.uselinqr.io";
const ZONE = "uselinqr.io";

/** Hosts on the shared zone that must NOT be rewritten to Mailslip. */
const ZONE_PASSTHROUGH = new Set([
  "folio.uselinqr.io",
  // add other sibling apps here
]);

function normalizeHost(raw) {
  return String(raw || "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
}

function isMailslipOwned(host) {
  if (!host) return false;
  if (host === `mailslip.${ZONE}`) return true;
  if (host === `cname.mailslip.${ZONE}`) return true;
  if (host === `saas-origin.${ZONE}`) return true;
  // {slug}-mail.uselinqr.io
  if (new RegExp(`^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?-mail\\.${ZONE.replace(/\./g, "\\.")}$`).test(host)) {
    return true;
  }
  return false;
}

export default {
  async fetch(request, env) {
    const platform = (env.ORIGIN_HOST
      ? `https://${String(env.ORIGIN_HOST).replace(/^https?:\/\//, "")}`
      : PLATFORM_ORIGIN
    ).replace(/\/$/, "");

    const url = new URL(request.url);
    const customerHost = normalizeHost(request.headers.get("Host") || url.hostname);

    // Sibling apps on the same zone (folio, …): never rewrite to Mailslip.
    // Requires their own DNS record (beats zone *) and ideally route → None.
    const onZone = customerHost === ZONE || customerHost.endsWith(`.${ZONE}`);
    if (onZone && (ZONE_PASSTHROUGH.has(customerHost) || !isMailslipOwned(customerHost))) {
      return fetch(request);
    }

    const target = new URL(url.pathname + url.search, platform);

    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.set("X-Mailslip-Host", customerHost);
    headers.set("X-Forwarded-Host", customerHost);
    headers.set("X-Forwarded-Proto", "https");

    const init = {
      method: request.method,
      headers,
      redirect: "manual",
    };
    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = request.body;
      init.duplex = "half";
    }

    return fetch(target, init);
  },
};

/**
 * Cloudflare Worker — SaaS fallback origin for Mailslip (Free plan).
 *
 * Workers cannot override the Host header on fetch() (it always matches the URL).
 * Railway only serves Host: mailslip.uselinqr.io, so we fetch that hostname and
 * pass the customer domain as X-Mailslip-Host (Mailslip reads it for tenancy).
 *
 * Setup (once):
 * 1. Paste this script → Deploy
 * 2. Domains → Add Domain → saas-origin.uselinqr.io
 * 3. Custom Hostnames → Fallback Origin → saas-origin.uselinqr.io
 */

const PLATFORM_ORIGIN = "https://mailslip.uselinqr.io";

export default {
  async fetch(request, env) {
    const platform = (env.ORIGIN_HOST
      ? `https://${String(env.ORIGIN_HOST).replace(/^https?:\/\//, "")}`
      : PLATFORM_ORIGIN
    ).replace(/\/$/, "");

    const url = new URL(request.url);
    const customerHost = request.headers.get("Host") || url.hostname;
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

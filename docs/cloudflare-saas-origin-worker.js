/**
 * Cloudflare Worker — SaaS fallback origin for Mailslip (Free plan).
 *
 * Workers cannot override Host on fetch() (URL hostname wins). Railway only
 * serves Host: mailslip.uselinqr.io, so we fetch that URL and pass the customer
 * domain as X-Mailslip-Host (Mailslip tenancy reads it).
 *
 * Setup (once):
 * 1. Paste → Deploy; optional var ORIGIN_HOST=mailslip.uselinqr.io
 * 2. Domains → Add Domain → saas-origin.uselinqr.io
 * 3. Custom Hostnames → Fallback Origin → saas-origin.uselinqr.io (Active)
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

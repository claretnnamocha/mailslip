/**
 * Cloudflare for SaaS — Custom Hostnames.
 * Registers customer domains on the platform zone so TLS works when they
 * CNAME to MAILSLIP_CNAME_TARGET (not the platform entry host).
 *
 * Operator setup (once): enable Cloudflare for SaaS on the platform zone,
 * set a fallback origin, create proxied CNAME MAILSLIP_CNAME_TARGET → fallback.
 */

type CfResult<T> = { success: boolean; result?: T; errors?: { message: string }[] };

type CustomHostname = {
  id: string;
  hostname: string;
  status: string;
  ssl?: { status?: string };
};

function configured() {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID?.trim();
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!zoneId || !token) return null;
  return { zoneId, token };
}

export function cloudflareSaasConfigured() {
  return Boolean(configured());
}

async function cfFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const cfg = configured();
  if (!cfg) return { ok: false, error: "Cloudflare for SaaS is not configured" };

  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const body = (await res.json()) as CfResult<T>;
  if (!body.success || !res.ok) {
    const message =
      body.errors?.map((e) => e.message).filter(Boolean).join("; ") ||
      `Cloudflare API error (${res.status})`;
    return { ok: false, error: message };
  }
  return { ok: true, data: body.result as T };
}

async function findByHostname(hostname: string) {
  const cfg = configured();
  if (!cfg) return { ok: false as const, error: "Cloudflare for SaaS is not configured" };
  const q = new URLSearchParams({ hostname });
  return cfFetch<CustomHostname[]>(
    `/zones/${cfg.zoneId}/custom_hostnames?${q.toString()}`,
  );
}

/** Ensure a custom hostname exists (idempotent). */
export async function ensureCustomHostname(hostname: string) {
  const cfg = configured();
  if (!cfg) return { skipped: true as const };

  const existing = await findByHostname(hostname);
  if (!existing.ok) return { ok: false as const, error: existing.error };
  if (existing.data?.[0]) {
    return { ok: true as const, id: existing.data[0].id, created: false };
  }

  const created = await cfFetch<CustomHostname>(
    `/zones/${cfg.zoneId}/custom_hostnames`,
    {
      method: "POST",
      body: JSON.stringify({
        hostname,
        ssl: { method: "http", type: "dv" },
      }),
    },
  );
  if (!created.ok) {
    // Already exists (race) — treat as success
    if (/already exists|duplicate/i.test(created.error)) {
      const again = await findByHostname(hostname);
      if (again.ok && again.data?.[0]) {
        return { ok: true as const, id: again.data[0].id, created: false };
      }
    }
    return { ok: false as const, error: created.error };
  }
  return { ok: true as const, id: created.data.id, created: true };
}

/** Remove custom hostname when workspace clears the domain. */
export async function deleteCustomHostname(hostname: string) {
  const cfg = configured();
  if (!cfg) return { skipped: true as const };

  const existing = await findByHostname(hostname);
  if (!existing.ok) return { ok: false as const, error: existing.error };
  const id = existing.data?.[0]?.id;
  if (!id) return { ok: true as const, deleted: false };

  const deleted = await cfFetch<null>(`/zones/${cfg.zoneId}/custom_hostnames/${id}`, {
    method: "DELETE",
  });
  if (!deleted.ok) return { ok: false as const, error: deleted.error };
  return { ok: true as const, deleted: true };
}

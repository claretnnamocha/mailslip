/**
 * Free vs paid hosting entitlement.
 * Free → static platform host only (no BYOD).
 * Paid → custom domain via Cloudflare for SaaS.
 *
 * Until Stripe lands: set Workspace.plan = "paid", or
 * MAILSLIP_PAID_WORKSPACE_IDS=id1,id2, or MAILSLIP_BYOD_ALLOW_ALL=1 (dev).
 */

export type WorkspacePlan = "free" | "paid";

export function normalizePlan(raw: string | null | undefined): WorkspacePlan {
  const value = (raw || "free").trim().toLowerCase();
  if (value === "paid" || value === "pro" || value === "business" || value === "byod") {
    return "paid";
  }
  return "free";
}

export function workspaceAllowsCustomDomain(workspace: {
  id: string;
  plan?: string | null;
}): boolean {
  if ((process.env.MAILSLIP_BYOD_ALLOW_ALL || "").trim() === "1") return true;

  if (normalizePlan(workspace.plan) === "paid") return true;

  const allowIds = (process.env.MAILSLIP_PAID_WORKSPACE_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return allowIds.includes(workspace.id);
}

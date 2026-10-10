/**
 * Free vs paid hosting entitlement.
 * Free → platform host for tenancy via session; Paid → Host → workspace BYOD.
 *
 * Billing is relaxed by default so BYOD can be verified end-to-end.
 * Set MAILSLIP_BYOD_REQUIRE_PAID=1 to enforce Workspace.plan / allow-list.
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
  // Default: allow BYOD for everyone until billing ships.
  if ((process.env.MAILSLIP_BYOD_REQUIRE_PAID || "").trim() !== "1") return true;

  if ((process.env.MAILSLIP_BYOD_ALLOW_ALL || "").trim() === "1") return true;

  if (normalizePlan(workspace.plan) === "paid") return true;

  const allowIds = (process.env.MAILSLIP_PAID_WORKSPACE_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return allowIds.includes(workspace.id);
}

import { promises as dns } from "dns";
import { NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getPrimaryWorkspace, isAdminRole } from "@/lib/identities";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const membership = await getPrimaryWorkspace(authResult.userId);
  if (!membership || !isAdminRole(membership.role)) {
    return jsonError("Forbidden", 403);
  }

  const { id } = await context.params;
  const domain = await prisma.domain.findFirst({
    where: { id, workspaceId: membership.workspaceId },
  });
  if (!domain) return jsonError("Not found", 404);

  let verified = false;
  try {
    const records = await dns.resolveTxt(`_mailslip-verify.${domain.domain}`);
    const flat = records.map((parts) => parts.join(""));
    verified = flat.some((r) => r.includes(domain.verificationToken));
  } catch {
    // Also accept root TXT for local/dev convenience
    try {
      const records = await dns.resolveTxt(domain.domain);
      const flat = records.map((parts) => parts.join(""));
      verified = flat.some((r) => r.includes(domain.verificationToken));
    } catch {
      verified = false;
    }
  }

  // Dev convenience: allow verify when DEMO_MAIL is on
  if (!verified && process.env.DEMO_MAIL === "true") {
    verified = true;
  }

  const updated = await prisma.domain.update({
    where: { id: domain.id },
    data: { verified },
  });

  return NextResponse.json(updated);
}

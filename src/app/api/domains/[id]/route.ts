import { NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getPrimaryWorkspace, isAdminRole } from "@/lib/identities";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const membership = await getPrimaryWorkspace(authResult.userId);
  if (!membership || !isAdminRole(membership.role)) {
    return jsonError("Only owners and admins can remove domains", 403);
  }

  const { id } = await context.params;
  const domain = await prisma.domain.findFirst({
    where: { id, workspaceId: membership.workspaceId },
  });
  if (!domain) return jsonError("Not found", 404);

  await prisma.domain.delete({ where: { id: domain.id } });
  return NextResponse.json({
    ok: true,
    message: "Domain removed from this workspace. Connected mailboxes were not deleted.",
  });
}

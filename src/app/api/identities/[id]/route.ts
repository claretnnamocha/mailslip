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
    return jsonError("Only owners and admins can disconnect mailboxes", 403);
  }

  const { id } = await context.params;
  const identity = await prisma.mailIdentity.findFirst({
    where: { id, workspaceId: membership.workspaceId },
  });
  if (!identity) return jsonError("Not found", 404);

  await prisma.mailIdentity.delete({ where: { id: identity.id } });
  return NextResponse.json({
    ok: true,
    message: "Identity disconnected. Mail on your server was not touched.",
  });
}

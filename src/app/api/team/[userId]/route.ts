import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getPrimaryWorkspace, isAdminRole, syncMemberIdentities } from "@/lib/identities";

async function loadTarget(workspaceId: string, userId: string) {
  return prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}

const assignSchema = z.object({
  identityIds: z.array(z.string()),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const membership = await getPrimaryWorkspace(authResult.userId);
  if (!membership || !isAdminRole(membership.role)) {
    return jsonError("Only owners and admins can assign mailboxes", 403);
  }

  const { userId } = await context.params;
  const target = await loadTarget(membership.workspaceId, userId);
  if (!target) return jsonError("Not found", 404);
  if (target.role !== "MEMBER") {
    return jsonError("Admins already have every mailbox in the workspace", 400);
  }

  const body = assignSchema.parse(await request.json());
  await syncMemberIdentities(target.userId, membership.workspaceId, body.identityIds);
  return NextResponse.json({ ok: true, identityIds: body.identityIds });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const membership = await getPrimaryWorkspace(authResult.userId);
  if (!membership || !isAdminRole(membership.role)) {
    return jsonError("Only owners and admins can remove people", 403);
  }

  const { userId } = await context.params;
  if (userId === authResult.userId) {
    return jsonError("You cannot remove yourself", 400);
  }

  const target = await loadTarget(membership.workspaceId, userId);
  if (!target) return jsonError("Not found", 404);
  if (target.role === "OWNER") {
    return jsonError("The workspace owner cannot be removed", 400);
  }
  if (target.role === "ADMIN" && membership.role !== "OWNER") {
    return jsonError("Only the owner can remove an admin", 403);
  }

  await prisma.user.delete({ where: { id: target.userId } });
  return NextResponse.json({
    ok: true,
    message: "Person removed. Connected mailboxes were left in the workspace.",
  });
}

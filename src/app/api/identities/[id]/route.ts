import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canAccessIdentity, canManageIdentity, getPrimaryWorkspace } from "@/lib/identities";

const patchSchema = z.object({
  access: z.enum(["SHARED", "PERSONAL"]).optional(),
  displayName: z.string().optional(),
  color: z.string().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const membership = await getPrimaryWorkspace(authResult.userId);
  if (!membership) return jsonError("No workspace", 400);

  const { id } = await context.params;
  const accessCheck = await canAccessIdentity(authResult.userId, id);
  if (!accessCheck) return jsonError("Not found", 404);

  const identity = accessCheck.identity;
  if (!canManageIdentity(authResult.userId, membership.role, identity)) {
    return jsonError("You cannot change this mailbox", 403);
  }

  const body = patchSchema.parse(await request.json());

  let ownerUserId = identity.ownerUserId;
  let boundUserId = identity.boundUserId;
  if (body.access === "PERSONAL") {
    ownerUserId = identity.ownerUserId || authResult.userId;
    boundUserId = identity.boundUserId || ownerUserId;
    await prisma.identityGrant.deleteMany({ where: { identityId: identity.id } });
  }

  const updated = await prisma.mailIdentity.update({
    where: { id: identity.id },
    data: {
      access: body.access,
      displayName: body.displayName,
      color: body.color,
      ...(body.access === "PERSONAL" ? { ownerUserId, boundUserId } : {}),
    },
  });

  return NextResponse.json({
    id: updated.id,
    email: updated.email,
    displayName: updated.displayName,
    color: updated.color,
    type: updated.type,
    access: updated.access,
    ownerUserId: updated.ownerUserId,
    connected: updated.connected,
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const membership = await getPrimaryWorkspace(authResult.userId);
  if (!membership) return jsonError("No workspace", 400);

  const { id } = await context.params;
  const identity = await prisma.mailIdentity.findFirst({
    where: { id, workspaceId: membership.workspaceId },
  });
  if (!identity) return jsonError("Not found", 404);

  if (!canManageIdentity(authResult.userId, membership.role, identity)) {
    return jsonError(
      identity.access === "PERSONAL"
        ? "Only the owner can disconnect a personal mailbox"
        : "Only owners and admins can disconnect mailboxes",
      403,
    );
  }

  await prisma.mailIdentity.delete({ where: { id: identity.id } });
  return NextResponse.json({
    ok: true,
    message: "Identity disconnected. Mail on your server was not touched.",
  });
}

import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { assignedIdentityIds, getPrimaryWorkspace, isAdminRole, syncMemberIdentities } from "@/lib/identities";
import { hashPassword } from "@/lib/password";

export async function GET() {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const membership = await getPrimaryWorkspace(authResult.userId);
  if (!membership) return jsonError("No workspace");

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: membership.workspaceId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  const withIdentities = await Promise.all(
    members.map(async (member) => ({
      ...member,
      identityIds:
        member.role === "MEMBER"
          ? await assignedIdentityIds(member.userId, membership.workspaceId)
          : [],
    })),
  );

  return NextResponse.json({ members: withIdentities, role: membership.role });
}

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
  requirePasswordChange: z.boolean().default(true),
  identityIds: z.array(z.string()).default([]),
});

export async function POST(request: Request) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const membership = await getPrimaryWorkspace(authResult.userId);
  if (!membership || !isAdminRole(membership.role)) {
    return jsonError("Only owners and admins can provision users", 403);
  }

  const body = schema.parse(await request.json());
  const temporaryPassword = randomBytes(9).toString("base64url");

  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) return jsonError("User already exists");

  const user = await prisma.user.create({
    data: {
      zitadelId: `provisioned:${body.email.toLowerCase()}`,
      email: body.email.toLowerCase(),
      name: body.name,
      loginName: body.email.toLowerCase(),
      passwordHash: await hashPassword(temporaryPassword),
      mustChangePassword: body.requirePasswordChange,
      memberships: {
        create: {
          workspaceId: membership.workspaceId,
          role: body.role,
        },
      },
    },
  });

  if (body.role === "MEMBER" && body.identityIds.length > 0) {
    await syncMemberIdentities(user.id, membership.workspaceId, body.identityIds);
  }

  // Temporary password is returned once for out-of-band handover.
  // In production this would also be created in Zitadel via Management API.
  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name },
    temporaryPassword,
    note: "Hand credentials out-of-band. Password is shown once.",
  });
}

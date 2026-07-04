import type { MailIdentity, WorkspaceMember, WorkspaceRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import type { ConnectionConfig } from "@/lib/mail/types";

export async function getSessionUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: { include: { workspace: true } },
    },
  });
}

export async function getPrimaryWorkspace(userId: string) {
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
  return membership;
}

export function isAdminRole(role: WorkspaceRole) {
  return role === "OWNER" || role === "ADMIN";
}

export async function listAccessibleIdentities(userId: string) {
  const membership = await getPrimaryWorkspace(userId);
  if (!membership) return [];

  if (isAdminRole(membership.role)) {
    return prisma.mailIdentity.findMany({
      where: { workspaceId: membership.workspaceId },
      orderBy: { createdAt: "asc" },
    });
  }

  const grants = await prisma.identityGrant.findMany({
    where: { userId },
    include: { identity: true },
  });

  const owned = await prisma.mailIdentity.findMany({
    where: { ownerUserId: userId, workspaceId: membership.workspaceId },
  });

  const map = new Map<string, MailIdentity>();
  for (const id of owned) map.set(id.id, id);
  for (const g of grants) map.set(g.identity.id, g.identity);
  return [...map.values()];
}

export async function canAccessIdentity(
  userId: string,
  identityId: string,
): Promise<{ identity: MailIdentity; membership: WorkspaceMember; permission: "SEND_AND_READ" | "READ_ONLY" } | null> {
  const membership = await getPrimaryWorkspace(userId);
  if (!membership) return null;

  const identity = await prisma.mailIdentity.findFirst({
    where: { id: identityId, workspaceId: membership.workspaceId },
  });
  if (!identity) return null;

  if (isAdminRole(membership.role) || identity.ownerUserId === userId) {
    return { identity, membership, permission: "SEND_AND_READ" };
  }

  const grant = await prisma.identityGrant.findUnique({
    where: { identityId_userId: { identityId, userId } },
  });
  if (!grant) return null;
  return { identity, membership, permission: grant.permission };
}

export function identityToConfig(identity: MailIdentity): ConnectionConfig | null {
  if (!identity.credentialsEnc || !identity.username) return null;
  return {
    email: identity.email,
    username: identity.username,
    password: decryptSecret(identity.credentialsEnc),
    incomingProtocol: identity.incomingProtocol,
    imapHost: identity.imapHost,
    imapPort: identity.imapPort,
    imapTls: identity.imapTls,
    pop3Host: identity.pop3Host,
    pop3Port: identity.pop3Port,
    pop3Tls: identity.pop3Tls,
    jmapUrl: identity.jmapUrl,
    smtpHost: identity.smtpHost,
    smtpPort: identity.smtpPort,
    smtpTls: identity.smtpTls,
  };
}

export async function resolveBackingIdentity(identity: MailIdentity): Promise<MailIdentity> {
  if (identity.type !== "SCOPED_ALIAS" || !identity.backingIdentityId) return identity;
  const backing = await prisma.mailIdentity.findUnique({
    where: { id: identity.backingIdentityId },
  });
  return backing || identity;
}

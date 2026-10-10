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
  try {
    const { getRequestHostContext } = await import("@/lib/tenant");
    const ctx = await getRequestHostContext();

    // Custom domain → that workspace only (self-hosted style).
    if (ctx.kind === "tenant") {
      if (!ctx.tenant) return null;
      return prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId: ctx.tenant.id, userId },
        },
        include: { workspace: true },
      });
    }
    // Platform entry → user's own workspace (first membership).
  } catch {
    /* headers() unavailable outside a request — fall through */
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
  if (membership) return membership;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const workspace = await prisma.workspace.create({
    data: {
      name: `${user.name || user.email.split("@")[0]}'s workspace`,
      mode: "cloud",
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });

  return prisma.workspaceMember.findFirst({
    where: { userId, workspaceId: workspace.id },
    include: { workspace: true },
  });
}

export function isAdminRole(role: WorkspaceRole) {
  return role === "OWNER" || role === "ADMIN";
}

export async function assignedIdentityIds(userId: string, workspaceId: string) {
  const [grants, owned] = await Promise.all([
    prisma.identityGrant.findMany({
      where: { userId, identity: { workspaceId } },
      select: { identityId: true },
    }),
    prisma.mailIdentity.findMany({
      where: { ownerUserId: userId, workspaceId },
      select: { id: true },
    }),
  ]);
  return [...new Set([...grants.map((grant) => grant.identityId), ...owned.map((identity) => identity.id)])];
}

export async function syncMemberIdentities(
  userId: string,
  workspaceId: string,
  identityIds: string[],
) {
  const identities = await prisma.mailIdentity.findMany({ where: { workspaceId } });
  // Personal mailboxes cannot be assigned to or controlled by other profiles.
  const assignable = identities.filter((identity) => identity.access !== "PERSONAL");
  const valid = new Set(assignable.map((identity) => identity.id));
  const wanted = new Set(identityIds.filter((id) => valid.has(id)));

  for (const identity of assignable) {
    const assigned = wanted.has(identity.id);
    if (assigned) {
      await prisma.identityGrant.upsert({
        where: { identityId_userId: { identityId: identity.id, userId } },
        create: { identityId: identity.id, userId, permission: "SEND_AND_READ" },
        update: {},
      });
      continue;
    }

    await prisma.identityGrant.deleteMany({
      where: { identityId: identity.id, userId },
    });
    if (identity.ownerUserId === userId) {
      await prisma.mailIdentity.update({
        where: { id: identity.id },
        data: { ownerUserId: null },
      });
    }
  }
}

export async function listAccessibleIdentities(userId: string) {
  const membership = await getPrimaryWorkspace(userId);
  if (!membership) return [];

  if (isAdminRole(membership.role)) {
    // Admins see shared workspace mailboxes, plus their own personal ones only.
    return prisma.mailIdentity.findMany({
      where: {
        workspaceId: membership.workspaceId,
        OR: [{ access: "SHARED" }, { ownerUserId: userId }],
      },
      orderBy: { createdAt: "asc" },
    });
  }

  const grants = await prisma.identityGrant.findMany({
    where: {
      userId,
      identity: { workspaceId: membership.workspaceId, access: "SHARED" },
    },
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

  if (identity.access === "PERSONAL") {
    if (identity.ownerUserId !== userId) return null;
    return { identity, membership, permission: "SEND_AND_READ" };
  }

  if (isAdminRole(membership.role) || identity.ownerUserId === userId) {
    return { identity, membership, permission: "SEND_AND_READ" };
  }

  const grant = await prisma.identityGrant.findUnique({
    where: { identityId_userId: { identityId, userId } },
  });
  if (!grant) return null;
  return { identity, membership, permission: grant.permission };
}

/** Who may disconnect or change access on this identity. */
export function canManageIdentity(
  userId: string,
  role: WorkspaceRole,
  identity: Pick<MailIdentity, "access" | "ownerUserId">,
) {
  if (identity.access === "PERSONAL") {
    return identity.ownerUserId === userId;
  }
  return isAdminRole(role) || identity.ownerUserId === userId;
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

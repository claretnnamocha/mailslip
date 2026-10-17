import type { MailIdentity, WorkspaceMember, WorkspaceRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { ensureGmailAccessToken } from "@/lib/mail/gmail";
import { folderNamespace } from "@/lib/mail/folder-scope";
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

function personalBoundTo(identity: Pick<MailIdentity, "access" | "boundUserId" | "ownerUserId">) {
  if (identity.access !== "PERSONAL") return null;
  return identity.boundUserId || identity.ownerUserId;
}

export async function syncMemberIdentities(
  userId: string,
  workspaceId: string,
  identityIds: string[],
) {
  const identities = await prisma.mailIdentity.findMany({ where: { workspaceId } });
  // Shared mailboxes can move between members. A personal mailbox can only
  // come back to the person it was created for.
  const shared = identities.filter((identity) => identity.access !== "PERSONAL");
  const validShared = new Set(shared.map((identity) => identity.id));
  const wantedShared = new Set(identityIds.filter((id) => validShared.has(id)));

  for (const identity of shared) {
    const assigned = wantedShared.has(identity.id);
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

  const wantedPersonal = new Set(identityIds);
  for (const identity of identities) {
    if (personalBoundTo(identity) !== userId) continue;
    const assigned = wantedPersonal.has(identity.id);
    if (assigned) {
      if (identity.ownerUserId !== userId || identity.boundUserId !== userId) {
        await prisma.mailIdentity.update({
          where: { id: identity.id },
          data: { ownerUserId: userId, boundUserId: userId },
        });
      }
      continue;
    }
    if (identity.ownerUserId === userId || !identity.boundUserId) {
      await prisma.identityGrant.deleteMany({ where: { identityId: identity.id } });
      await prisma.mailIdentity.update({
        where: { id: identity.id },
        data: { ownerUserId: null, boundUserId: userId },
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
    if (identity.ownerUserId === userId) return true;
    // Detached personal mailbox: an admin can disconnect it, not read it.
    return !identity.ownerUserId && isAdminRole(role);
  }
  return isAdminRole(role) || identity.ownerUserId === userId;
}

/** Which folder prefix this address owns, and which sibling prefixes to hide. */
export async function folderIsolationContext(identity: MailIdentity, backing: MailIdentity) {
  const loginUser = (backing.username || identity.username || "").trim().toLowerCase();
  const host = (backing.imapHost || identity.imapHost || "").trim().toLowerCase();
  const namespace = folderNamespace(identity.email, identity.username || backing.username);
  if (!loginUser) return { namespace, foreignNamespaces: [] as string[] };

  const rows = await prisma.mailIdentity.findMany({
    where: { workspaceId: identity.workspaceId },
    select: {
      id: true,
      email: true,
      username: true,
      imapHost: true,
      backingIdentityId: true,
    },
  });

  const foreign = new Set<string>();
  for (const row of rows) {
    if (row.id === identity.id) continue;
    const rowUser = (row.username || "").trim().toLowerCase();
    const rowHost = (row.imapHost || "").trim().toLowerCase();
    const sameLogin =
      (rowUser === loginUser && (!rowHost || !host || rowHost === host)) ||
      row.backingIdentityId === backing.id ||
      row.backingIdentityId === identity.id;
    if (!sameLogin) continue;
    const ns = folderNamespace(row.email, row.username || backing.username);
    if (ns && ns !== namespace) foreign.add(ns);
  }

  return { namespace, foreignNamespaces: [...foreign] };
}

function connectionConfig(
  identity: MailIdentity,
  password: string,
  accessToken?: string,
): ConnectionConfig {
  return {
    email: identity.email,
    username: identity.username || identity.email,
    password,
    accessToken,
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

export function identityToConfig(identity: MailIdentity): ConnectionConfig | null {
  if (!identity.credentialsEnc || !identity.username) return null;
  if (identity.authMode === "OAUTH") return null;
  return connectionConfig(identity, decryptSecret(identity.credentialsEnc));
}

/** Password identities resolve immediately. Gmail OAuth refreshes the access token first. */
export async function resolveIdentityConfig(
  identity: MailIdentity,
): Promise<ConnectionConfig | null> {
  if (!identity.credentialsEnc || !identity.username) return null;
  if (identity.authMode === "OAUTH") {
    const accessToken = await ensureGmailAccessToken(identity.id, identity.credentialsEnc);
    return connectionConfig(identity, "", accessToken);
  }
  return identityToConfig(identity);
}

export async function resolveBackingIdentity(identity: MailIdentity): Promise<MailIdentity> {
  if (identity.type !== "SCOPED_ALIAS" || !identity.backingIdentityId) return identity;
  const backing = await prisma.mailIdentity.findUnique({
    where: { id: identity.backingIdentityId },
  });
  return backing || identity;
}

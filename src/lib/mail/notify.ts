import type { MailIdentity, NotificationPref, WorkspaceRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sendPushToUser } from "@/lib/push";
import { fetchMessages } from "@/lib/mail/service";
import type { MailMessageSummary } from "@/lib/mail/types";

const POLL_MS = 30_000;
const LOCK_KEY = "mail-notify-lock";
const LOCK_STALE_MS = 90_000;

const notifyRuntime = globalThis as typeof globalThis & { __mailslipNotifyStarted?: boolean };

function isAdminRole(role: WorkspaceRole) {
  return role === "OWNER" || role === "ADMIN";
}

function canReceiveForIdentity(
  identity: MailIdentity,
  member: { userId: string; role: WorkspaceRole },
  grantUserIds: Set<string>,
) {
  if (identity.access === "PERSONAL") return identity.ownerUserId === member.userId;
  if (isAdminRole(member.role) || identity.ownerUserId === member.userId) return true;
  return grantUserIds.has(member.userId);
}

function wantsDesktop(pref: NotificationPref | undefined) {
  return pref?.desktop !== false;
}

function senderLabel(message: MailMessageSummary) {
  return message.from.name || message.from.address;
}

function payloadFor(identity: MailIdentity, fresh: MailMessageSummary[]) {
  const url = `/mail?identityId=${encodeURIComponent(identity.id)}`;
  if (fresh.length === 1) {
    const message = fresh[0];
    return {
      title: senderLabel(message),
      body: message.subject || "New message",
      url,
      tag: `mail-${identity.id}`,
      identityId: identity.id,
      renotify: true,
    };
  }
  return {
    title: `${fresh.length} new messages`,
    body: identity.email,
    url,
    tag: `mail-${identity.id}`,
    identityId: identity.id,
    renotify: true,
  };
}

/** Baseline unseen IDs so only mail arriving after subscribe/poll triggers push. */
export async function seedNotifyCursor(identity: MailIdentity) {
  const messages = await fetchMessages(identity, "INBOX");
  const remoteIds = messages.filter((message) => !message.seen).map((message) => message.remoteId);
  await prisma.mailNotifyCursor.upsert({
    where: { identityId: identity.id },
    create: { identityId: identity.id, lastRemoteIds: remoteIds, lastCheckedAt: new Date() },
    update: { lastRemoteIds: remoteIds, lastCheckedAt: new Date() },
  });
  await prisma.mailIdentity.update({
    where: { id: identity.id },
    data: { lastSyncAt: new Date() },
  });
}

export async function seedNotifyCursorsForUser(userId: string) {
  const { listAccessibleIdentities } = await import("@/lib/identities");
  const identities = await listAccessibleIdentities(userId);
  for (const identity of identities) {
    if (!identity.connected || !identity.credentialsEnc) continue;
    try {
      await seedNotifyCursor(identity);
    } catch {
      /* mailbox unreachable */
    }
  }
}

async function acquireLock() {
  const now = Date.now();
  const existing = await prisma.appSetting.findUnique({ where: { key: LOCK_KEY } });
  if (existing) {
    const lockedAt = Date.parse(existing.value);
    if (Number.isFinite(lockedAt) && now - lockedAt < LOCK_STALE_MS) return false;
  }
  await prisma.appSetting.upsert({
    where: { key: LOCK_KEY },
    create: { key: LOCK_KEY, value: new Date(now).toISOString() },
    update: { value: new Date(now).toISOString() },
  });
  return true;
}

async function notifyIdentity(identity: MailIdentity) {
  const messages = await fetchMessages(identity, "INBOX");
  const unseen = messages.filter((message) => !message.seen);
  const remoteIds = unseen.map((message) => message.remoteId);
  const cursor = await prisma.mailNotifyCursor.findUnique({ where: { identityId: identity.id } });

  await prisma.mailIdentity.update({
    where: { id: identity.id },
    data: { lastSyncAt: new Date() },
  });

  if (!cursor) {
    await seedNotifyCursor(identity);
    return;
  }

  const known = new Set(cursor.lastRemoteIds);
  const fresh = unseen.filter((message) => !known.has(message.remoteId));

  await prisma.mailNotifyCursor.update({
    where: { identityId: identity.id },
    data: { lastRemoteIds: remoteIds, lastCheckedAt: new Date() },
  });

  if (fresh.length === 0) return;

  const [members, grants, prefs, subscribers] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspaceId: identity.workspaceId, disabled: false },
      select: { userId: true, role: true },
    }),
    prisma.identityGrant.findMany({
      where: { identityId: identity.id },
      select: { userId: true },
    }),
    prisma.notificationPref.findMany({ where: { identityId: identity.id } }),
    prisma.pushSubscription.findMany({ select: { userId: true } }),
  ]);

  const grantUserIds = new Set(grants.map((grant) => grant.userId));
  const prefByUser = new Map(prefs.map((pref) => [pref.userId, pref]));
  const subscribed = new Set(subscribers.map((row) => row.userId));
  const payload = payloadFor(identity, fresh);

  const recipients = members.filter(
    (member) =>
      subscribed.has(member.userId) &&
      canReceiveForIdentity(identity, member, grantUserIds) &&
      wantsDesktop(prefByUser.get(member.userId)),
  );

  await Promise.all(recipients.map((member) => sendPushToUser(member.userId, payload)));
}

export async function pollNewMail() {
  const subscriptionCount = await prisma.pushSubscription.count();
  if (subscriptionCount === 0) return { checked: 0, skipped: true as const };

  if (!(await acquireLock())) return { checked: 0, skipped: true as const };

  const identities = await prisma.mailIdentity.findMany({
    where: { connected: true, credentialsEnc: { not: null } },
  });

  let checked = 0;
  for (const identity of identities) {
    try {
      await notifyIdentity(identity);
      checked += 1;
    } catch {
      /* mailbox unreachable — try the next one */
    }
  }
  return { checked, skipped: false as const };
}

export function startMailNotifier() {
  if (notifyRuntime.__mailslipNotifyStarted) return;
  notifyRuntime.__mailslipNotifyStarted = true;
  const tick = () => {
    void pollNewMail().catch((error) => {
      console.error("[mailslip] mail notify failed", error);
    });
  };
  setTimeout(tick, 5_000);
  setInterval(tick, POLL_MS);
}

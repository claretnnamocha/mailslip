import webpush from "web-push";
import { prisma } from "@/lib/db";
import { platformHost } from "@/lib/public-url";

const PUBLIC_KEY = "vapidPublicKey";
const PRIVATE_KEY = "vapidPrivateKey";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  identityId?: string;
  force?: boolean;
  renotify?: boolean;
};

async function readStoredKeys() {
  const [pub, priv] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: PUBLIC_KEY } }),
    prisma.appSetting.findUnique({ where: { key: PRIVATE_KEY } }),
  ]);
  if (pub?.value && priv?.value) return { publicKey: pub.value, privateKey: priv.value };
  return null;
}

export async function getVapidKeys() {
  const fromEnv = {
    publicKey: process.env.VAPID_PUBLIC_KEY?.trim() || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || "",
    privateKey: process.env.VAPID_PRIVATE_KEY?.trim() || "",
  };
  if (fromEnv.publicKey && fromEnv.privateKey) return fromEnv;

  const stored = await readStoredKeys();
  if (stored) return stored;

  const generated = webpush.generateVAPIDKeys();
  try {
    await prisma.appSetting.createMany({
      data: [
        { key: PUBLIC_KEY, value: generated.publicKey },
        { key: PRIVATE_KEY, value: generated.privateKey },
      ],
      skipDuplicates: true,
    });
  } catch {
    /* unique race — another worker wrote first */
  }
  return (await readStoredKeys()) || generated;
}

function vapidSubject() {
  const explicit = process.env.VAPID_SUBJECT?.trim();
  if (explicit) return explicit;
  const host = platformHost().replace(/:\d+$/, "") || "localhost";
  return `mailto:noreply@${host}`;
}

async function configuredWebPush() {
  const keys = await getVapidKeys();
  webpush.setVapidDetails(vapidSubject(), keys.publicKey, keys.privateKey);
  return webpush;
}

function isGone(error: unknown) {
  const status = (error as { statusCode?: number } | null)?.statusCode;
  return status === 404 || status === 410;
}

export async function sendPushToSubscription(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
) {
  const client = await configuredWebPush();
  await client.sendNotification(
    {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    },
    JSON.stringify({
      icon: "/logo-192.png",
      badge: "/logo-192.png",
      ...payload,
    }),
  );
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await sendPushToSubscription(sub, payload);
      } catch (error) {
        if (isGone(error)) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
        }
      }
    }),
  );
}

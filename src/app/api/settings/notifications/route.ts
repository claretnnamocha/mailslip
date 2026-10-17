import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { listAccessibleIdentities } from "@/lib/identities";

export const runtime = "nodejs";

export async function GET() {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const [user, identities, prefs, pushCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: authResult.userId },
      select: { notifyBadge: true },
    }),
    listAccessibleIdentities(authResult.userId),
    prisma.notificationPref.findMany({ where: { userId: authResult.userId } }),
    prisma.pushSubscription.count({ where: { userId: authResult.userId } }),
  ]);

  const prefByIdentity = new Map(prefs.map((pref) => [pref.identityId, pref]));

  return NextResponse.json({
    badge: user?.notifyBadge !== false,
    subscribed: pushCount > 0,
    identities: identities.map((identity) => {
      const pref = prefByIdentity.get(identity.id);
      return {
        id: identity.id,
        email: identity.email,
        displayName: identity.displayName,
        color: identity.color,
        desktop: pref?.desktop ?? true,
        sound: pref?.sound ?? false,
      };
    }),
  });
}

const patchSchema = z.object({
  badge: z.boolean().optional(),
  identityId: z.string().optional(),
  desktop: z.boolean().optional(),
  sound: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;
  const body = patchSchema.parse(await request.json());

  if (body.badge !== undefined) {
    await prisma.user.update({
      where: { id: authResult.userId },
      data: { notifyBadge: body.badge },
    });
  }

  if (body.identityId && (body.desktop !== undefined || body.sound !== undefined)) {
    const identities = await listAccessibleIdentities(authResult.userId);
    if (!identities.some((identity) => identity.id === body.identityId)) {
      return jsonError("Identity not found", 404);
    }
    const existing = await prisma.notificationPref.findFirst({
      where: { userId: authResult.userId, identityId: body.identityId },
    });
    if (existing) {
      await prisma.notificationPref.update({
        where: { id: existing.id },
        data: {
          ...(body.desktop !== undefined ? { desktop: body.desktop } : {}),
          ...(body.sound !== undefined ? { sound: body.sound } : {}),
        },
      });
    } else {
      await prisma.notificationPref.create({
        data: {
          userId: authResult.userId,
          identityId: body.identityId,
          desktop: body.desktop ?? true,
          sound: body.sound ?? false,
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}

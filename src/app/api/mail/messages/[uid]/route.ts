import { NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/api";
import { canAccessIdentity } from "@/lib/identities";
import { fetchMessage, moveMail, updateMessageFlags } from "@/lib/mail/service";

export async function GET(
  request: Request,
  context: { params: Promise<{ uid: string }> },
) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const { uid: uidParam } = await context.params;
  const uid = Number(uidParam) || 0;
  const { searchParams } = new URL(request.url);
  const identityId = searchParams.get("identityId");
  const folder = searchParams.get("folder") || "INBOX";
  const remoteId = searchParams.get("remoteId") || uidParam;
  if (!identityId) return jsonError("identityId required");

  const access = await canAccessIdentity(authResult.userId, identityId);
  if (!access) return jsonError("Forbidden", 403);

  const message = await fetchMessage(access.identity, folder, uid, remoteId);
  if (!message) return jsonError("Not found", 404);
  return NextResponse.json(message);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ uid: string }> },
) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const { uid: uidParam } = await context.params;
  const uid = Number(uidParam) || 0;
  const body = await request.json();
  const access = await canAccessIdentity(authResult.userId, body.identityId);
  if (!access) return jsonError("Forbidden", 403);

  await updateMessageFlags(
    access.identity,
    body.folder || "INBOX",
    uid,
    { seen: body.seen, flagged: body.flagged },
    body.remoteId || uidParam,
  );
  return NextResponse.json({ ok: true });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ uid: string }> },
) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const { uid: uidParam } = await context.params;
  const uid = Number(uidParam) || 0;
  const body = await request.json();
  const access = await canAccessIdentity(authResult.userId, body.identityId);
  if (!access || access.permission === "READ_ONLY") {
    return jsonError("Forbidden", 403);
  }

  if (body.action === "move") {
    await moveMail(
      access.identity,
      body.folder || "INBOX",
      uid,
      body.destination,
      body.remoteId || uidParam,
    );
  }
  if (body.action === "snooze") {
    const { prisma } = await import("@/lib/db");
    await prisma.snoozedMessage.create({
      data: {
        userId: authResult.userId,
        identityId: body.identityId,
        uid,
        folder: body.folder || "INBOX",
        wakeAt: new Date(body.wakeAt),
      },
    });
  }
  return NextResponse.json({ ok: true });
}

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
  const uid = Number(uidParam);
  const { searchParams } = new URL(request.url);
  const identityId = searchParams.get("identityId");
  const folder = searchParams.get("folder") || "INBOX";
  if (!identityId) return jsonError("identityId required");

  const access = await canAccessIdentity(authResult.userId, identityId);
  if (!access) return jsonError("Forbidden", 403);

  const message = await fetchMessage(access.identity, folder, uid);
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
  const uid = Number(uidParam);
  const body = await request.json();
  const access = await canAccessIdentity(authResult.userId, body.identityId);
  if (!access) return jsonError("Forbidden", 403);

  await updateMessageFlags(access.identity, body.folder || "INBOX", uid, {
    seen: body.seen,
    flagged: body.flagged,
  });
  return NextResponse.json({ ok: true });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ uid: string }> },
) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const { uid: uidParam } = await context.params;
  const uid = Number(uidParam);
  const body = await request.json();
  const access = await canAccessIdentity(authResult.userId, body.identityId);
  if (!access || access.permission === "READ_ONLY") {
    return jsonError("Forbidden", 403);
  }

  if (body.action === "move") {
    await moveMail(access.identity, body.folder || "INBOX", uid, body.destination);
  }
  return NextResponse.json({ ok: true });
}

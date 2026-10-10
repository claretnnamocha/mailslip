import { NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/api";
import { canAccessIdentity } from "@/lib/identities";
import {
  createIdentityMailbox,
  emptyIdentityMailbox,
  fetchFolders,
  markIdentityFolderRead,
} from "@/lib/mail/service";

export async function GET(request: Request) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const identityId = new URL(request.url).searchParams.get("identityId");
  if (!identityId) return jsonError("identityId required");

  const access = await canAccessIdentity(authResult.userId, identityId);
  if (!access) return jsonError("Forbidden", 403);

  try {
    const folders = await fetchFolders(access.identity);
    return NextResponse.json(folders);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 500);
  }
}

export async function POST(request: Request) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const body = await request.json();
  const identityId = body.identityId as string | undefined;
  if (!identityId) return jsonError("identityId required");

  const access = await canAccessIdentity(authResult.userId, identityId);
  if (!access || access.permission === "READ_ONLY") {
    return jsonError("Forbidden", 403);
  }

  try {
    if (body.action === "create") {
      const name = String(body.name || "").trim();
      if (!name) return jsonError("name required");
      const path = await createIdentityMailbox(
        access.identity,
        name,
        body.parentPath ? String(body.parentPath) : undefined,
      );
      return NextResponse.json({ ok: true, path });
    }
    if (body.action === "mark-all-read") {
      const folder = String(body.folder || "INBOX");
      const count = await markIdentityFolderRead(access.identity, folder);
      return NextResponse.json({ ok: true, count });
    }
    if (body.action === "empty") {
      const folder = String(body.folder || "");
      if (!folder) return jsonError("folder required");
      const count = await emptyIdentityMailbox(access.identity, folder);
      return NextResponse.json({ ok: true, count });
    }
    return jsonError("Unknown action");
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 500);
  }
}

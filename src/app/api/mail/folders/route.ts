import { NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/api";
import { canAccessIdentity } from "@/lib/identities";
import { fetchFolders } from "@/lib/mail/service";

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

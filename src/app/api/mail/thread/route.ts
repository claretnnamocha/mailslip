import { NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/api";
import { canAccessIdentity } from "@/lib/identities";
import { fetchThread } from "@/lib/mail/service";

export async function GET(request: Request) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const { searchParams } = new URL(request.url);
  const identityId = searchParams.get("identityId");
  const folder = searchParams.get("folder") || "INBOX";
  const ids = (searchParams.get("ids") || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (!identityId) return jsonError("identityId required");
  if (ids.length === 0) return jsonError("ids required");

  const access = await canAccessIdentity(authResult.userId, identityId);
  if (!access) return jsonError("Forbidden", 403);

  try {
    const messages = await fetchThread(access.identity, folder, ids);
    return NextResponse.json(messages);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load thread", 500);
  }
}

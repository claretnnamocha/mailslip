import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, jsonError } from "@/lib/api";
import { canAccessIdentity } from "@/lib/identities";
import { sendIdentityMail } from "@/lib/mail/service";

const schema = z.object({
  identityId: z.string(),
  to: z.array(z.string().email()).min(1),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  subject: z.string(),
  html: z.string().optional(),
  text: z.string().optional(),
  inReplyTo: z.string().optional(),
  references: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const body = schema.parse(await request.json());
  const access = await canAccessIdentity(authResult.userId, body.identityId);
  if (!access || access.permission === "READ_ONLY") {
    return jsonError("Forbidden", 403);
  }

  try {
    const result = await sendIdentityMail(access.identity, body);
    return NextResponse.json(result);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Send failed", 500);
  }
}

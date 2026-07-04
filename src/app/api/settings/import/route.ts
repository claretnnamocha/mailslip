import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, jsonError } from "@/lib/api";
import { canAccessIdentity } from "@/lib/identities";
import { identityToConfig } from "@/lib/identities";
import { importImapToImap } from "@/lib/mail/import-imap";

const schema = z.object({
  identityId: z.string(),
  sourceHost: z.string(),
  sourcePort: z.number().default(993),
  sourceUser: z.string(),
  sourcePassword: z.string(),
  folder: z.string().default("INBOX"),
  limit: z.number().default(100),
});

export async function POST(request: Request) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const body = schema.parse(await request.json());
  const access = await canAccessIdentity(authResult.userId, body.identityId);
  if (!access || access.permission === "READ_ONLY") return jsonError("Forbidden", 403);

  const dest = identityToConfig(access.identity);
  if (!dest?.imapHost) return jsonError("Destination identity has no IMAP host");

  try {
    const result = await importImapToImap({
      source: {
        host: body.sourceHost,
        port: body.sourcePort,
        user: body.sourceUser,
        password: body.sourcePassword,
      },
      dest: {
        host: dest.imapHost!,
        port: dest.imapPort || 993,
        user: dest.username,
        password: dest.password,
      },
      folder: body.folder,
      limit: body.limit,
    });
    return NextResponse.json({
      ...result,
      message: "Import complete. Source mail was not deleted.",
    });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Import failed", 500);
  }
}

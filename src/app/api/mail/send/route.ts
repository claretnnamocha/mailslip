import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canAccessIdentity } from "@/lib/identities";
import { sendIdentityMail } from "@/lib/mail/service";
import { encryptMessage } from "@/lib/pgp";

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
  scheduleAt: z.string().datetime().optional(),
  encrypt: z.boolean().optional(),
  attachments: z
    .array(
      z.object({
        filename: z.string(),
        contentType: z.string(),
        contentBase64: z.string(),
      }),
    )
    .optional(),
});

export async function POST(request: Request) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const body = schema.parse(await request.json());
  const access = await canAccessIdentity(authResult.userId, body.identityId);
  if (!access || access.permission === "READ_ONLY") {
    return jsonError("Forbidden", 403);
  }

  // Blocked senders check
  const blocked = await prisma.blockedSender.findMany({
    where: { userId: authResult.userId },
  });
  for (const recipient of body.to) {
    const domain = recipient.split("@")[1];
    if (
      blocked.some(
        (b) =>
          b.value.toLowerCase() === recipient.toLowerCase() ||
          b.value.toLowerCase() === domain?.toLowerCase(),
      )
    ) {
      return jsonError(`Recipient blocked: ${recipient}`, 400);
    }
  }

  if (body.scheduleAt) {
    const sendAt = new Date(body.scheduleAt);
    if (sendAt.getTime() <= Date.now()) return jsonError("scheduleAt must be in the future");
    const row = await prisma.scheduledSend.create({
      data: {
        userId: authResult.userId,
        identityId: body.identityId,
        to: body.to,
        cc: body.cc || [],
        bcc: body.bcc || [],
        subject: body.subject,
        htmlBody: body.html,
        textBody: body.text,
        sendAt,
      },
    });
    return NextResponse.json({ scheduled: true, id: row.id, sendAt: row.sendAt });
  }

  let html = body.html;
  let text = body.text;

  if (body.encrypt) {
    const keys = await prisma.pgpKey.findMany({
      where: { email: { in: body.to } },
    });
    if (keys.length === 0) {
      return jsonError("No PGP public keys found for recipients", 400);
    }
    const plain = text || html || "";
    const encrypted = await encryptMessage(
      plain,
      keys.map((k) => k.publicKey),
    );
    text = encrypted;
    html = undefined;
  }

  // Attachments note: stored as text markers for demo; real MIME multipart would go here
  if (body.attachments?.length) {
    const names = body.attachments.map((a) => a.filename).join(", ");
    text = `${text || ""}\n\n[Attachments: ${names}]`;
  }

  try {
    const result = await sendIdentityMail(access.identity, {
      to: body.to,
      cc: body.cc,
      bcc: body.bcc,
      subject: body.subject,
      html,
      text,
      inReplyTo: body.inReplyTo,
      references: body.references,
    });
    return NextResponse.json(result);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Send failed", 500);
  }
}

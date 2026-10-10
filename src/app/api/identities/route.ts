import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { getPrimaryWorkspace, isAdminRole, listAccessibleIdentities } from "@/lib/identities";
import { testIdentityConnection } from "@/lib/mail/service";
import { checkDeliverability } from "@/lib/mail/dns-health";

export async function GET() {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const identities = await listAccessibleIdentities(authResult.userId);
  return NextResponse.json(
    identities.map((i) => ({
      id: i.id,
      email: i.email,
      displayName: i.displayName,
      color: i.color,
      type: i.type,
      access: i.access,
      ownerUserId: i.ownerUserId,
      connected: i.connected,
      incomingProtocol: i.incomingProtocol,
      spfOk: i.spfOk,
      dkimOk: i.dkimOk,
      dmarcOk: i.dmarcOk,
      mxOk: i.mxOk,
    })),
  );
}

const createSchema = z.object({
  email: z.string().email(),
  displayName: z.string().optional(),
  incomingProtocol: z.enum(["IMAP", "POP3", "JMAP"]).default("IMAP"),
  authMode: z.enum(["PASSWORD", "APP_PASSWORD", "OAUTH"]).default("PASSWORD"),
  username: z.string().min(1),
  password: z.string().min(1),
  imapHost: z.string().optional(),
  imapPort: z.number().optional(),
  pop3Host: z.string().optional(),
  pop3Port: z.number().optional(),
  jmapUrl: z.string().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().optional(),
  cardDavUrl: z.string().optional(),
  calDavUrl: z.string().optional(),
  type: z.enum(["OWN_MAILBOX", "SCOPED_ALIAS", "DOMAIN_ADDRESS"]).optional(),
  backingIdentityId: z.string().optional(),
  recipientFilter: z.string().optional(),
  test: z.boolean().optional(),
  color: z.string().optional(),
  assignUserId: z.string().optional(),
  /** PERSONAL: only the owner profile can use or manage this mailbox. */
  access: z.enum(["SHARED", "PERSONAL"]).default("SHARED"),
});

export async function POST(request: Request) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult.error;

  const membership = await getPrimaryWorkspace(authResult.userId);
  if (!membership) return jsonError("No workspace", 400);
  if (!isAdminRole(membership.role)) {
    return jsonError("Only owners and admins can connect mailboxes", 403);
  }

  const body = createSchema.parse(await request.json());

  let ownerUserId = authResult.userId;
  if (body.assignUserId && body.assignUserId !== authResult.userId) {
    const target = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: membership.workspaceId,
          userId: body.assignUserId,
        },
      },
    });
    if (!target) return jsonError("That person is not in this workspace", 400);
    ownerUserId = target.userId;
  }

  const draft = {
    email: body.email,
    displayName: body.displayName,
    incomingProtocol: body.incomingProtocol,
    authMode: body.authMode,
    username: body.username,
    imapHost: body.imapHost,
    imapPort: body.imapPort,
    pop3Host: body.pop3Host || body.imapHost,
    pop3Port: body.pop3Port,
    jmapUrl: body.jmapUrl,
    smtpHost: body.smtpHost,
    smtpPort: body.smtpPort,
  };

  let health = null;
  if (body.test !== false) {
    try {
      await testIdentityConnection(draft as never, body.password);
    } catch (e) {
      return jsonError(
        e instanceof Error ? e.message : "Connection test failed",
        400,
      );
    }
    const domain = body.email.split("@")[1];
    if (domain) {
      health = await checkDeliverability(domain);
    }
  }

  const access = body.access || "SHARED";

  const identity = await prisma.mailIdentity.create({
    data: {
      workspaceId: membership.workspaceId,
      ownerUserId,
      type: body.type || "OWN_MAILBOX",
      access,
      email: body.email,
      displayName: body.displayName,
      color: body.color || "#BE7C5E",
      incomingProtocol: body.incomingProtocol,
      authMode: body.authMode,
      username: body.username,
      credentialsEnc: encryptSecret(body.password),
      imapHost: body.imapHost,
      imapPort: body.imapPort ?? (body.incomingProtocol === "POP3" ? 995 : 993),
      imapTls: true,
      pop3Host: body.pop3Host || body.imapHost,
      pop3Port: body.pop3Port ?? 995,
      pop3Tls: true,
      jmapUrl: body.jmapUrl,
      smtpHost: body.smtpHost,
      smtpPort: body.smtpPort ?? 587,
      smtpTls: true,
      cardDavUrl: body.cardDavUrl,
      calDavUrl: body.calDavUrl,
      backingIdentityId: body.backingIdentityId,
      recipientFilter: body.recipientFilter || body.email,
      connected: true,
      mxOk: health?.mxOk ?? null,
      spfOk: health?.spfOk ?? null,
      dkimOk: health?.dkimOk ?? null,
      dmarcOk: health?.dmarcOk ?? null,
    },
  });

  // Shared mailboxes get an explicit grant for the assignee. Personal ones are
  // owner-only — no grants, so other admins/members cannot control them.
  if (access === "SHARED" && ownerUserId !== authResult.userId) {
    await prisma.identityGrant.create({
      data: {
        identityId: identity.id,
        userId: ownerUserId,
        permission: "SEND_AND_READ",
      },
    });
  }

  return NextResponse.json({ identity, health });
}

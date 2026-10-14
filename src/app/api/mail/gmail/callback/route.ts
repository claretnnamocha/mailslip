import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { getPrimaryWorkspace, isAdminRole } from "@/lib/identities";
import { checkDeliverability } from "@/lib/mail/dns-health";
import {
  exchangeGoogleCode,
  fetchGoogleProfile,
  GMAIL_IMAP_HOST,
  GMAIL_IMAP_PORT,
  GMAIL_SMTP_HOST,
  GMAIL_SMTP_PORT,
  gmailRedirectUri,
  packGmailTokens,
  unpackGmailState,
  type GmailReturnPath,
} from "@/lib/mail/gmail";
import { testIdentityConnection } from "@/lib/mail/service";
import { requestPublicOrigin } from "@/lib/public-url";

function redirectBack(
  origin: string,
  returnTo: GmailReturnPath,
  params: Record<string, string | undefined>,
) {
  const url = new URL(returnTo, origin);
  for (const [key, value] of Object.entries(params)) {
    if (!value) continue;
    url.searchParams.set(key, value.slice(0, 180));
  }
  return NextResponse.redirect(url);
}

function publicError(error: unknown) {
  const message = error instanceof Error ? error.message : "Could not connect Gmail";
  if (/ya29\.|refresh_token|client_secret|access_token/i.test(message)) {
    return "Could not connect this Gmail account.";
  }
  if (/authenticationfailed|invalid credentials|auth/i.test(message)) {
    return "Gmail refused the mailbox connection. Turn on IMAP in Gmail settings, then try again.";
  }
  return message.slice(0, 180);
}

export async function GET(request: Request) {
  const origin = requestPublicOrigin(request.headers, request.url);
  const url = new URL(request.url);
  const fallback = "/settings/identities" as const;

  let returnTo: GmailReturnPath = fallback;
  let context: Record<string, string | undefined> = {};

  try {
    const googleError = url.searchParams.get("error");
    if (googleError) {
      const message =
        googleError === "access_denied"
          ? "Google sign-in was cancelled."
          : googleError === "redirect_uri_mismatch"
            ? "This site's address is not registered as a Google redirect URI."
            : "Google sign-in failed. Try again.";
      const stateRaw = url.searchParams.get("state");
      if (stateRaw) {
        try {
          const state = unpackGmailState(stateRaw);
          return redirectBack(origin, state.returnTo, {
            gmailError: message,
            for: state.assignUserId,
            email: state.loginHint,
            access: state.access,
            name: state.displayName,
          });
        } catch {
          /* expired or tampered state still gets a generic return */
        }
      }
      return redirectBack(origin, fallback, { gmailError: message });
    }

    const stateRaw = url.searchParams.get("state");
    const code = url.searchParams.get("code");
    if (!stateRaw || !code) {
      return redirectBack(origin, fallback, { gmailError: "Google sign-in did not finish. Start again." });
    }

    const state = unpackGmailState(stateRaw);
    returnTo = state.returnTo;
    context = {
      for: state.assignUserId,
      email: state.loginHint,
      access: state.access,
      name: state.displayName,
    };

    const authResult = await requireUser();
    if ("error" in authResult) {
      return NextResponse.redirect(new URL("/login", origin));
    }
    if (authResult.userId !== state.userId) {
      return redirectBack(origin, returnTo, {
        gmailError: "This Google sign-in was started in a different session. Start again.",
        ...context,
      });
    }

    const membership = await getPrimaryWorkspace(authResult.userId);
    if (!membership) return redirectBack(origin, returnTo, { gmailError: "No workspace", ...context });
    if (!isAdminRole(membership.role)) {
      return redirectBack(origin, returnTo, {
        gmailError: "Only owners and admins can connect mailboxes",
        ...context,
      });
    }

    let ownerUserId = authResult.userId;
    if (state.assignUserId && state.assignUserId !== authResult.userId) {
      const target = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: membership.workspaceId,
            userId: state.assignUserId,
          },
        },
      });
      if (!target) {
        return redirectBack(origin, returnTo, {
          gmailError: "That person is not in this workspace",
          ...context,
        });
      }
      ownerUserId = target.userId;
    }

    const tokens = await exchangeGoogleCode(code, gmailRedirectUri(origin));
    const profile = await fetchGoogleProfile(tokens.accessToken);
    if (state.loginHint && state.loginHint !== profile.email) {
      return redirectBack(origin, returnTo, {
        gmailError: `Google signed in as ${profile.email}. Connect that address, or enter the same one you type here.`,
        ...context,
      });
    }

    const draft = {
      email: profile.email,
      username: profile.email,
      incomingProtocol: "IMAP" as const,
      imapHost: GMAIL_IMAP_HOST,
      imapPort: GMAIL_IMAP_PORT,
      imapTls: true,
      pop3Host: null,
      pop3Port: null,
      pop3Tls: true,
      jmapUrl: null,
      smtpHost: GMAIL_SMTP_HOST,
      smtpPort: GMAIL_SMTP_PORT,
      smtpTls: true,
    };
    try {
      await testIdentityConnection(draft, "", tokens.accessToken);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/authenticationfailed|invalid credentials|command failed/i.test(message)) {
        throw new Error(
          "Gmail refused IMAP. In Gmail, open Settings → See all settings → Forwarding and POP/IMAP, enable IMAP, then try again.",
        );
      }
      throw error;
    }

    const domain = profile.email.split("@")[1];
    const health = domain ? await checkDeliverability(domain).catch(() => null) : null;
    const displayName = state.displayName || profile.name || profile.email.split("@")[0];
    const credentialsEnc = encryptSecret(
      packGmailTokens({
        refreshToken: tokens.refreshToken,
        accessToken: tokens.accessToken,
        expiresAt: tokens.expiresAt,
      }),
    );

    const existing = await prisma.mailIdentity.findFirst({
      where: {
        workspaceId: membership.workspaceId,
        email: { equals: profile.email, mode: "insensitive" },
      },
    });

    if (existing && existing.type !== "OWN_MAILBOX" && existing.type !== "DOMAIN_ADDRESS") {
      return redirectBack(origin, returnTo, {
        gmailError: "That address is already connected as another kind of identity.",
        ...context,
      });
    }

    if (existing?.access === "PERSONAL" && existing.ownerUserId && existing.ownerUserId !== authResult.userId) {
      return redirectBack(origin, returnTo, {
        gmailError: "That mailbox is personal to someone else.",
        ...context,
      });
    }

    if (existing) {
      await prisma.mailIdentity.update({
        where: { id: existing.id },
        data: {
          authMode: "OAUTH",
          username: profile.email,
          credentialsEnc,
          incomingProtocol: "IMAP",
          imapHost: GMAIL_IMAP_HOST,
          imapPort: GMAIL_IMAP_PORT,
          imapTls: true,
          smtpHost: GMAIL_SMTP_HOST,
          smtpPort: GMAIL_SMTP_PORT,
          smtpTls: true,
          connected: true,
          displayName: state.displayName || existing.displayName || displayName,
          mxOk: health?.mxOk ?? existing.mxOk,
          spfOk: health?.spfOk ?? existing.spfOk,
          dkimOk: health?.dkimOk ?? existing.dkimOk,
          dmarcOk: health?.dmarcOk ?? existing.dmarcOk,
        },
      });
    } else {
      const identity = await prisma.mailIdentity.create({
        data: {
          workspaceId: membership.workspaceId,
          ownerUserId,
          boundUserId: state.access === "PERSONAL" ? ownerUserId : null,
          type: "OWN_MAILBOX",
          access: state.access,
          email: profile.email,
          displayName,
          color: "#BE7C5E",
          incomingProtocol: "IMAP",
          authMode: "OAUTH",
          username: profile.email,
          credentialsEnc,
          imapHost: GMAIL_IMAP_HOST,
          imapPort: GMAIL_IMAP_PORT,
          imapTls: true,
          pop3Host: "pop.gmail.com",
          pop3Port: 995,
          pop3Tls: true,
          smtpHost: GMAIL_SMTP_HOST,
          smtpPort: GMAIL_SMTP_PORT,
          smtpTls: true,
          connected: true,
          recipientFilter: profile.email,
          mxOk: health?.mxOk ?? null,
          spfOk: health?.spfOk ?? null,
          dkimOk: health?.dkimOk ?? null,
          dmarcOk: health?.dmarcOk ?? null,
        },
      });

      if (state.access === "SHARED" && ownerUserId !== authResult.userId) {
        await prisma.identityGrant.create({
          data: {
            identityId: identity.id,
            userId: ownerUserId,
            permission: "SEND_AND_READ",
          },
        });
      }
    }

    return redirectBack(origin, returnTo, {
      gmail: "connected",
      email: profile.email,
      ...context,
    });
  } catch (error) {
    return redirectBack(origin, returnTo, {
      gmailError: publicError(error),
      ...context,
    });
  }
}

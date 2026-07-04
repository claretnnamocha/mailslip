import type { MailIdentity } from "@prisma/client";
import {
  identityToConfig,
  resolveBackingIdentity,
} from "@/lib/identities";
import {
  appendMessage,
  getMessage,
  listFolders,
  listMessages,
  moveMessage,
  searchMessages,
  setFlags,
  testImapConnection,
} from "./imap";
import { sendMail, testSmtpConnection } from "./smtp";
import {
  demoFolders,
  getDemoMessage,
  listDemoMessages,
  searchDemoMessages,
} from "./demo";
import { messageMatchesScope } from "./scoped";
import type { MailMessageSummary, SendPayload } from "./types";

function useDemo() {
  return process.env.DEMO_MAIL === "true";
}

export async function testIdentityConnection(identity: MailIdentity, password: string) {
  const config = {
    email: identity.email,
    username: identity.username || identity.email,
    password,
    incomingProtocol: identity.incomingProtocol,
    imapHost: identity.imapHost,
    imapPort: identity.imapPort,
    imapTls: identity.imapTls,
    pop3Host: identity.pop3Host,
    pop3Port: identity.pop3Port,
    pop3Tls: identity.pop3Tls,
    jmapUrl: identity.jmapUrl,
    smtpHost: identity.smtpHost,
    smtpPort: identity.smtpPort,
    smtpTls: identity.smtpTls,
  };

  if (useDemo()) {
    return { incoming: { ok: true as const, messages: 4, unseen: 2 }, outgoing: { ok: true as const } };
  }

  const incoming =
    identity.incomingProtocol === "IMAP"
      ? await testImapConnection(config)
      : { ok: true as const, messages: 0, unseen: 0, note: "POP3/JMAP test deferred" };

  const outgoing = identity.smtpHost
    ? await testSmtpConnection(config)
    : { ok: true as const, note: "No SMTP configured" };

  return { incoming, outgoing };
}

export async function fetchFolders(identity: MailIdentity) {
  if (useDemo()) return demoFolders;
  const backing = await resolveBackingIdentity(identity);
  const config = identityToConfig(backing);
  if (!config) throw new Error("Identity credentials missing");
  return listFolders(config);
}

export async function fetchMessages(
  identity: MailIdentity,
  folder = "INBOX",
): Promise<MailMessageSummary[]> {
  if (useDemo()) {
    let messages = listDemoMessages(folder);
    if (identity.type === "SCOPED_ALIAS" && identity.recipientFilter) {
      messages = messages.filter(
        (m) => m.identityEmail?.toLowerCase() === identity.recipientFilter!.toLowerCase(),
      );
    }
    return messages.map((m) => ({
      ...m,
      identityId: identity.id,
      identityEmail: identity.email,
      identityColor: identity.color,
    }));
  }

  const backing = await resolveBackingIdentity(identity);
  const config = identityToConfig(backing);
  if (!config) throw new Error("Identity credentials missing");

  let messages = await listMessages(config, folder, {
    identityId: identity.id,
    identityEmail: identity.email,
    identityColor: identity.color,
  });

  if (identity.type === "SCOPED_ALIAS" && identity.recipientFilter) {
    // List view uses identityEmail tagging; full enforcement on open.
    if (folder.toLowerCase().includes("sent")) {
      messages = messages.filter(
        (m) => m.from.address.toLowerCase() === identity.email.toLowerCase(),
      );
    }
  }

  return messages;
}

export async function fetchMessage(identity: MailIdentity, folder: string, uid: number) {
  if (useDemo()) {
    const msg = getDemoMessage(uid);
    if (!msg) return null;
    if (
      identity.type === "SCOPED_ALIAS" &&
      identity.recipientFilter &&
      !messageMatchesScope(msg, identity.recipientFilter, identity.matchHeader)
    ) {
      return null;
    }
    return {
      ...msg,
      identityId: identity.id,
      identityEmail: identity.email,
      identityColor: identity.color,
    };
  }

  const backing = await resolveBackingIdentity(identity);
  const config = identityToConfig(backing);
  if (!config) throw new Error("Identity credentials missing");

  const msg = await getMessage(config, folder, uid, {
    identityId: identity.id,
    identityEmail: identity.email,
    identityColor: identity.color,
  });
  if (!msg) return null;

  if (
    identity.type === "SCOPED_ALIAS" &&
    identity.recipientFilter &&
    !messageMatchesScope(msg, identity.recipientFilter, identity.matchHeader)
  ) {
    return null;
  }

  return msg;
}

export async function updateMessageFlags(
  identity: MailIdentity,
  folder: string,
  uid: number,
  flags: { seen?: boolean; flagged?: boolean },
) {
  if (useDemo()) return { ok: true };
  const backing = await resolveBackingIdentity(identity);
  const config = identityToConfig(backing);
  if (!config) throw new Error("Identity credentials missing");
  await setFlags(config, folder, uid, flags);
  return { ok: true };
}

export async function moveMail(
  identity: MailIdentity,
  folder: string,
  uid: number,
  destination: string,
) {
  if (useDemo()) return { ok: true };
  const backing = await resolveBackingIdentity(identity);
  const config = identityToConfig(backing);
  if (!config) throw new Error("Identity credentials missing");
  await moveMessage(config, folder, uid, destination);
  return { ok: true };
}

export async function sendIdentityMail(identity: MailIdentity, payload: SendPayload) {
  if (useDemo()) {
    return { messageId: `<demo-${Date.now()}@mailslip.local>`, accepted: payload.to };
  }

  const backing = await resolveBackingIdentity(identity);
  const config = identityToConfig(backing);
  if (!config) throw new Error("Identity credentials missing");

  const result = await sendMail(config, {
    ...payload,
    from: payload.from || identity.email,
    fromName: payload.fromName || identity.displayName || undefined,
  });

  // Build a minimal RFC822 copy for IMAP Sent when the server supports APPEND.
  if (config.incomingProtocol === "IMAP") {
    const raw = [
      `From: ${identity.email}`,
      `To: ${payload.to.join(", ")}`,
      `Subject: ${payload.subject}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: ${result.messageId || `<mailslip-${Date.now()}@local>`}`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="utf-8"',
      "",
      payload.text || "",
    ].join("\r\n");
    try {
      await appendMessage(config, "Sent", raw, ["\\Seen"]);
    } catch {
      try {
        await appendMessage(config, "INBOX.Sent", raw, ["\\Seen"]);
      } catch {
        /* Sent folder may not exist */
      }
    }
  }

  return result;
}

export async function searchIdentityMail(identity: MailIdentity, query: string, folder = "INBOX") {
  if (useDemo()) {
    return searchDemoMessages(query).map((m) => ({
      ...m,
      identityId: identity.id,
      identityEmail: identity.email,
      identityColor: identity.color,
    }));
  }
  const backing = await resolveBackingIdentity(identity);
  const config = identityToConfig(backing);
  if (!config) throw new Error("Identity credentials missing");
  return searchMessages(config, folder, query, {
    identityId: identity.id,
    identityEmail: identity.email,
    identityColor: identity.color,
  });
}

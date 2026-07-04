import type { MailIdentity } from "@prisma/client";
import {
  identityToConfig,
  resolveBackingIdentity,
} from "@/lib/identities";
import {
  appendMessage,
  getMessage,
  getQuota,
  listFolders,
  listMessages,
  moveMessage,
  searchMessages,
  setFlags,
  testImapConnection,
} from "./imap";
import { sendMail, testSmtpConnection } from "./smtp";
import {
  deletePop3Message,
  getPop3Message,
  listPop3Folders,
  listPop3Messages,
  testPop3Connection,
} from "./pop3";
import {
  getJmapMessage,
  listJmapFolders,
  listJmapMessages,
  sendJmapMail,
  setJmapKeywords,
  testJmapConnection,
} from "./jmap";
import {
  demoFolders,
  getDemoMessage,
  listDemoMessages,
  searchDemoMessages,
} from "./demo";
import { messageMatchesScope } from "./scoped";
import type { ConnectionConfig, MailMessageSummary, SendPayload } from "./types";

function useDemo() {
  return process.env.DEMO_MAIL === "true";
}

function toConfig(identity: MailIdentity, password: string): ConnectionConfig {
  return {
    email: identity.email,
    username: identity.username || identity.email,
    password,
    incomingProtocol: identity.incomingProtocol,
    imapHost: identity.imapHost,
    imapPort: identity.imapPort,
    imapTls: identity.imapTls,
    pop3Host: identity.pop3Host || identity.imapHost,
    pop3Port: identity.pop3Port || 995,
    pop3Tls: identity.pop3Tls,
    jmapUrl: identity.jmapUrl,
    smtpHost: identity.smtpHost,
    smtpPort: identity.smtpPort,
    smtpTls: identity.smtpTls,
  };
}

export async function testIdentityConnection(
  identity: Pick<
    MailIdentity,
    | "email"
    | "username"
    | "incomingProtocol"
    | "imapHost"
    | "imapPort"
    | "imapTls"
    | "pop3Host"
    | "pop3Port"
    | "pop3Tls"
    | "jmapUrl"
    | "smtpHost"
    | "smtpPort"
    | "smtpTls"
  >,
  password: string,
) {
  const config = toConfig(identity as MailIdentity, password);

  if (useDemo()) {
    return { incoming: { ok: true as const, messages: 4, unseen: 2 }, outgoing: { ok: true as const } };
  }

  let incoming: { ok: true; messages: number; unseen: number };
  if (identity.incomingProtocol === "POP3") {
    incoming = await testPop3Connection(config);
  } else if (identity.incomingProtocol === "JMAP") {
    incoming = await testJmapConnection(config);
  } else {
    incoming = await testImapConnection(config);
  }

  const outgoing =
    identity.incomingProtocol === "JMAP"
      ? { ok: true as const }
      : identity.smtpHost
        ? await testSmtpConnection(config)
        : { ok: true as const, note: "No SMTP configured" };

  return { incoming, outgoing };
}

function meta(identity: MailIdentity) {
  return {
    identityId: identity.id,
    identityEmail: identity.email,
    identityColor: identity.color,
  };
}

export async function fetchFolders(identity: MailIdentity) {
  if (useDemo()) return demoFolders;
  const backing = await resolveBackingIdentity(identity);
  const config = identityToConfig(backing);
  if (!config) throw new Error("Identity credentials missing");

  if (backing.incomingProtocol === "POP3") return listPop3Folders();
  if (backing.incomingProtocol === "JMAP") return listJmapFolders(config);
  return listFolders(config);
}

export async function fetchMessages(
  identity: MailIdentity,
  folder = "INBOX",
): Promise<MailMessageSummary[]> {
  if (useDemo()) {
    let messages = listDemoMessages(folder).map((m) => ({
      ...m,
      remoteId: String(m.uid),
      identityId: identity.id,
      identityEmail: identity.email,
      identityColor: identity.color,
    }));
    if (identity.type === "SCOPED_ALIAS" && identity.recipientFilter) {
      messages = messages.filter(
        (m) => m.identityEmail?.toLowerCase() === identity.recipientFilter!.toLowerCase(),
      );
    }
    return messages;
  }

  const backing = await resolveBackingIdentity(identity);
  const config = identityToConfig(backing);
  if (!config) throw new Error("Identity credentials missing");
  const m = meta(identity);

  let messages: MailMessageSummary[];
  if (backing.incomingProtocol === "POP3") {
    messages = await listPop3Messages(config, m);
  } else if (backing.incomingProtocol === "JMAP") {
    messages = await listJmapMessages(config, folder, m);
  } else {
    messages = (await listMessages(config, folder, m)).map((msg) => ({
      ...msg,
      remoteId: String(msg.uid),
    }));
  }

  if (identity.type === "SCOPED_ALIAS" && identity.recipientFilter) {
    if (folder.toLowerCase().includes("sent")) {
      messages = messages.filter(
        (msg) => msg.from.address.toLowerCase() === identity.email.toLowerCase(),
      );
    }
  }

  return messages;
}

export async function fetchMessage(
  identity: MailIdentity,
  folder: string,
  uid: number,
  remoteId?: string,
) {
  const key = remoteId || String(uid);

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
      remoteId: String(msg.uid),
      identityId: identity.id,
      identityEmail: identity.email,
      identityColor: identity.color,
    };
  }

  const backing = await resolveBackingIdentity(identity);
  const config = identityToConfig(backing);
  if (!config) throw new Error("Identity credentials missing");
  const m = meta(identity);

  let msg =
    backing.incomingProtocol === "POP3"
      ? await getPop3Message(config, Number(key), m)
      : backing.incomingProtocol === "JMAP"
        ? await getJmapMessage(config, key, folder, m)
        : await getMessage(config, folder, Number(key), m);

  if (!msg) return null;
  const full = { ...msg, remoteId: key };

  if (
    identity.type === "SCOPED_ALIAS" &&
    identity.recipientFilter &&
    !messageMatchesScope(full, identity.recipientFilter, identity.matchHeader)
  ) {
    return null;
  }

  return full;
}

export async function updateMessageFlags(
  identity: MailIdentity,
  folder: string,
  uid: number,
  flags: { seen?: boolean; flagged?: boolean },
  remoteId?: string,
) {
  if (useDemo()) return { ok: true };
  const backing = await resolveBackingIdentity(identity);
  const config = identityToConfig(backing);
  if (!config) throw new Error("Identity credentials missing");
  const key = remoteId || String(uid);

  if (backing.incomingProtocol === "JMAP") {
    await setJmapKeywords(config, key, flags);
  } else if (backing.incomingProtocol === "IMAP") {
    await setFlags(config, folder, Number(key), flags);
  }
  return { ok: true };
}

export async function moveMail(
  identity: MailIdentity,
  folder: string,
  uid: number,
  destination: string,
  remoteId?: string,
) {
  if (useDemo()) return { ok: true };
  const backing = await resolveBackingIdentity(identity);
  const config = identityToConfig(backing);
  if (!config) throw new Error("Identity credentials missing");
  const key = remoteId || String(uid);

  if (backing.incomingProtocol === "POP3") {
    if (destination.toLowerCase().includes("trash") || destination.toLowerCase().includes("junk")) {
      await deletePop3Message(config, Number(key));
    }
    return { ok: true };
  }
  if (backing.incomingProtocol === "IMAP") {
    await moveMessage(config, folder, Number(key), destination);
  }
  return { ok: true };
}

export async function sendIdentityMail(identity: MailIdentity, payload: SendPayload) {
  if (useDemo()) {
    return { messageId: `<demo-${Date.now()}@mailslip.local>`, accepted: payload.to };
  }

  const backing = await resolveBackingIdentity(identity);
  const config = identityToConfig(backing);
  if (!config) throw new Error("Identity credentials missing");

  if (backing.incomingProtocol === "JMAP") {
    return sendJmapMail(config, {
      ...payload,
      from: identity.email,
      fromName: identity.displayName || undefined,
    });
  }

  const result = await sendMail(config, {
    ...payload,
    from: payload.from || identity.email,
    fromName: payload.fromName || identity.displayName || undefined,
  });

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
      remoteId: String(m.uid),
      identityId: identity.id,
      identityEmail: identity.email,
      identityColor: identity.color,
    }));
  }
  const backing = await resolveBackingIdentity(identity);
  const config = identityToConfig(backing);
  if (!config) throw new Error("Identity credentials missing");

  if (backing.incomingProtocol === "IMAP") {
    return (await searchMessages(config, folder, query, meta(identity))).map((m) => ({
      ...m,
      remoteId: String(m.uid),
    }));
  }

  const all = await fetchMessages(identity, folder);
  const q = query.toLowerCase();
  return all.filter(
    (m) =>
      m.subject.toLowerCase().includes(q) ||
      m.snippet.toLowerCase().includes(q) ||
      m.from.address.toLowerCase().includes(q) ||
      m.from.name?.toLowerCase().includes(q),
  );
}

export async function fetchQuota(identity: MailIdentity) {
  if (useDemo()) {
    return {
      supported: true as const,
      used: 420_000_000,
      limit: 15_000_000_000,
      message: "Demo quota",
    };
  }
  if (identity.type === "SCOPED_ALIAS") {
    return {
      supported: false as const,
      message: `Counts toward backing mailbox`,
    };
  }
  const backing = await resolveBackingIdentity(identity);
  const config = identityToConfig(backing);
  if (!config) throw new Error("Identity credentials missing");
  if (backing.incomingProtocol !== "IMAP") {
    return { supported: false as const, message: "This server doesn't report a quota" };
  }
  return getQuota(config);
}

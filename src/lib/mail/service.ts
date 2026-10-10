import type { MailIdentity } from "@prisma/client";
import {
  identityToConfig,
  resolveBackingIdentity,
} from "@/lib/identities";
import {
  appendMessage,
  getImapMessages,
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
import { messageMatchesScope, recipientScopeForIdentity, summaryMatchesRecipient } from "./scoped";
import type { ConnectionConfig, MailMessageSummary, SendPayload } from "./types";

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

  let incoming: { ok: true; messages: number; unseen: number };
  if (identity.incomingProtocol === "POP3") {
    incoming = await testPop3Connection(config);
  } else if (identity.incomingProtocol === "JMAP") {
    incoming = await testJmapConnection(config);
  } else {
    incoming = await testImapConnection(config);
  }

  if (identity.incomingProtocol === "JMAP") {
    return { incoming, outgoing: { ok: true as const } };
  }

  if (!identity.smtpHost) {
    throw new Error("SMTP host is required for sending");
  }

  const outgoing = await testSmtpConnection(config);
  return { incoming, outgoing };
}

function applyIdentityScope(
  identity: MailIdentity,
  folder: string,
  messages: MailMessageSummary[],
) {
  const scope = recipientScopeForIdentity(identity);
  if (!scope) return messages;
  if (folder.toLowerCase().includes("sent")) {
    const from = identity.email.toLowerCase();
    return messages.filter((message) => message.from.address.toLowerCase() === from);
  }
  return messages.filter((message) =>
    summaryMatchesRecipient(message, scope, identity.matchHeader),
  );
}

function meta(identity: MailIdentity) {
  return {
    identityId: identity.id,
    identityEmail: identity.email,
    identityColor: identity.color,
  };
}

export async function fetchFolders(identity: MailIdentity) {
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

  return applyIdentityScope(identity, folder, messages);
}

export async function fetchMessage(
  identity: MailIdentity,
  folder: string,
  uid: number,
  remoteId?: string,
) {
  const key = remoteId || String(uid);
  const backing = await resolveBackingIdentity(identity);
  const config = identityToConfig(backing);
  if (!config) throw new Error("Identity credentials missing");
  const m = meta(identity);

  const msg =
    backing.incomingProtocol === "POP3"
      ? await getPop3Message(config, Number(key), m)
      : backing.incomingProtocol === "JMAP"
        ? await getJmapMessage(config, key, folder, m)
        : await getMessage(config, folder, Number(key), m);

  if (!msg) return null;
  const full = { ...msg, remoteId: key };

  const scope = recipientScopeForIdentity(identity);
  if (scope) {
    const sent = folder.toLowerCase().includes("sent");
    const visible = sent
      ? full.from.address.toLowerCase() === identity.email.toLowerCase()
      : messageMatchesScope(full, scope, identity.matchHeader);
    if (!visible) return null;
  }

  return full;
}

export async function fetchThread(
  identity: MailIdentity,
  folder: string,
  remoteIds: string[],
) {
  const ids = [...new Set(remoteIds.map((id) => id.trim()).filter(Boolean))].slice(0, 30);
  if (ids.length === 0) return [];

  const backing = await resolveBackingIdentity(identity);
  const config = identityToConfig(backing);
  if (!config) throw new Error("Identity credentials missing");
  const m = meta(identity);

  let messages;
  if (backing.incomingProtocol === "IMAP") {
    messages = await getImapMessages(
      config,
      folder,
      ids.map((id) => Number(id)).filter((uid) => uid > 0),
      m,
    );
  } else {
    messages = [];
    for (const id of ids) {
      const message = await fetchMessage(identity, folder, Number(id) || 0, id);
      if (message) messages.push(message);
    }
    return messages.sort((a, b) => +new Date(a.date) - +new Date(b.date));
  }

  const scope = recipientScopeForIdentity(identity);
  const visible = messages.filter((message) => {
    if (!scope) return true;
    const sent = folder.toLowerCase().includes("sent");
    return sent
      ? message.from.address.toLowerCase() === identity.email.toLowerCase()
      : messageMatchesScope(message, scope, identity.matchHeader);
  });
  return visible.sort((a, b) => +new Date(a.date) - +new Date(b.date));
}

export async function updateMessageFlags(
  identity: MailIdentity,
  folder: string,
  uid: number,
  flags: { seen?: boolean; flagged?: boolean },
  remoteId?: string,
) {
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
    const messageId = result.messageId || `<mailslip-${Date.now()}@local>`;
    const raw = buildImapAppendRaw(identity, payload, messageId);
    try {
      await appendMessage(config, "Sent", raw, ["\\Seen"]);
    } catch {
      try {
        await appendMessage(config, "INBOX.Sent", raw, ["\\Seen"]);
      } catch {
        /* Sent folder may not exist */
      }
    }
    const copyTo = payload.copyToFolder?.trim();
    if (copyTo && !copyTo.toLowerCase().includes("sent")) {
      try {
        await appendMessage(config, copyTo, raw, ["\\Seen"]);
      } catch {
        /* filed folder may be missing on some servers */
      }
    }
  }

  return result;
}

function buildImapAppendRaw(
  identity: MailIdentity,
  payload: SendPayload,
  messageId: string,
): string {
  const from = identity.displayName
    ? `"${identity.displayName.replace(/"/g, '\\"')}" <${identity.email}>`
    : identity.email;
  const lines = [
    `From: ${from}`,
    `To: ${payload.to.join(", ")}`,
  ];
  if (payload.cc?.length) lines.push(`Cc: ${payload.cc.join(", ")}`);
  lines.push(`Subject: ${payload.subject}`);
  lines.push(`Date: ${new Date().toUTCString()}`);
  lines.push(`Message-ID: ${messageId}`);
  if (payload.inReplyTo) lines.push(`In-Reply-To: ${payload.inReplyTo}`);
  const refs = [...(payload.references || [])];
  if (payload.inReplyTo && !refs.includes(payload.inReplyTo)) refs.unshift(payload.inReplyTo);
  if (refs.length) lines.push(`References: ${refs.join(" ")}`);
  lines.push("MIME-Version: 1.0");
  if (payload.html) {
    lines.push('Content-Type: text/html; charset="utf-8"');
    lines.push("");
    lines.push(payload.html);
  } else {
    lines.push('Content-Type: text/plain; charset="utf-8"');
    lines.push("");
    lines.push(payload.text || "");
  }
  return lines.join("\r\n");
}

export async function searchIdentityMail(identity: MailIdentity, query: string, folder = "INBOX") {
  const backing = await resolveBackingIdentity(identity);
  const config = identityToConfig(backing);
  if (!config) throw new Error("Identity credentials missing");

  if (backing.incomingProtocol === "IMAP") {
    const found = (await searchMessages(config, folder, query, meta(identity))).map((m) => ({
      ...m,
      remoteId: String(m.uid),
    }));
    return applyIdentityScope(identity, folder, found);
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

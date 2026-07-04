import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type {
  ConnectionConfig,
  MailFolder,
  MailMessage,
  MailMessageSummary,
  MailAddress,
} from "./types";

function clientFromConfig(config: ConnectionConfig) {
  return new ImapFlow({
    host: config.imapHost || "",
    port: config.imapPort || 993,
    secure: config.imapTls !== false,
    auth: {
      user: config.username,
      pass: config.password,
    },
    logger: false,
  });
}

function toAddress(input?: { name?: string | null; address?: string | null } | null): MailAddress | null {
  if (!input?.address) return null;
  return { name: input.name || undefined, address: input.address };
}

function toAddressList(
  input?:
    | { value?: { name?: string | null; address?: string | null }[] }
    | { value?: { name?: string | null; address?: string | null }[] }[]
    | null,
): MailAddress[] {
  if (!input) return [];
  const objects = Array.isArray(input) ? input : [input];
  return objects
    .flatMap((obj) => obj.value || [])
    .map((v) => toAddress(v))
    .filter((v): v is MailAddress => Boolean(v));
}

export async function testImapConnection(config: ConnectionConfig) {
  const client = clientFromConfig(config);
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const status = await client.status("INBOX", { messages: true, unseen: true });
      return {
        ok: true as const,
        messages: status.messages ?? 0,
        unseen: status.unseen ?? 0,
      };
    } finally {
      lock.release();
    }
  } finally {
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
  }
}

export async function listFolders(config: ConnectionConfig): Promise<MailFolder[]> {
  const client = clientFromConfig(config);
  await client.connect();
  try {
    const folders: MailFolder[] = [];
    const list = await client.list();
    for (const box of list) {
      folders.push({
        path: box.path,
        name: box.name,
        delimiter: box.delimiter || "/",
        specialUse: box.specialUse || undefined,
      });
    }
    return folders;
  } finally {
    await client.logout();
  }
}

export async function listMessages(
  config: ConnectionConfig,
  folder = "INBOX",
  options: { limit?: number; identityId: string; identityEmail?: string; identityColor?: string } = {
    identityId: "",
  },
): Promise<MailMessageSummary[]> {
  const client = clientFromConfig(config);
  await client.connect();
  try {
    const lock = await client.getMailboxLock(folder);
    try {
      const limit = options.limit ?? 50;
      const exists = (client.mailbox as { exists?: number } | null)?.exists ?? 0;
      if (!exists) return [];
      const start = Math.max(1, exists - limit + 1);
      const messages: MailMessageSummary[] = [];
      for await (const msg of client.fetch(`${start}:*`, {
        uid: true,
        flags: true,
        envelope: true,
        bodyStructure: true,
      })) {
        const from = msg.envelope?.from?.[0];
        const subject = msg.envelope?.subject || "(no subject)";
        messages.push({
          uid: msg.uid,
          id: `${options.identityId}:${folder}:${msg.uid}`,
          identityId: options.identityId,
          identityEmail: options.identityEmail,
          identityColor: options.identityColor,
          folder,
          subject,
          snippet: subject,
          from: {
            name: from?.name || undefined,
            address: from?.address || "unknown",
          },
          to: (msg.envelope?.to || []).map((a) => ({
            name: a.name || undefined,
            address: a.address || "",
          })),
          date: (msg.envelope?.date || new Date()).toISOString(),
          seen: msg.flags?.has("\\Seen") ?? false,
          flagged: msg.flags?.has("\\Flagged") ?? false,
          answered: msg.flags?.has("\\Answered") ?? false,
          hasAttachments: Boolean(
            msg.bodyStructure?.childNodes?.some(
              (n) => n.disposition === "attachment" || n.disposition === "inline",
            ),
          ),
        });
      }
      return messages.reverse();
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

export async function getMessage(
  config: ConnectionConfig,
  folder: string,
  uid: number,
  meta: { identityId: string; identityEmail?: string; identityColor?: string },
): Promise<MailMessage | null> {
  const client = clientFromConfig(config);
  await client.connect();
  try {
    const lock = await client.getMailboxLock(folder);
    try {
      const msg = await client.fetchOne(
        String(uid),
        { uid: true, flags: true, envelope: true, source: true, headers: true },
        { uid: true },
      );
      if (!msg || !msg.source) return null;
      const parsed = await simpleParser(msg.source);
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed.headers || {})) {
        headers[key.toLowerCase()] = Array.isArray(value) ? value.join(", ") : String(value);
      }

      return {
        uid,
        id: `${meta.identityId}:${folder}:${uid}`,
        identityId: meta.identityId,
        identityEmail: meta.identityEmail,
        identityColor: meta.identityColor,
        folder,
        subject: parsed.subject || "(no subject)",
        snippet: (parsed.text || "").slice(0, 140),
        from: toAddress(parsed.from?.value?.[0]) || { address: "unknown" },
        to: toAddressList(parsed.to),
        cc: toAddressList(parsed.cc),
        bcc: toAddressList(parsed.bcc),
        date: (parsed.date || new Date()).toISOString(),
        seen: msg.flags?.has("\\Seen") ?? false,
        flagged: msg.flags?.has("\\Flagged") ?? false,
        answered: msg.flags?.has("\\Answered") ?? false,
        hasAttachments: (parsed.attachments?.length || 0) > 0,
        html: typeof parsed.html === "string" ? parsed.html : undefined,
        text: parsed.text || undefined,
        attachments: (parsed.attachments || []).map((a) => ({
          filename: a.filename || "attachment",
          contentType: a.contentType,
          size: a.size,
        })),
        headers,
        messageId: parsed.messageId,
        inReplyTo: parsed.inReplyTo,
        references: parsed.references
          ? Array.isArray(parsed.references)
            ? parsed.references
            : [parsed.references]
          : undefined,
      };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

export async function setFlags(
  config: ConnectionConfig,
  folder: string,
  uid: number,
  flags: { seen?: boolean; flagged?: boolean },
) {
  const client = clientFromConfig(config);
  await client.connect();
  try {
    const lock = await client.getMailboxLock(folder);
    try {
      if (flags.seen === true) await client.messageFlagsAdd({ uid }, ["\\Seen"], { uid: true });
      if (flags.seen === false) await client.messageFlagsRemove({ uid }, ["\\Seen"], { uid: true });
      if (flags.flagged === true) await client.messageFlagsAdd({ uid }, ["\\Flagged"], { uid: true });
      if (flags.flagged === false)
        await client.messageFlagsRemove({ uid }, ["\\Flagged"], { uid: true });
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

export async function moveMessage(
  config: ConnectionConfig,
  folder: string,
  uid: number,
  destination: string,
) {
  const client = clientFromConfig(config);
  await client.connect();
  try {
    const lock = await client.getMailboxLock(folder);
    try {
      await client.messageMove({ uid }, destination, { uid: true });
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

export async function appendMessage(
  config: ConnectionConfig,
  folder: string,
  raw: string | Buffer,
  flags: string[] = ["\\Seen"],
) {
  const client = clientFromConfig(config);
  await client.connect();
  try {
    await client.append(folder, raw, flags);
  } finally {
    await client.logout();
  }
}

export async function searchMessages(
  config: ConnectionConfig,
  folder: string,
  query: string,
  meta: { identityId: string; identityEmail?: string; identityColor?: string },
): Promise<MailMessageSummary[]> {
  const client = clientFromConfig(config);
  await client.connect();
  try {
    const lock = await client.getMailboxLock(folder);
    try {
      const uids = await client.search({ body: query }, { uid: true });
      if (!uids || uids.length === 0) return [];
      const limited = uids.slice(-50);
      const messages: MailMessageSummary[] = [];
      for await (const msg of client.fetch(limited, { uid: true, flags: true, envelope: true }, { uid: true })) {
        const from = msg.envelope?.from?.[0];
        messages.push({
          uid: msg.uid,
          id: `${meta.identityId}:${folder}:${msg.uid}`,
          identityId: meta.identityId,
          identityEmail: meta.identityEmail,
          identityColor: meta.identityColor,
          folder,
          subject: msg.envelope?.subject || "(no subject)",
          snippet: msg.envelope?.subject || "",
          from: {
            name: from?.name || undefined,
            address: from?.address || "unknown",
          },
          to: (msg.envelope?.to || []).map((a) => ({
            name: a.name || undefined,
            address: a.address || "",
          })),
          date: (msg.envelope?.date || new Date()).toISOString(),
          seen: msg.flags?.has("\\Seen") ?? false,
          flagged: msg.flags?.has("\\Flagged") ?? false,
          answered: msg.flags?.has("\\Answered") ?? false,
          hasAttachments: false,
        });
      }
      return messages.reverse();
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

export async function getQuota(config: ConnectionConfig) {
  const client = clientFromConfig(config);
  await client.connect();
  try {
    // QUOTA is optional; many servers don't advertise it
    const mailbox = await client.status("INBOX", { messages: true });
    return {
      supported: false as const,
      messages: mailbox.messages ?? 0,
      message: "This server doesn't report a quota",
    };
  } finally {
    await client.logout();
  }
}

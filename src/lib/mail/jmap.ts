import type {
  ConnectionConfig,
  MailFolder,
  MailMessage,
  MailMessageSummary,
  SendPayload,
} from "./types";

type JmapSession = {
  apiUrl: string;
  accountId: string;
  downloadUrl?: string;
  uploadUrl?: string;
};

function authHeader(config: ConnectionConfig) {
  const token = Buffer.from(`${config.username}:${config.password}`).toString("base64");
  return `Basic ${token}`;
}

async function getSession(config: ConnectionConfig): Promise<JmapSession> {
  const base = (config.jmapUrl || "").replace(/\/$/, "");
  if (!base) throw new Error("JMAP URL is required");

  const candidates = [`${base}/.well-known/jmap`, base];
  let session: Record<string, unknown> | null = null;
  let lastError: Error | null = null;

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: authHeader(config), Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`JMAP session ${res.status}`);
      session = (await res.json()) as Record<string, unknown>;
      break;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error("JMAP session failed");
    }
  }
  if (!session) throw lastError || new Error("JMAP session failed");

  const apiUrl = String(session.apiUrl || "");
  const accounts = (session.accounts || {}) as Record<string, { name?: string }>;
  const accountId = Object.keys(accounts)[0];
  if (!apiUrl || !accountId) throw new Error("Invalid JMAP session");

  return {
    apiUrl,
    accountId,
    downloadUrl: session.downloadUrl ? String(session.downloadUrl) : undefined,
    uploadUrl: session.uploadUrl ? String(session.uploadUrl) : undefined,
  };
}

async function jmapCall(config: ConnectionConfig, session: JmapSession, methodCalls: unknown[]) {
  const res = await fetch(session.apiUrl, {
    method: "POST",
    headers: {
      Authorization: authHeader(config),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      using: [
        "urn:ietf:params:jmap:core",
        "urn:ietf:params:jmap:mail",
        "urn:ietf:params:jmap:submission",
      ],
      methodCalls,
    }),
  });
  if (!res.ok) throw new Error(`JMAP call failed (${res.status})`);
  const data = (await res.json()) as { methodResponses: [string, Record<string, unknown>, string][] };
  return data.methodResponses;
}

export async function testJmapConnection(config: ConnectionConfig) {
  const session = await getSession(config);
  const responses = await jmapCall(config, session, [
    ["Mailbox/get", { accountId: session.accountId, ids: null }, "0"],
  ]);
  const mailboxes = (responses[0]?.[1]?.list || []) as { role?: string; totalEmails?: number; unreadEmails?: number }[];
  const inbox = mailboxes.find((m) => m.role === "inbox") || mailboxes[0];
  return {
    ok: true as const,
    messages: inbox?.totalEmails ?? 0,
    unseen: inbox?.unreadEmails ?? 0,
  };
}

async function mailboxIdByRole(config: ConnectionConfig, session: JmapSession, role: string) {
  const responses = await jmapCall(config, session, [
    ["Mailbox/get", { accountId: session.accountId, ids: null }, "0"],
  ]);
  const list = (responses[0]?.[1]?.list || []) as { id: string; role?: string; name?: string }[];
  const wanted = role === "INBOX" ? "inbox" : role.toLowerCase();
  const match =
    list.find((m) => m.role === wanted) ||
    list.find((m) => (m.name || "").toLowerCase() === wanted) ||
    list[0];
  return match?.id;
}

export async function listJmapFolders(config: ConnectionConfig): Promise<MailFolder[]> {
  const session = await getSession(config);
  const responses = await jmapCall(config, session, [
    ["Mailbox/get", { accountId: session.accountId, ids: null }, "0"],
  ]);
  const list = (responses[0]?.[1]?.list || []) as {
    id: string;
    name?: string;
    role?: string;
    totalEmails?: number;
    unreadEmails?: number;
  }[];
  return list.map((m) => ({
    path: m.role === "inbox" ? "INBOX" : m.name || m.id,
    name: m.name || m.id,
    delimiter: "/",
    specialUse: m.role ? `\\${m.role[0].toUpperCase()}${m.role.slice(1)}` : undefined,
    total: m.totalEmails,
    unseen: m.unreadEmails,
  }));
}

export async function listJmapMessages(
  config: ConnectionConfig,
  folder: string,
  meta: { identityId: string; identityEmail?: string; identityColor?: string },
): Promise<MailMessageSummary[]> {
  const session = await getSession(config);
  const mailboxId = await mailboxIdByRole(config, session, folder);
  if (!mailboxId) return [];

  const responses = await jmapCall(config, session, [
    [
      "Email/query",
      {
        accountId: session.accountId,
        filter: { inMailbox: mailboxId },
        sort: [{ property: "receivedAt", isAscending: false }],
        limit: 200,
      },
      "0",
    ],
    [
      "Email/get",
      {
        accountId: session.accountId,
        "#ids": { resultOf: "0", name: "Email/query", path: "/ids" },
        properties: [
          "id",
          "threadId",
          "subject",
          "from",
          "to",
          "cc",
          "receivedAt",
          "preview",
          "hasAttachment",
          "keywords",
          "threadId",
          "messageId",
          "inReplyTo",
        ],
      },
      "1",
    ],
  ]);

  const list = (responses[1]?.[1]?.list || []) as Record<string, unknown>[];
  return list.map((email, index) => {
    const from = ((email.from as { name?: string; email?: string }[]) || [])[0];
    const keywords = (email.keywords || {}) as Record<string, boolean>;
    return {
      uid: index + 1,
      remoteId: String(email.id),
      id: `${meta.identityId}:${folder}:${email.id}`,
      identityId: meta.identityId,
      identityEmail: meta.identityEmail,
      identityColor: meta.identityColor,
      folder,
      subject: String(email.subject || "(no subject)"),
      snippet: String(email.preview || ""),
      from: { name: from?.name, address: from?.email || "unknown" },
      to: ((email.to as { name?: string; email?: string }[]) || []).map((t) => ({
        name: t.name,
        address: t.email || "",
      })),
      cc: ((email.cc as { name?: string; email?: string }[]) || []).map((t) => ({
        name: t.name,
        address: t.email || "",
      })),
      date: String(email.receivedAt || new Date().toISOString()),
      seen: Boolean(keywords.$seen),
      flagged: Boolean(keywords.$flagged),
      answered: Boolean(keywords.$answered),
      hasAttachments: Boolean(email.hasAttachment),
      threadId: email.threadId ? String(email.threadId) : undefined,
      messageId: Array.isArray(email.messageId)
        ? String(email.messageId[0] || "") || undefined
        : undefined,
      inReplyTo: Array.isArray(email.inReplyTo)
        ? String(email.inReplyTo[0] || "") || undefined
        : undefined,
    };
  });
}

export async function getJmapMessage(
  config: ConnectionConfig,
  jmapId: string,
  folder: string,
  meta: { identityId: string; identityEmail?: string; identityColor?: string },
): Promise<MailMessage | null> {
  const session = await getSession(config);
  const responses = await jmapCall(config, session, [
    [
      "Email/get",
      {
        accountId: session.accountId,
        ids: [jmapId],
        properties: [
          "id",
          "subject",
          "from",
          "to",
          "cc",
          "bcc",
          "receivedAt",
          "preview",
          "hasAttachment",
          "keywords",
          "bodyValues",
          "textBody",
          "htmlBody",
          "attachments",
          "headers",
          "messageId",
          "inReplyTo",
          "references",
        ],
        fetchAllBodyValues: true,
      },
      "0",
    ],
  ]);
  const email = ((responses[0]?.[1]?.list || []) as Record<string, unknown>[])[0];
  if (!email) return null;

  const from = ((email.from as { name?: string; email?: string }[]) || [])[0];
  const bodyValues = (email.bodyValues || {}) as Record<string, { value?: string }>;
  const htmlPart = ((email.htmlBody as { partId?: string }[]) || [])[0];
  const textPart = ((email.textBody as { partId?: string }[]) || [])[0];
  const keywords = (email.keywords || {}) as Record<string, boolean>;
  const headers: Record<string, string> = {};
  for (const h of (email.headers as { name?: string; value?: string }[]) || []) {
    if (h.name) headers[h.name.toLowerCase()] = h.value || "";
  }

  return {
    uid: 0,
    remoteId: String(email.id),
    id: `${meta.identityId}:${folder}:${email.id}`,
    identityId: meta.identityId,
    identityEmail: meta.identityEmail,
    identityColor: meta.identityColor,
    folder,
    subject: String(email.subject || "(no subject)"),
    snippet: String(email.preview || ""),
    from: { name: from?.name, address: from?.email || "unknown" },
    to: ((email.to as { name?: string; email?: string }[]) || []).map((t) => ({
      name: t.name,
      address: t.email || "",
    })),
    cc: ((email.cc as { name?: string; email?: string }[]) || []).map((t) => ({
      name: t.name,
      address: t.email || "",
    })),
    bcc: ((email.bcc as { name?: string; email?: string }[]) || []).map((t) => ({
      name: t.name,
      address: t.email || "",
    })),
    date: String(email.receivedAt || new Date().toISOString()),
    seen: Boolean(keywords.$seen),
    flagged: Boolean(keywords.$flagged),
    answered: Boolean(keywords.$answered),
    hasAttachments: Boolean(email.hasAttachment),
    html: htmlPart?.partId ? bodyValues[htmlPart.partId]?.value : undefined,
    text: textPart?.partId ? bodyValues[textPart.partId]?.value : undefined,
    attachments: ((email.attachments as { name?: string; type?: string; size?: number }[]) || []).map(
      (a) => ({
        filename: a.name || "attachment",
        contentType: a.type || "application/octet-stream",
        size: a.size || 0,
      }),
    ),
    headers,
    messageId: Array.isArray(email.messageId) ? String(email.messageId[0]) : String(email.messageId || ""),
  };
}

export async function sendJmapMail(config: ConnectionConfig, payload: SendPayload) {
  const session = await getSession(config);
  const from = payload.from || config.email;
  const body = payload.html || payload.text || "";
  const responses = await jmapCall(config, session, [
    [
      "Email/set",
      {
        accountId: session.accountId,
        create: {
          draft: {
            from: [{ email: from, name: payload.fromName }],
            to: payload.to.map((email) => ({ email })),
            cc: (payload.cc || []).map((email) => ({ email })),
            bcc: (payload.bcc || []).map((email) => ({ email })),
            subject: payload.subject,
            keywords: { $draft: true },
            bodyValues: {
              body: { value: body, charset: "utf-8" },
            },
            textBody: payload.html ? undefined : [{ partId: "body", type: "text/plain" }],
            htmlBody: payload.html ? [{ partId: "body", type: "text/html" }] : undefined,
          },
        },
      },
      "0",
    ],
    [
      "EmailSubmission/set",
      {
        accountId: session.accountId,
        create: {
          send1: {
            emailId: "#draft",
          },
        },
      },
      "1",
    ],
  ]);

  const created = (responses[0]?.[1]?.created || {}) as Record<string, { id?: string }>;
  return {
    messageId: created.draft?.id || `<jmap-${Date.now()}@mailslip.local>`,
    accepted: payload.to,
  };
}

export async function setJmapKeywords(
  config: ConnectionConfig,
  jmapId: string,
  flags: { seen?: boolean; flagged?: boolean },
) {
  const session = await getSession(config);
  const update: Record<string, unknown> = { keywords: {} };
  const keywords: Record<string, boolean | null> = {};
  if (flags.seen === true) keywords.$seen = true;
  if (flags.seen === false) keywords.$seen = null;
  if (flags.flagged === true) keywords.$flagged = true;
  if (flags.flagged === false) keywords.$flagged = null;
  update.keywords = keywords;
  await jmapCall(config, session, [
    [
      "Email/set",
      {
        accountId: session.accountId,
        update: { [jmapId]: update },
      },
      "0",
    ],
  ]);
}

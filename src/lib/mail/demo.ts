import type { MailFolder, MailMessage, MailMessageSummary } from "./types";

const now = Date.now();

const demoMessages: MailMessage[] = [
  {
    uid: 101,
    id: "demo-101",
    identityId: "demo",
    identityEmail: "ada@aurelia.studio",
    identityColor: "#BE7C5E",
    folder: "INBOX",
    subject: "Re: Q3 brand refresh",
    snippet: "Love the direction on the terracotta palette — it feels calm without going cold.",
    from: { name: "Folake Bello", address: "folake@studio.co" },
    to: [{ name: "Ada Lovelace", address: "ada@aurelia.studio" }],
    cc: [],
    bcc: [],
    date: new Date(now - 1000 * 60 * 18).toISOString(),
    seen: false,
    flagged: true,
    answered: false,
    hasAttachments: false,
    html: `<p>Love the direction on the terracotta palette — it feels calm without going cold.</p><p>Can we lock the type scale this week? Happy to review a draft.</p><p>— Folake</p>`,
    text: "Love the direction on the terracotta palette — it feels calm without going cold.",
    attachments: [],
    headers: { "delivered-to": "ada@aurelia.studio" },
  },
  {
    uid: 102,
    id: "demo-102",
    identityId: "demo",
    identityEmail: "ada@aurelia.studio",
    identityColor: "#BE7C5E",
    folder: "INBOX",
    subject: "Coffee Thursday?",
    snippet: "Are you free after 3? There's a new place on Admiralty that does oat cortados properly.",
    from: { name: "Tunde Adeyemi", address: "tunde@example.com" },
    to: [{ address: "ada@aurelia.studio" }],
    cc: [],
    bcc: [],
    date: new Date(now - 1000 * 60 * 60 * 3).toISOString(),
    seen: true,
    flagged: false,
    answered: false,
    hasAttachments: false,
    html: `<p>Are you free after 3? There's a new place on Admiralty that does oat cortados properly.</p>`,
    text: "Are you free after 3?",
    attachments: [],
    headers: { "delivered-to": "ada@aurelia.studio" },
  },
  {
    uid: 103,
    id: "demo-103",
    identityId: "demo",
    identityEmail: "hello@aurelia.studio",
    identityColor: "#6E8B6A",
    folder: "INBOX",
    subject: "Your onboarding docs",
    snippet: "Everything for your first week is attached. Shout if anything's unclear.",
    from: { name: "People Ops", address: "people@aurelia.studio" },
    to: [{ address: "hello@aurelia.studio" }],
    cc: [],
    bcc: [],
    date: new Date(now - 1000 * 60 * 60 * 26).toISOString(),
    seen: true,
    flagged: false,
    answered: true,
    hasAttachments: true,
    html: `<p>Everything for your first week is attached. Shout if anything's unclear.</p>`,
    text: "Everything for your first week is attached.",
    attachments: [
      { filename: "onboarding.pdf", contentType: "application/pdf", size: 240_000 },
    ],
    headers: { "delivered-to": "hello@aurelia.studio" },
  },
  {
    uid: 104,
    id: "demo-104",
    identityId: "demo",
    identityEmail: "support@aurelia.studio",
    identityColor: "#C25E54",
    folder: "INBOX",
    subject: "Invoice #4821 paid",
    snippet: "Thanks — payment cleared. Receipt attached for your records.",
    from: { name: "Billing", address: "billing@vendor.io" },
    to: [{ address: "support@aurelia.studio" }],
    cc: [],
    bcc: [],
    date: new Date(now - 1000 * 60 * 60 * 50).toISOString(),
    seen: false,
    flagged: false,
    answered: false,
    hasAttachments: true,
    html: `<p>Thanks — payment cleared. Receipt attached for your records.</p>`,
    text: "Thanks — payment cleared.",
    attachments: [
      { filename: "receipt-4821.pdf", contentType: "application/pdf", size: 88_000 },
    ],
    headers: { "delivered-to": "support@aurelia.studio", "x-original-to": "support@aurelia.studio" },
  },
];

export const demoFolders: MailFolder[] = [
  { path: "INBOX", name: "Inbox", delimiter: "/", specialUse: "\\Inbox", unseen: 2, total: 4 },
  { path: "Sent", name: "Sent", delimiter: "/", specialUse: "\\Sent", unseen: 0, total: 1 },
  { path: "Drafts", name: "Drafts", delimiter: "/", specialUse: "\\Drafts", unseen: 0, total: 0 },
  { path: "Archive", name: "Archive", delimiter: "/", specialUse: "\\Archive", unseen: 0, total: 0 },
  { path: "Trash", name: "Trash", delimiter: "/", specialUse: "\\Trash", unseen: 0, total: 0 },
  { path: "Junk", name: "Spam", delimiter: "/", specialUse: "\\Junk", unseen: 0, total: 0 },
];

export function listDemoMessages(folder = "INBOX"): MailMessageSummary[] {
  return demoMessages
    .filter((m) => m.folder === folder)
    .map(({ html: _h, text: _t, attachments: _a, headers: _hdr, cc: _c, bcc: _b, ...summary }) => summary);
}

export function getDemoMessage(uid: number): MailMessage | null {
  return demoMessages.find((m) => m.uid === uid) ?? null;
}

export function searchDemoMessages(query: string): MailMessageSummary[] {
  const q = query.toLowerCase();
  return demoMessages
    .filter(
      (m) =>
        m.subject.toLowerCase().includes(q) ||
        m.snippet.toLowerCase().includes(q) ||
        m.from.name?.toLowerCase().includes(q) ||
        m.from.address.toLowerCase().includes(q),
    )
    .map(({ html: _h, text: _t, attachments: _a, headers: _hdr, cc: _c, bcc: _b, ...summary }) => summary);
}

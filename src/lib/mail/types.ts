export type MailAddress = {
  name?: string;
  address: string;
};

export type MailAttachmentMeta = {
  filename: string;
  contentType: string;
  size: number;
  partId?: string;
};

export type MailMessageSummary = {
  uid: number;
  /** Protocol-native id (IMAP/POP3 uid or JMAP email id) */
  remoteId: string;
  id: string;
  identityId: string;
  identityEmail?: string;
  identityColor?: string;
  folder: string;
  subject: string;
  snippet: string;
  from: MailAddress;
  to: MailAddress[];
  cc?: MailAddress[];
  /** Envelope routing headers used to separate aliases that share one login. */
  headers?: Record<string, string>;
  date: string;
  seen: boolean;
  flagged: boolean;
  answered: boolean;
  hasAttachments: boolean;
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
  /** Server thread id, when the protocol provides one (JMAP). */
  threadId?: string;
};

export type MailMessage = MailMessageSummary & {
  cc: MailAddress[];
  bcc: MailAddress[];
  html?: string;
  text?: string;
  attachments: MailAttachmentMeta[];
  headers?: Record<string, string>;
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
};

export type MailFolder = {
  path: string;
  name: string;
  delimiter: string;
  parentPath?: string;
  specialUse?: string;
  selectable?: boolean;
  unseen?: number;
  total?: number;
};

export type ConnectionConfig = {
  email: string;
  username: string;
  password: string;
  incomingProtocol: "IMAP" | "POP3" | "JMAP";
  imapHost?: string | null;
  imapPort?: number | null;
  imapTls?: boolean | null;
  pop3Host?: string | null;
  pop3Port?: number | null;
  pop3Tls?: boolean | null;
  jmapUrl?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpTls?: boolean | null;
};

export type SendPayload = {
  from?: string;
  fromName?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html?: string;
  text?: string;
  inReplyTo?: string;
  references?: string[];
  /** After send, also append a copy to this IMAP folder (e.g. reply from a filed thread). */
  copyToFolder?: string;
};

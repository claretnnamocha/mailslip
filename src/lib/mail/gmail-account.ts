const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);
const GMAIL_HOSTS = new Set(["imap.gmail.com", "smtp.gmail.com", "pop.gmail.com"]);

export function isGmailAddress(email: string) {
  const domain = email.trim().toLowerCase().split("@").pop() || "";
  return GMAIL_DOMAINS.has(domain);
}

export function isGmailHost(host?: string | null) {
  if (!host) return false;
  return GMAIL_HOSTS.has(host.trim().toLowerCase());
}

/** Consumer Gmail, or any mailbox pointed at Google's IMAP/SMTP hosts. */
export function isGmailConnection(input: {
  email?: string | null;
  imapHost?: string | null;
  smtpHost?: string | null;
  pop3Host?: string | null;
}) {
  return (
    isGmailAddress(input.email || "") ||
    isGmailHost(input.imapHost) ||
    isGmailHost(input.smtpHost) ||
    isGmailHost(input.pop3Host)
  );
}

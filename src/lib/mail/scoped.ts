import type { MailAddress, MailMessage, MailMessageSummary } from "./types";

/**
 * Server-side enforcement for scoped (alias) identities.
 * Match envelope recipient headers first (Delivered-To / X-Original-To),
 * then fall back to To/Cc so BCC and catch-all mail still resolve.
 */
export function messageMatchesScope(
  message: Pick<MailMessage, "to" | "cc" | "headers">,
  recipientFilter: string,
  matchHeader = "Delivered-To",
): boolean {
  const filter = recipientFilter.toLowerCase();
  const headers = message.headers || {};
  const envelopeKeys = [
    matchHeader.toLowerCase(),
    "delivered-to",
    "x-original-to",
    "envelope-to",
    "x-envelope-to",
  ];

  for (const key of envelopeKeys) {
    const value = headers[key];
    if (value && value.toLowerCase().includes(filter)) return true;
  }

  const recipients = [...(message.to || []), ...(message.cc || [])];
  return recipients.some((r) => r.address.toLowerCase() === filter);
}

/** Login name plus the identity's domain, so "hello" and supply@uselinqr.io become hello@uselinqr.io. */
export function mailboxAddress(username: string | null | undefined, email: string) {
  const user = (username || "").trim().toLowerCase();
  const addr = email.trim().toLowerCase();
  if (!user) return addr;
  if (user.includes("@")) return user;
  const domain = addr.split("@")[1];
  return domain ? `${user}@${domain}` : user;
}

/**
 * When the visible address is not the mailbox login, only that address's mail
 * should appear. A shared login like "hello" must not show hello@ mail inside supply@.
 */
export function recipientScopeForIdentity(identity: {
  type: string;
  email: string;
  username?: string | null;
  recipientFilter?: string | null;
}): string | null {
  const email = identity.email.trim().toLowerCase();
  if (identity.type === "SCOPED_ALIAS") {
    return (identity.recipientFilter || email).trim().toLowerCase();
  }
  const login = mailboxAddress(identity.username, email);
  if (login !== email) return email;
  return null;
}

export function summaryMatchesRecipient(
  message: Pick<MailMessageSummary, "to"> & { cc?: MailAddress[]; headers?: Record<string, string> },
  recipientFilter: string,
  matchHeader = "Delivered-To",
) {
  return messageMatchesScope(
    {
      to: message.to,
      cc: message.cc || [],
      headers: message.headers,
    },
    recipientFilter,
    matchHeader,
  );
}

export function filterScopedSummaries<T extends MailMessageSummary>(
  messages: T[],
  recipientFilter: string | null | undefined,
): T[] {
  if (!recipientFilter) return messages;
  // Summaries may not include headers; filter by identityEmail tag when present,
  // otherwise keep and rely on full-message fetch for enforcement.
  return messages.filter((m) => {
    if (m.identityEmail) return m.identityEmail.toLowerCase() === recipientFilter.toLowerCase();
    return true;
  });
}

export function filterScopedSent<T extends MailMessageSummary>(
  messages: T[],
  fromAddress: string,
): T[] {
  const from = fromAddress.toLowerCase();
  return messages.filter((m) => m.from.address.toLowerCase() === from);
}

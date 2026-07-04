import type { MailMessage, MailMessageSummary } from "./types";

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

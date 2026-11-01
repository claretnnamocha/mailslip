import type { MailFolder, MailMessage, MailMessageSummary } from "./types";

const API_BASE = "/api/mail";

export async function listMessages(
  identityId: string | "all",
  folder: string,
  searchQuery?: string
): Promise<MailMessageSummary[]> {
  const params = new URLSearchParams({
    identityId,
    folder,
    ...(searchQuery ? { q: searchQuery } : {}),
  });
  const response = await fetch(`${API_BASE}/messages?${params.toString()}`);
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch messages: ${error}`);
  }
  return response.json();
}

export async function getMessage(
  identityId: string | "all",
  messageId: string
): Promise<MailMessage> {
  const params = new URLSearchParams({ identityId });
  const response = await fetch(
    `${API_BASE}/messages/${encodeURIComponent(messageId)}?${params.toString()}`
  );
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch message: ${error}`);
  }
  return response.json();
}

export async function listFolders(
  identityId: string | "all"
): Promise<MailFolder[]> {
  const params = new URLSearchParams({ identityId });
  const response = await fetch(`${API_BASE}/folders?${params.toString()}`);
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch folders: ${error}`);
  }
  return response.json();
}

import type { MailFolder, MailMessage, MailMessageSummary } from "./mail/types";

export type { MailFolder, MailMessage, MailMessageSummary };

export interface ListMessagesParams {
  identityId?: string | "all";
  folder?: string;
}

// Mock provider for development. Replace with real API call.
export async function listMessages(params: ListMessagesParams = {}): Promise<MailMessageSummary[]> {
  const { identityId = "all", folder = "INBOX" } = params;

  // Simulate network delay and potential failure for testing.
  await new Promise((resolve) => setTimeout(resolve, 500));

  if (Math.random() < 0.05) {
    throw new Error("Failed to connect to mail provider.");
  }

  // Mock messages.
  const baseMessages: MailMessageSummary[] = [
    {
      id: "msg-001",
      subject: "Welcome to Mailslip",
      from: { name: "System", email: "system@mailslip.app" },
      to: [{ name: "You", email: "you@example.com" }],
      date: new Date().toISOString(),
      snippet: "Get started with your new inbox.",
      unread: true,
    },
    {
      id: "msg-002",
      subject: "Project update",
      from: { name: "Alex", email: "alex@example.com" },
      to: [{ name: "You", email: "you@example.com" }],
      date: new Date(Date.now() - 3600 * 1000).toISOString(),
      snippet: "Here is the latest on the project...",
      unread: false,
    },
    {
      id: "msg-003",
      subject: "Meeting tomorrow",
      from: { name: "Sarah", email: "sarah@example.com" },
      to: [{ name: "You", email: "you@example.com" }],
      date: new Date(Date.now() - 7200 * 1000).toISOString(),
      snippet: "Reminder: we have a sync at 10am.",
      unread: false,
    },
  ];

  // Filter by folder/identity if needed (mock: always return all for simplicity).
  return baseMessages;
}

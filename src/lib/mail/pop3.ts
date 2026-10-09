import net from "net";
import tls from "tls";
import { simpleParser } from "mailparser";
import type { ConnectionConfig, MailFolder, MailMessage, MailMessageSummary } from "./types";

class Pop3Client {
  private socket: net.Socket | null = null;
  private buffer = "";

  constructor(private config: ConnectionConfig) {}

  async connect() {
    const host = this.config.pop3Host || this.config.imapHost || "";
    const port = this.config.pop3Port || 995;
    const useTls = this.config.pop3Tls !== false;

    await new Promise<void>((resolve, reject) => {
      const onConnect = () => resolve();
      if (useTls) {
        this.socket = tls.connect({ host, port, servername: host }, onConnect);
      } else {
        this.socket = net.connect({ host, port }, onConnect);
      }
      this.socket.setEncoding("utf8");
      this.socket.on("error", reject);
      this.socket.on("data", (chunk: string) => {
        this.buffer += chunk;
      });
    });

    await this.readLine(); // greeting
    await this.command(`USER ${this.config.username}`);
    await this.command(`PASS ${this.config.password}`);
  }

  private readLine(timeoutMs = 15000): Promise<string> {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        const idx = this.buffer.indexOf("\r\n");
        if (idx >= 0) {
          const line = this.buffer.slice(0, idx);
          this.buffer = this.buffer.slice(idx + 2);
          resolve(line);
          return;
        }
        if (Date.now() - start > timeoutMs) {
          reject(new Error("POP3 timeout"));
          return;
        }
        setTimeout(tick, 10);
      };
      tick();
    });
  }

  private async readMultiline(): Promise<string> {
    let data = "";
    while (true) {
      const line = await this.readLine();
      if (line === ".") break;
      data += (line.startsWith("..") ? line.slice(1) : line) + "\r\n";
    }
    return data;
  }

  private async command(cmd: string, multiline = false) {
    if (!this.socket) throw new Error("Not connected");
    this.socket.write(cmd + "\r\n");
    const line = await this.readLine();
    if (!line.startsWith("+OK")) throw new Error(line || "POP3 error");
    if (multiline) return { line, body: await this.readMultiline() };
    return { line, body: "" };
  }

  async stat() {
    const { line } = await this.command("STAT");
    const parts = line.split(" ");
    return { messages: Number(parts[1]) || 0, octets: Number(parts[2]) || 0 };
  }

  async list() {
    const { body } = await this.command("LIST", true);
    return body
      .trim()
      .split("\r\n")
      .filter(Boolean)
      .map((row) => {
        const [num, size] = row.split(" ");
        return { id: Number(num), size: Number(size) || 0 };
      });
  }

  async retr(id: number) {
    const { body } = await this.command(`RETR ${id}`, true);
    return body;
  }

  async dele(id: number) {
    await this.command(`DELE ${id}`);
  }

  async quit() {
    try {
      await this.command("QUIT");
    } catch {
      /* ignore */
    }
    this.socket?.destroy();
    this.socket = null;
  }
}

export async function testPop3Connection(config: ConnectionConfig) {
  const client = new Pop3Client(config);
  await client.connect();
  try {
    const stat = await client.stat();
    return { ok: true as const, messages: stat.messages, unseen: stat.messages };
  } finally {
    await client.quit();
  }
}

export async function listPop3Folders(): Promise<MailFolder[]> {
  return [
    { path: "INBOX", name: "Inbox", delimiter: "/", specialUse: "\\Inbox" },
  ];
}

export async function listPop3Messages(
  config: ConnectionConfig,
  meta: { identityId: string; identityEmail?: string; identityColor?: string },
): Promise<MailMessageSummary[]> {
  const client = new Pop3Client(config);
  await client.connect();
  try {
    const list = await client.list();
    const recent = list.slice(-50).reverse();
    const messages: MailMessageSummary[] = [];
    for (const item of recent) {
      const raw = await client.retr(item.id);
      const parsed = await simpleParser(raw);
      const from = parsed.from?.value?.[0];
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed.headers || {})) {
        headers[key.toLowerCase()] = Array.isArray(value) ? value.join(", ") : String(value);
      }
      messages.push({
        uid: item.id,
        remoteId: String(item.id),
        id: `${meta.identityId}:INBOX:${item.id}`,
        identityId: meta.identityId,
        identityEmail: meta.identityEmail,
        identityColor: meta.identityColor,
        folder: "INBOX",
        subject: parsed.subject || "(no subject)",
        snippet: (parsed.text || "").slice(0, 140),
        from: { name: from?.name || undefined, address: from?.address || "unknown" },
        to: (parsed.to && "value" in parsed.to ? parsed.to.value : []).map((a) => ({
          name: a.name || undefined,
          address: a.address || "",
        })),
        cc: (parsed.cc && "value" in parsed.cc ? parsed.cc.value : []).map((a) => ({
          name: a.name || undefined,
          address: a.address || "",
        })),
        headers,
        messageId: parsed.messageId,
        inReplyTo: parsed.inReplyTo,
        references: parsed.references
          ? Array.isArray(parsed.references)
            ? parsed.references
            : [parsed.references]
          : undefined,
        date: (parsed.date || new Date()).toISOString(),
        seen: true,
        flagged: false,
        answered: false,
        hasAttachments: (parsed.attachments?.length || 0) > 0,
      });
    }
    return messages;
  } finally {
    await client.quit();
  }
}

export async function getPop3Message(
  config: ConnectionConfig,
  uid: number,
  meta: { identityId: string; identityEmail?: string; identityColor?: string },
): Promise<MailMessage | null> {
  const client = new Pop3Client(config);
  await client.connect();
  try {
    const raw = await client.retr(uid);
    const parsed = await simpleParser(raw);
    const from = parsed.from?.value?.[0];
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed.headers || {})) {
      headers[key.toLowerCase()] = Array.isArray(value) ? value.join(", ") : String(value);
    }
    return {
      uid,
      remoteId: String(uid),
      id: `${meta.identityId}:INBOX:${uid}`,
      identityId: meta.identityId,
      identityEmail: meta.identityEmail,
      identityColor: meta.identityColor,
      folder: "INBOX",
      subject: parsed.subject || "(no subject)",
      snippet: (parsed.text || "").slice(0, 140),
      from: { name: from?.name || undefined, address: from?.address || "unknown" },
      to: (parsed.to && "value" in parsed.to ? parsed.to.value : []).map((a) => ({
        name: a.name || undefined,
        address: a.address || "",
      })),
      cc: (parsed.cc && "value" in parsed.cc ? parsed.cc.value : []).map((a) => ({
        name: a.name || undefined,
        address: a.address || "",
      })),
      bcc: [],
      date: (parsed.date || new Date()).toISOString(),
      seen: true,
      flagged: false,
      answered: false,
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
    };
  } finally {
    await client.quit();
  }
}

export async function deletePop3Message(config: ConnectionConfig, uid: number) {
  const client = new Pop3Client(config);
  await client.connect();
  try {
    await client.dele(uid);
  } finally {
    await client.quit();
  }
}

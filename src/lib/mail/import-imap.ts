import { ImapFlow } from "imapflow";

export async function importImapToImap(params: {
  source: {
    host: string;
    port: number;
    user: string;
    password: string;
    tls?: boolean;
  };
  dest: {
    host: string;
    port: number;
    user: string;
    password: string;
    tls?: boolean;
  };
  folder?: string;
  limit?: number;
}) {
  const folder = params.folder || "INBOX";
  const limit = params.limit ?? 100;

  const source = new ImapFlow({
    host: params.source.host,
    port: params.source.port,
    secure: params.source.tls !== false,
    auth: { user: params.source.user, pass: params.source.password },
    logger: false,
  });
  const dest = new ImapFlow({
    host: params.dest.host,
    port: params.dest.port,
    secure: params.dest.tls !== false,
    auth: { user: params.dest.user, pass: params.dest.password },
    logger: false,
  });

  await source.connect();
  await dest.connect();
  let copied = 0;
  try {
    const lock = await source.getMailboxLock(folder);
    try {
      const exists = (source.mailbox as { exists?: number } | null)?.exists ?? 0;
      if (!exists) return { copied: 0 };
      const start = Math.max(1, exists - limit + 1);
      for await (const msg of source.fetch(`${start}:*`, { source: true, uid: true })) {
        if (!msg.source) continue;
        await dest.append(folder, msg.source, ["\\Seen"]);
        copied += 1;
      }
    } finally {
      lock.release();
    }
  } finally {
    await source.logout();
    await dest.logout();
  }
  return { copied };
}

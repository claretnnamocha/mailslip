export type Threadable = {
  id: string;
  date: string;
  subject: string;
  seen: boolean;
  from: { address: string };
  to?: { address: string }[];
  cc?: { address: string }[];
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
  threadId?: string;
};

export type MailThread<T> = {
  id: string;
  messages: T[];
  latest: T;
};

export function normalizeMessageId(value?: string | null) {
  if (!value) return undefined;
  const trimmed = value.trim().replace(/^<|>$/g, "").trim().toLowerCase();
  return trimmed || undefined;
}

export function displaySubject(subject: string) {
  let next = subject.trim();
  let previous = "";
  while (next && next !== previous) {
    previous = next;
    next = next.replace(/^(re|fw|fwd|aw)\s*:\s*/i, "").trim();
  }
  return next || subject || "(no subject)";
}

function normalizeSubject(subject: string) {
  return displaySubject(subject).toLowerCase();
}

function addresses(item: Threadable) {
  return [item.from.address, ...(item.to || []).map((a) => a.address), ...(item.cc || []).map((a) => a.address)]
    .map((address) => address.toLowerCase())
    .filter(Boolean);
}

function sameConversation(a: Threadable, b: Threadable) {
  const subject = normalizeSubject(a.subject);
  if (!subject || subject === "(no subject)" || subject !== normalizeSubject(b.subject)) return false;
  const people = new Set(addresses(a));
  return addresses(b).some((address) => people.has(address));
}

export function groupThreads<T extends Threadable>(items: T[]): MailThread<T>[] {
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) && parent.get(root) !== root) root = parent.get(root)!;
    let cursor = id;
    while (cursor !== root) {
      const next = parent.get(cursor) || root;
      parent.set(cursor, root);
      cursor = next;
    }
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  const groups = new Map<string, T[]>();
  const loose: T[] = [];

  for (const item of items) {
    if (item.threadId) {
      const key = `server:${item.threadId}`;
      const list = groups.get(key) || [];
      list.push(item);
      groups.set(key, list);
      continue;
    }

    const ids = [item.messageId, item.inReplyTo, ...(item.references || [])]
      .map(normalizeMessageId)
      .filter((id): id is string => Boolean(id));
    if (ids.length === 0) {
      loose.push(item);
      continue;
    }
    for (const id of ids) parent.set(id, parent.get(id) || id);
    for (let i = 1; i < ids.length; i += 1) union(ids[0], ids[i]);
    const key = `id:${find(ids[0])}`;
    const list = groups.get(key) || [];
    list.push(item);
    groups.set(key, list);
  }

  for (const item of loose) {
    let key: string | null = null;
    for (const [candidate, list] of groups) {
      if (list.some((other) => sameConversation(item, other))) {
        key = candidate;
        break;
      }
    }
    const finalKey = key || `solo:${item.id}`;
    const list = groups.get(finalKey) || [];
    list.push(item);
    groups.set(finalKey, list);
  }

  const threads: MailThread<T>[] = [];
  for (const [id, list] of groups) {
    const messages = [...list].sort((a, b) => +new Date(a.date) - +new Date(b.date));
    threads.push({ id, messages, latest: messages[messages.length - 1] });
  }
  return threads.sort((a, b) => +new Date(b.latest.date) - +new Date(a.latest.date));
}

export function threadContaining<T extends Threadable>(items: T[], id: string | null) {
  if (!id) return null;
  return groupThreads(items).find((thread) => thread.messages.some((message) => message.id === id)) || null;
}

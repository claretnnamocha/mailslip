export type Threadable = {
  id: string;
  date: string;
  subject: string;
  seen: boolean;
  from: { name?: string; address: string };
  to?: { name?: string; address: string }[];
  cc?: { name?: string; address: string }[];
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

/** Split same-subject conversations only when there is a long quiet gap and no header link. */
const SUBJECT_GAP_MS = 45 * 24 * 60 * 60 * 1000;

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
  return displaySubject(subject).toLowerCase().replace(/\s+/g, " ");
}

function personLabel(person: { name?: string; address: string }) {
  const name = person.name?.trim();
  if (name) return name.split(/\s+/)[0];
  const local = person.address.split("@")[0]?.trim();
  return local || person.address;
}

export function threadParticipants<T extends Threadable>(messages: T[], limit = 4) {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const message of messages) {
    for (const person of [message.from, ...(message.to || []), ...(message.cc || [])]) {
      if (!person?.address) continue;
      const key = person.address.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      labels.push(personLabel(person));
    }
  }
  if (labels.length === 0) return "Conversation";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]}, ${labels[1]}`;
  if (labels.length <= limit) {
    return `${labels.slice(0, -1).join(", ")} & ${labels[labels.length - 1]}`;
  }
  return `${labels.slice(0, limit - 1).join(", ")} & ${labels.length - (limit - 1)}`;
}

function linkedIds(item: Threadable) {
  return [item.messageId, item.inReplyTo, ...(item.references || [])]
    .map(normalizeMessageId)
    .filter((id): id is string => Boolean(id));
}

function messagesLinked(a: Threadable, b: Threadable) {
  const left = new Set(linkedIds(a));
  if (left.size === 0) return false;
  return linkedIds(b).some((id) => left.has(id));
}

function createUnion() {
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
  return { parent, find, union };
}

function splitByGap<T extends Threadable>(messages: T[]): T[][] {
  if (messages.length <= 1) return [messages];
  const ordered = [...messages].sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const buckets: T[][] = [[ordered[0]]];

  for (let i = 1; i < ordered.length; i += 1) {
    const previous = ordered[i - 1];
    const current = ordered[i];
    const gap = +new Date(current.date) - +new Date(previous.date);
    const linked = buckets[buckets.length - 1].some((item) => messagesLinked(item, current));
    if (gap > SUBJECT_GAP_MS && !linked) {
      buckets.push([current]);
    } else {
      buckets[buckets.length - 1].push(current);
    }
  }
  return buckets;
}

/**
 * Conversation grouping like Apple Mail:
 * 1) join by Message-ID / In-Reply-To / References / server thread id
 * 2) join those fragments by normalized subject (Re:/Fwd: stripped)
 * 3) only split a subject group when a long quiet gap has no header link
 */
export function groupThreads<T extends Threadable>(items: T[]): MailThread<T>[] {
  if (items.length === 0) return [];

  const { parent, find, union } = createUnion();
  const itemRoot = new Map<string, string>();

  for (const item of items) {
    if (item.threadId) {
      const key = `server:${item.threadId}`;
      parent.set(key, parent.get(key) || key);
      itemRoot.set(item.id, key);
      continue;
    }

    const ids = linkedIds(item);
    if (ids.length === 0) {
      const key = `solo:${item.id}`;
      parent.set(key, key);
      itemRoot.set(item.id, key);
      continue;
    }
    for (const id of ids) parent.set(id, parent.get(id) || id);
    for (let i = 1; i < ids.length; i += 1) union(ids[0], ids[i]);
    itemRoot.set(item.id, ids[0]);
  }

  const byHeader = new Map<string, T[]>();
  for (const item of items) {
    const key = find(itemRoot.get(item.id)!);
    const list = byHeader.get(key) || [];
    list.push(item);
    byHeader.set(key, list);
  }

  const bySubject = new Map<string, T[]>();
  for (const list of byHeader.values()) {
    const subject = normalizeSubject(list[0]?.subject || "(no subject)");
    const existing = bySubject.get(subject) || [];
    existing.push(...list);
    bySubject.set(subject, existing);
  }

  const threads: MailThread<T>[] = [];
  for (const [subject, list] of bySubject) {
    const buckets = subject === "(no subject)" ? list.map((message) => [message]) : splitByGap(list);
    for (const bucket of buckets) {
      const messages = [...bucket].sort((a, b) => +new Date(a.date) - +new Date(b.date));
      const latest = messages[messages.length - 1];
      threads.push({
        id: `thread:${subject}:${messages[0].id}`,
        messages,
        latest,
      });
    }
  }

  return threads.sort((a, b) => +new Date(b.latest.date) - +new Date(a.latest.date));
}

export function threadContaining<T extends Threadable>(items: T[], id: string | null) {
  if (!id) return null;
  return groupThreads(items).find((thread) => thread.messages.some((message) => message.id === id)) || null;
}

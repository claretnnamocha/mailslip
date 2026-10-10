import type { MailMessageSummary } from "@/lib/mail/types";

export type MailTarget = Pick<
  MailMessageSummary,
  "uid" | "remoteId" | "identityId" | "folder" | "id"
>;

async function patchFlags(target: MailTarget, flags: { seen?: boolean; flagged?: boolean }) {
  const res = await fetch(`/api/mail/messages/${target.uid}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identityId: target.identityId,
      folder: target.folder,
      remoteId: target.remoteId || String(target.uid),
      ...flags,
    }),
  });
  if (!res.ok) throw new Error("Could not update flags");
}

async function postAction(
  target: MailTarget,
  body: Record<string, unknown>,
) {
  const res = await fetch(`/api/mail/messages/${target.uid}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identityId: target.identityId,
      folder: target.folder,
      remoteId: target.remoteId || String(target.uid),
      ...body,
    }),
  });
  if (!res.ok) throw new Error("Action failed");
}

export async function setSeen(targets: MailTarget[], seen: boolean) {
  await Promise.all(targets.map((target) => patchFlags(target, { seen })));
}

export async function setFlagged(targets: MailTarget[], flagged: boolean) {
  await Promise.all(targets.map((target) => patchFlags(target, { flagged })));
}

export async function moveTargets(targets: MailTarget[], destination: string) {
  await Promise.all(
    targets.map((target) => postAction(target, { action: "move", destination })),
  );
}

export async function snoozeTarget(target: MailTarget, wakeAt: Date) {
  await postAction(target, { action: "snooze", wakeAt: wakeAt.toISOString() });
}

export async function blockSender(address: string) {
  const res = await fetch("/api/settings/spam", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ list: "blocked", value: address.trim().toLowerCase() }),
  });
  if (!res.ok) throw new Error("Could not block sender");
}

export async function markFolderRead(identityId: string, folder: string) {
  const res = await fetch("/api/mail/folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identityId, action: "mark-all-read", folder }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Could not mark folder read");
  }
}

export async function createMailbox(identityId: string, name: string, parentPath?: string) {
  const res = await fetch("/api/mail/folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identityId, action: "create", name, parentPath }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Could not create mailbox");
  }
}

export async function emptyMailbox(identityId: string, folder: string) {
  const res = await fetch("/api/mail/folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identityId, action: "empty", folder }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Could not empty mailbox");
  }
}

export function unsubscribeUrlFromHeaders(headers?: Record<string, string> | null) {
  if (!headers) return null;
  const raw =
    headers["list-unsubscribe"] ||
    headers["List-Unsubscribe"] ||
    headers["LIST-UNSUBSCRIBE"];
  if (!raw) return null;
  const mailto = raw.match(/<(mailto:[^>]+)>/i)?.[1];
  const https = raw.match(/<(https?:\/\/[^>]+)>/i)?.[1];
  return https || mailto || null;
}

const FAVORITES_KEY = "mailslip-favorites";
const MUTED_KEY = "mailslip-muted-threads";
const FLAG_COLORS_KEY = "mailslip-flag-colors";
const LIST_PREFS_KEY = "mailslip-list-prefs";

export type FlagColor =
  | "none"
  | "orange"
  | "red"
  | "purple"
  | "blue"
  | "yellow"
  | "green"
  | "grey";

export const FLAG_COLORS: { id: FlagColor; label: string; swatch: string }[] = [
  { id: "none", label: "Clear", swatch: "transparent" },
  { id: "orange", label: "Orange", swatch: "#E89A4A" },
  { id: "red", label: "Red", swatch: "#D65A5A" },
  { id: "purple", label: "Purple", swatch: "#9B7BD4" },
  { id: "blue", label: "Blue", swatch: "#5B8FD9" },
  { id: "yellow", label: "Yellow", swatch: "#E0C35A" },
  { id: "green", label: "Green", swatch: "#5DAD6E" },
  { id: "grey", label: "Grey", swatch: "#8A8680" },
];

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getFavoritePaths(): string[] {
  return readJson<string[]>(FAVORITES_KEY, []);
}

export function toggleFavoritePath(path: string): string[] {
  const current = getFavoritePaths();
  const next = current.includes(path)
    ? current.filter((item) => item !== path)
    : [...current, path];
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  return next;
}

export function getMutedThreadIds(): string[] {
  return readJson<string[]>(MUTED_KEY, []);
}

export function toggleMutedThread(threadId: string): string[] {
  const current = getMutedThreadIds();
  const next = current.includes(threadId)
    ? current.filter((item) => item !== threadId)
    : [...current, threadId];
  localStorage.setItem(MUTED_KEY, JSON.stringify(next));
  return next;
}

export function getFlagColor(messageId: string): FlagColor {
  const map = readJson<Record<string, FlagColor>>(FLAG_COLORS_KEY, {});
  return map[messageId] || "none";
}

export function setFlagColor(messageId: string, color: FlagColor) {
  const map = readJson<Record<string, FlagColor>>(FLAG_COLORS_KEY, {});
  if (color === "none") delete map[messageId];
  else map[messageId] = color;
  localStorage.setItem(FLAG_COLORS_KEY, JSON.stringify(map));
}

export type ListPrefs = {
  showContactPhoto: boolean;
  showMailCategories: boolean;
};

export function getListPrefs(): ListPrefs {
  return readJson<ListPrefs>(LIST_PREFS_KEY, {
    showContactPhoto: true,
    showMailCategories: false,
  });
}

export function setListPrefs(prefs: Partial<ListPrefs>): ListPrefs {
  const next = { ...getListPrefs(), ...prefs };
  localStorage.setItem(LIST_PREFS_KEY, JSON.stringify(next));
  return next;
}

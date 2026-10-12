import { folderRole, type FolderLike } from "./folder-map";
import { mailboxAddress } from "./scoped";

const SHARED_ROLES = new Set(["inbox", "sent", "drafts", "archive", "junk", "trash"]);

/**
 * Local-part used as a private folder prefix when the visible address is not
 * the IMAP login. "claret@…" with username "hello" → "claret". The login
 * mailbox itself (hello) has no prefix.
 */
export function folderNamespace(email: string, username?: string | null): string | null {
  const addr = email.trim().toLowerCase();
  const local = addr.split("@")[0] || "";
  const loginLocal = (mailboxAddress(username, addr).split("@")[0] || "").trim();
  if (!local || !loginLocal || local === loginLocal) return null;
  return local;
}

export function folderInNamespace(
  folder: { path: string; name?: string; delimiter?: string },
  namespace: string,
): boolean {
  const ns = namespace.toLowerCase();
  const path = folder.path.toLowerCase();
  const name = (folder.name || "").toLowerCase();
  if (path === ns || name === ns) return true;
  const delims = new Set(["/", ".", folder.delimiter || "/"]);
  for (const delim of delims) {
    if (delim && path.startsWith(`${ns}${delim}`)) return true;
  }
  return false;
}

/**
 * A filtered address (claret logging in as hello) keeps the standard folders,
 * where mail is already filtered by recipient, plus folders under its own
 * prefix. Custom folders that belong to the login mailbox stay hidden.
 * The login mailbox hides prefixes that belong to those filtered addresses.
 */
export function visibleMailboxFolders<T extends FolderLike>(
  folders: T[],
  namespace: string | null,
  foreignNamespaces: string[],
): T[] {
  if (!namespace && foreignNamespaces.length === 0) return folders;
  return folders.filter((folder) => {
    if (namespace && folderInNamespace(folder, namespace)) return true;
    if (foreignNamespaces.some((ns) => folderInNamespace(folder, ns))) return false;
    if (!namespace) return true;
    const role = folderRole(folder);
    return role != null && SHARED_ROLES.has(role);
  });
}

export function mailboxPathVisible(
  path: string,
  namespace: string | null,
  foreignNamespaces: string[],
): boolean {
  const leaf = path.split(/[/\\.]/).filter(Boolean).pop() || path;
  const delimiter = path.includes("/") ? "/" : ".";
  return (
    visibleMailboxFolders(
      [{ path, name: leaf, delimiter }],
      namespace,
      foreignNamespaces,
    ).length > 0
  );
}

/** New folders for a filtered address go under its prefix, not the login mailbox. */
export function scopedCreateParent(namespace: string | null, parentPath?: string): string | undefined {
  if (!namespace) return parentPath;
  if (parentPath && folderInNamespace({ path: parentPath, name: parentPath }, namespace)) {
    return parentPath;
  }
  return namespace;
}

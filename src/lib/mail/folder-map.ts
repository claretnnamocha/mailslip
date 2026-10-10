export type FolderLike = {
  path: string;
  name: string;
  delimiter?: string;
  specialUse?: string;
  selectable?: boolean;
};

const ROLES: { role: string; special: string; names: readonly string[] }[] = [
  { role: "inbox", special: "\\inbox", names: ["inbox"] },
  { role: "sent", special: "\\sent", names: ["sent", "sent items", "sent mail", "sent messages"] },
  { role: "drafts", special: "\\drafts", names: ["drafts", "draft"] },
  { role: "archive", special: "\\archive", names: ["archive", "archives"] },
  { role: "junk", special: "\\junk", names: ["junk", "spam", "junk mail", "bulk mail"] },
  { role: "trash", special: "\\trash", names: ["trash", "deleted", "deleted items", "deleted messages", "bin"] },
];

export function folderRole(folder: FolderLike): string | null {
  const special = (folder.specialUse || "").toLowerCase();
  const named = ROLES.find((role) => role.special === special);
  if (named) return named.role;

  const delimiter = folder.delimiter || "/";
  const tail = (folder.path.split(delimiter).pop() || folder.name).toLowerCase();
  const name = folder.name.toLowerCase();
  const match = ROLES.find((role) => role.names.includes(name) || role.names.includes(tail));
  return match?.role || null;
}

export function resolveFolderPath(requested: string, folders: FolderLike[]): string {
  if (!folders.length) return requested;
  const exact = folders.find((folder) => folder.path === requested || folder.name === requested);
  if (exact) return exact.path;

  const wanted = requested.toLowerCase();
  const role = ROLES.find((item) => item.role === wanted || item.names.includes(wanted));
  if (role) {
    const match = folders.find((folder) => folderRole(folder) === role.role && folder.selectable !== false);
    if (match) return match.path;
  }

  const fuzzy = folders.find(
    (folder) => folder.path.toLowerCase() === wanted || folder.name.toLowerCase() === wanted,
  );
  return fuzzy?.path || requested;
}

const ROLE_ORDER = ["inbox", "sent", "drafts", "archive", "junk", "trash"];

export function sortFolders<T extends FolderLike>(folders: T[]): T[] {
  return [...folders].sort((a, b) => {
    const aRole = folderRole(a);
    const bRole = folderRole(b);
    const aIndex = aRole ? ROLE_ORDER.indexOf(aRole) : 99;
    const bIndex = bRole ? ROLE_ORDER.indexOf(bRole) : 99;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return a.path.localeCompare(b.path);
  });
}

export type FolderNode<T extends FolderLike> = {
  folder: T;
  children: FolderNode<T>[];
};

function parentPathOf<T extends FolderLike & { parentPath?: string }>(
  folder: T,
  byPath: Map<string, T>,
): string | null {
  if (folder.parentPath && folder.parentPath !== folder.path && byPath.has(folder.parentPath)) {
    return folder.parentPath;
  }
  const delimiter = folder.delimiter || "/";
  const parts = folder.path.split(delimiter);
  for (let i = parts.length - 1; i > 0; i -= 1) {
    const candidate = parts.slice(0, i).join(delimiter);
    if (byPath.has(candidate)) return candidate;
  }
  return null;
}

export function buildFolderTree<T extends FolderLike & { parentPath?: string }>(
  folders: T[],
): FolderNode<T>[] {
  const byPath = new Map(folders.map((folder) => [folder.path, folder]));
  const childPaths = new Map<string, T[]>();
  const roots: T[] = [];

  for (const folder of folders) {
    const parent = parentPathOf(folder, byPath);
    if (!parent) {
      roots.push(folder);
      continue;
    }
    const list = childPaths.get(parent) || [];
    list.push(folder);
    childPaths.set(parent, list);
  }

  function node(folder: T): FolderNode<T> {
    return {
      folder,
      children: sortFolders(childPaths.get(folder.path) || []).map(node),
    };
  }

  function prune(nodes: FolderNode<T>[]): FolderNode<T>[] {
    return nodes
      .map((item) => ({ ...item, children: prune(item.children) }))
      .filter((item) => item.folder.selectable !== false || item.children.length > 0);
  }

  return prune(sortFolders(roots).map(node));
}

export function groupedUnseen<T extends FolderLike & { unseen?: number }>(
  node: FolderNode<T>,
): number {
  const own = node.folder.selectable === false ? 0 : node.folder.unseen || 0;
  return own + node.children.reduce((sum, child) => sum + groupedUnseen(child), 0);
}

/** Unread counts from scoped message lists (alias filtering), not raw server UNSEEN. */
export function groupedScopedUnseen(
  node: FolderNode<FolderLike & { unseen?: number }>,
  mailByFolder: Record<string, { seen: boolean }[]>,
): number {
  const cached = mailByFolder[node.folder.path];
  const own =
    node.folder.selectable === false
      ? 0
      : cached
        ? cached.filter((message) => !message.seen).length
        : 0;
  return own + node.children.reduce((sum, child) => sum + groupedScopedUnseen(child, mailByFolder), 0);
}

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

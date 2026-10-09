"use client";

import { useEffect, useState } from "react";
import { SettingsSection } from "@/components/settings/section";
import { sortFolders } from "@/lib/mail/folder-map";
import type { MailFolder } from "@/lib/mail/types";

type Identity = { id: string; email: string };
type Group = { email: string; folders: MailFolder[]; error?: string };

export default function FoldersPage() {
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    (async () => {
      const ids = (await fetch("/api/identities").then((r) => (r.ok ? r.json() : []))) as Identity[];
      const next = await Promise.all(
        ids.map(async (identity) => {
          const res = await fetch(`/api/mail/folders?identityId=${identity.id}`);
          const data = await res.json();
          if (!res.ok) {
            return { email: identity.email, folders: [], error: data.error || "Could not list folders" };
          }
          return {
            email: identity.email,
            folders: sortFolders((data as MailFolder[]).filter((folder) => folder.selectable !== false)),
          };
        }),
      );
      setGroups(next);
    })();
  }, []);

  return (
    <SettingsSection
      title="Folders"
      description="Folders from each mailbox, using the names your server actually has."
    >
      <div className="space-y-6">
        {groups.length === 0 && (
          <p className="text-[14px] text-text-2">Connect a mailbox to manage folders.</p>
        )}
        {groups.map((group) => (
          <div key={group.email}>
            <div className="mb-2 mono text-[13px] text-text-2">{group.email}</div>
            {group.error && <p className="text-[14px] text-danger">{group.error}</p>}
            {!group.error && group.folders.length === 0 && (
              <p className="text-[14px] text-text-2">This server did not list any folders.</p>
            )}
            <div className="space-y-2">
              {group.folders.map((folder) => (
                <div key={folder.path} className="rounded-xl border border-border px-4 py-3 text-[14px]">
                  <div>{folder.name}</div>
                  <div className="mono text-[12px] text-text-3">{folder.path}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SettingsSection>
  );
}

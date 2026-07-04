"use client";
import { useEffect, useState } from "react";
import { SettingsSection } from "@/components/settings/section";
export default function FoldersPage() {
  const [folders, setFolders] = useState<{ path: string; name: string }[]>([]);
  useEffect(() => {
    (async () => {
      const ids = await fetch("/api/identities").then((r) => r.json());
      if (!ids[0]) return;
      const res = await fetch(`/api/mail/folders?identityId=${ids[0].id}`);
      if (res.ok) setFolders(await res.json());
    })();
  }, []);
  return (
    <SettingsSection title="Folders" description="Real IMAP folders — rename, nest, and manage without inventing labels.">
      <div className="space-y-2">
        {folders.length === 0 && <p className="text-[14px] text-text-2">Connect a mailbox to manage folders.</p>}
        {folders.map((f) => (
          <div key={f.path} className="rounded-xl border border-border px-4 py-3 text-[14px] mono">{f.path}</div>
        ))}
      </div>
    </SettingsSection>
  );
}

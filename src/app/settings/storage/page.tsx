"use client";
import { useEffect, useState } from "react";
import { SettingsSection } from "@/components/settings/section";
export default function StoragePage() {
  const [rows, setRows] = useState<{ email: string; type: string; message: string }[]>([]);
  useEffect(() => {
    fetch("/api/identities").then(async (r) => {
      if (!r.ok) return;
      const identities = await r.json();
      setRows(identities.map((i: { email: string; type: string }) => ({
        email: i.email,
        type: i.type,
        message: i.type === "SCOPED_ALIAS"
          ? "Counts toward backing mailbox"
          : "This server doesn't report a quota",
      })));
    });
  }, []);
  return (
    <SettingsSection title="Storage" description="Quota is identity-type-aware. Aliases count toward their backing mailbox.">
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.email} className="rounded-xl border border-border px-4 py-3">
            <div className="mono text-[13px]">{r.email}</div>
            <div className="mt-1 text-[13px] text-text-2">{r.message}</div>
          </div>
        ))}
      </div>
    </SettingsSection>
  );
}

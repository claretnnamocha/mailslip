"use client";

import { useEffect, useState } from "react";
import { SettingsSection } from "@/components/settings/section";

type QuotaRow = {
  email: string;
  type: string;
  supported?: boolean;
  used?: number;
  limit?: number;
  message?: string;
};

function formatBytes(n?: number) {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
}

export default function StoragePage() {
  const [rows, setRows] = useState<QuotaRow[]>([]);

  useEffect(() => {
    fetch("/api/mail/quota").then(async (r) => {
      if (r.ok) setRows(await r.json());
    });
  }, []);

  return (
    <SettingsSection
      title="Storage"
      description="Quota is identity-type-aware. Aliases count toward their backing mailbox."
    >
      <div className="space-y-3">
        {rows.length === 0 && (
          <p className="text-[14px] text-text-2">Connect a mailbox to see storage.</p>
        )}
        {rows.map((r) => (
          <div key={r.email} className="rounded-xl border border-border px-4 py-3">
            <div className="mono text-[13px]">{r.email}</div>
            {r.supported && r.limit ? (
              <div className="mt-2">
                <div className="mb-1 flex justify-between text-[12px] text-text-2">
                  <span>
                    {formatBytes(r.used)} of {formatBytes(r.limit)}
                  </span>
                  <span>{Math.round(((r.used || 0) / r.limit) * 100)}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full bg-accent"
                    style={{ width: `${Math.min(100, ((r.used || 0) / r.limit) * 100)}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="mt-1 text-[13px] text-text-2">
                {r.message || "This server doesn't report a quota"}
              </div>
            )}
          </div>
        ))}
      </div>
    </SettingsSection>
  );
}

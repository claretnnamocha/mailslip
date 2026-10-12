"use client";

import { useSyncExternalStore } from "react";
import { SettingsSection } from "@/components/settings/section";
import { readShortcutsEnabled, subscribeShortcuts, writeShortcutsEnabled } from "@/lib/shortcuts";

const shortcuts = [
  ["C", "Compose"],
  ["R", "Reply"],
  ["A", "Reply all"],
  ["F", "Forward"],
  ["E", "Archive"],
  ["#", "Trash"],
  ["J / K", "Next / previous message"],
  ["/", "Search"],
  ["?", "Shortcuts"],
];

export default function ShortcutsPage() {
  const enabled = useSyncExternalStore(subscribeShortcuts, readShortcutsEnabled, () => false);

  function toggle(next: boolean) {
    writeShortcutsEnabled(next);
  }

  return (
    <SettingsSection
      title="Keyboard shortcuts"
      description="Off by default. Turn them on if you want keys to act on mail."
    >
      <label className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
        <span className="text-[14px]">Enable keyboard shortcuts</span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => toggle(e.target.checked)}
          aria-label="Enable keyboard shortcuts"
        />
      </label>
      <div className="space-y-2">
        {shortcuts.map(([key, label]) => (
          <div key={key} className="flex items-center justify-between border-b border-border py-2 text-[14px]">
            <span className={enabled ? "" : "text-text-3"}>{label}</span>
            <kbd className="mono rounded-md border border-border-strong bg-surface-2 px-2 py-1 text-[12px]">{key}</kbd>
          </div>
        ))}
      </div>
    </SettingsSection>
  );
}

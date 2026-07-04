"use client";
import { SettingsSection } from "@/components/settings/section";
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
  return (
    <SettingsSection title="Keyboard shortcuts" description="Stay in flow without reaching for the mouse.">
      <div className="space-y-2">
        {shortcuts.map(([key, label]) => (
          <div key={key} className="flex items-center justify-between border-b border-border py-2 text-[14px]">
            <span>{label}</span>
            <kbd className="mono rounded-md border border-border-strong bg-surface-2 px-2 py-1 text-[12px]">{key}</kbd>
          </div>
        ))}
      </div>
    </SettingsSection>
  );
}

"use client";
import { SettingsSection } from "@/components/settings/section";
export default function NotificationsPage() {
  return (
    <SettingsSection title="Notifications" description="Per-identity desktop alerts, sound, and unread badges.">
      <div className="space-y-4 text-[14px] text-text-2">
        <label className="flex items-center justify-between"><span>Desktop notifications</span><input type="checkbox" defaultChecked /></label>
        <label className="flex items-center justify-between"><span>Sound</span><input type="checkbox" /></label>
        <label className="flex items-center justify-between"><span>Unread badge</span><input type="checkbox" defaultChecked /></label>
      </div>
    </SettingsSection>
  );
}

import { SettingsShell } from "@/components/settings/settings-shell";
import { pageTitle } from "@/lib/page-meta";

export const metadata = pageTitle("Profile");

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <SettingsShell>{children}</SettingsShell>;
}

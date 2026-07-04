"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const sections = [
  { href: "/settings", label: "Profile" },
  { href: "/settings/identities", label: "Mail identities" },
  { href: "/settings/signatures", label: "Signatures" },
  { href: "/settings/filters", label: "Filters & rules" },
  { href: "/settings/team", label: "Team" },
  { href: "/settings/domains", label: "Domain" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/appearance", label: "Appearance" },
  { href: "/settings/shortcuts", label: "Keyboard shortcuts" },
  { href: "/settings/vacation", label: "Vacation responder" },
  { href: "/settings/folders", label: "Folders" },
  { href: "/settings/encryption", label: "Encryption" },
  { href: "/settings/spam", label: "Spam & blocking" },
  { href: "/settings/import", label: "Import" },
  { href: "/settings/storage", label: "Storage" },
  { href: "/settings/danger", label: "Danger zone" },
];

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-bg">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <Logo size={26} />
        <Link href="/mail" className="text-[13px] font-medium text-accent">
          Back to inbox
        </Link>
      </header>
      <div className="mx-auto flex max-w-6xl gap-8 px-6 py-8">
        <nav className="hidden w-52 shrink-0 md:block">
          <div className="sticky top-8 space-y-0.5">
            {sections.map((s) => {
              const active =
                s.href === "/settings"
                  ? pathname === "/settings"
                  : pathname.startsWith(s.href);
              return (
                <Link
                  key={s.href}
                  href={s.href}
                  className={cn(
                    "block rounded-[10px] px-3 py-2 text-[13.5px] transition-colors",
                    active
                      ? "bg-accent-tint font-medium text-text"
                      : "text-text-2 hover:bg-hover hover:text-text",
                  )}
                >
                  {s.label}
                </Link>
              );
            })}
          </div>
        </nav>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function LegalDocument({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="flex items-center justify-between px-6 py-6 md:px-11">
        <Link href="/">
          <Logo />
        </Link>
        <nav className="flex gap-4 text-[13px] text-text-2">
          <Link href="/privacy" className="hover:text-text">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-text">
            Terms
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-[720px] px-6 pb-20">
        <h1 className="text-[36px] font-semibold tracking-[-0.02em]">{title}</h1>
        <p className="mt-3 text-[14px] text-text-3">Updated {updated}</p>
        <div className="mt-8 space-y-4 text-[16px] leading-[1.6] text-text-2 [&_h2]:pt-4 [&_h2]:text-[18px] [&_h2]:font-semibold [&_h2]:text-text [&_a]:text-text [&_a]:underline">
          {children}
        </div>
      </main>
    </div>
  );
}

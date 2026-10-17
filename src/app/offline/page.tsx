import { Logo } from "@/components/brand/logo";
import { pageTitle } from "@/lib/page-meta";

export const dynamic = "force-dynamic";
export const metadata = pageTitle("Offline");

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-center">
      <Logo />
      <h1 className="mt-8 text-[27px] font-semibold tracking-[-0.02em]">You&apos;re offline</h1>
      <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-text-2">
        Mailslip needs a connection to reach your mail servers. Check the network and try again.
      </p>
      <a
        href="/mail"
        className="mt-8 inline-flex h-[46px] items-center rounded-[11px] bg-accent px-5 text-[15px] font-medium text-white"
      >
        Try again
      </a>
    </div>
  );
}

import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/mail");

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex items-center justify-between px-6 py-6 md:px-11">
        <Logo />
        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="dark" size="sm">
              Get started
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center px-6 pb-0 pt-16 text-center md:pt-20">
        <p className="mb-6 mono text-[12px] font-medium uppercase tracking-[0.16em] text-accent">
          Bring your own server
        </p>
        <h1 className="max-w-[860px] text-[40px] font-semibold leading-[1.07] tracking-[-0.025em] md:text-[60px]">
          Beautiful email,
          <br />
          without switching providers.
        </h1>
        <p className="mt-6 max-w-[590px] text-[17px] leading-[1.6] text-text-2 md:text-[19px]">
          Mailslip isn&apos;t another inbox to move to. It&apos;s a calm, modern client for the
          email you already own: connect Gmail, Zoho, or your own domain over IMAP, POP3, or JMAP
          and manage all of it in one place. Your servers, your data, zero lock-in.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link href="/login">
            <Button size="lg">Get started free</Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="secondary">
              Sign in
            </Button>
          </Link>
        </div>
        <p className="mt-5 mono text-[13px] tracking-[0.01em] text-text-3">
          IMAP · POP3 · JMAP · SMTP · connect anything, move nothing
        </p>

        <div className="mt-14 flex h-[280px] w-full max-w-[1060px] overflow-hidden rounded-t-[14px] border border-b-0 border-border bg-surface text-left shadow-[0_24px_60px_rgba(28,27,25,0.10)]">
          <div className="hidden w-[184px] flex-col gap-2 border-r border-border bg-surface-2 p-4 sm:flex">
            <div className="h-2.5 w-16 rounded-full bg-accent-tint" />
            <div className="mt-2 h-2 w-24 rounded-full bg-border" />
            <div className="h-2 w-20 rounded-full bg-border" />
            <div className="h-2 w-22 rounded-full bg-border" />
            <div className="h-2 w-16 rounded-full bg-border" />
          </div>
          <div className="w-[42%] border-r border-border py-2 sm:w-[300px]">
            <div className="border-l-2 border-accent bg-accent-tint px-4 py-3">
              <div className="h-2.5 w-[120px] rounded-full bg-[#D8C7BC]" />
              <div className="mt-2 h-2 w-[180px] rounded-full bg-[#E7DBD2]" />
            </div>
            <div className="px-4 py-3">
              <div className="h-2 w-[104px] rounded-full bg-border-strong" />
              <div className="mt-2 h-2 w-[170px] rounded-full bg-border" />
            </div>
            <div className="px-4 py-3">
              <div className="h-2 w-24 rounded-full bg-border-strong" />
              <div className="mt-2 h-2 w-40 rounded-full bg-border" />
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-3 p-6">
            <div className="h-3.5 w-[70%] rounded-md bg-border-strong" />
            <div className="mb-2 h-2 w-[35%] rounded-full bg-border" />
            <div className="h-2 w-[96%] rounded-full bg-[#F0ECE5]" />
            <div className="h-2 w-[99%] rounded-full bg-[#F0ECE5]" />
            <div className="h-2 w-[90%] rounded-full bg-[#F0ECE5]" />
            <div className="h-2 w-[70%] rounded-full bg-[#F0ECE5]" />
          </div>
        </div>
      </main>
    </div>
  );
}

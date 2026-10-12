"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { getSession, signIn } from "next-auth/react";
import { LogoMark } from "@/components/brand/logo";
import { useHostingMode } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm({ allowSignup: allowSignupProp }: { allowSignup: boolean }) {
  const hosting = useHostingMode();
  // Prefer hiding until runtime confirms cloud — avoids a stale self-hosted flash of signup.
  const [allowSignup, setAllowSignup] = useState(false);
  const [brand, setBrand] = useState("Mailslip");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [zitadelEnabled, setZitadelEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/hosting")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setAllowSignup(Boolean(data.allowSignup) && data.mode === "cloud");
        if (typeof data.brand === "string" && data.brand.trim()) setBrand(data.brand.trim());
      })
      .catch(() => {
        if (!cancelled) setAllowSignup(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetch("/api/auth/providers")
      .then((r) => r.json())
      .then((providers) => setZitadelEnabled(Boolean(providers?.zitadel)))
      .catch(() => setZitadelEnabled(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getSession().then((session) => {
      if (!cancelled && session?.user) window.location.replace("/mail");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await signIn("credentials", {
        email,
        password,
        callbackUrl: "/mail",
        redirect: false,
      });
      if (result?.code === "account_disabled") {
        setError("This account is disabled. Ask an admin to enable it.");
        return;
      }
      // BYOD: Auth.js may return error/url quirks while still setting the session cookie.
      const session = await getSession();
      if (session?.user) {
        window.location.replace("/mail");
        return;
      }
      setError("Invalid email or password");
    } catch {
      const session = await getSession().catch(() => null);
      if (session?.user) {
        window.location.replace("/mail");
        return;
      }
      setError("Sign-in failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const showSignup = allowSignup && allowSignupProp && hosting === "cloud";

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-6 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center gap-4">
          <LogoMark size={42} className="rounded-[12px]" />
          <div className="text-center">
            <h1 className="text-[25px] font-semibold tracking-[-0.02em]">Welcome back</h1>
            <p className="mt-1.5 text-[15px] text-text-2">
              Your inboxes are right where you left them.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-[30px] shadow-[var(--shadow)]">
          <form onSubmit={onSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              mono
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && <p className="text-[13px] text-danger">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          {zitadelEnabled && (
            <>
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="mono text-[12px] text-text-3">OR</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => signIn("zitadel", { callbackUrl: "/mail" })}
              >
                Continue with Zitadel
              </Button>
            </>
          )}
        </div>

        {showSignup && (
          <p className="mt-6 text-center text-[14px] text-text-2">
            New to {brand}?{" "}
            <Link href="/register" className="font-medium text-accent">
              Create an account
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

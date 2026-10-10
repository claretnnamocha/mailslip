"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSession } from "next-auth/react";

export function RegisterForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [zitadelEnabled, setZitadelEnabled] = useState(false);

  useEffect(() => {
    fetch("/api/auth/providers")
      .then((r) => r.json())
      .then((providers) => setZitadelEnabled(Boolean(providers?.zitadel)))
      .catch(() => setZitadelEnabled(false));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create account");
        setLoading(false);
        return;
      }

      await signIn("credentials", {
        email,
        password,
        callbackUrl: "/onboarding",
        redirect: false,
      });
      const session = await getSession();
      if (session?.user) {
        window.location.replace("/onboarding");
        return;
      }
      setError("Account created, but sign-in failed. Try signing in.");
    } catch {
      setError("Could not create account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-6 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center gap-4">
          <LogoMark size={42} className="rounded-[12px]" />
          <div className="text-center">
            <h1 className="text-[25px] font-semibold tracking-[-0.02em]">
              Create your account
            </h1>
            <p className="mt-1.5 text-[15px] text-text-2">
              Then connect the mailboxes you already own.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-[30px] shadow-[var(--shadow)]">
          <form onSubmit={onSubmit} className="space-y-4">
            <Input
              label="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
            />
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
            <Input
              label="Confirm password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
            {error && <p className="text-[13px] text-danger">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account…" : "Create account"}
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
                onClick={() => signIn("zitadel", { callbackUrl: "/onboarding" })}
              >
                Continue with Zitadel
              </Button>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-[14px] text-text-2">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Step = 1 | 2 | 3 | 4 | 5 | 6;

const presets: Record<string, Partial<FormState>> = {
  gmail: {
    imapHost: "imap.gmail.com",
    imapPort: "993",
    smtpHost: "smtp.gmail.com",
    smtpPort: "587",
    authMode: "APP_PASSWORD",
  },
  outlook: {
    imapHost: "outlook.office365.com",
    imapPort: "993",
    smtpHost: "smtp.office365.com",
    smtpPort: "587",
    authMode: "APP_PASSWORD",
  },
  custom: {},
};

type FormState = {
  connectType: "individual" | "domain";
  email: string;
  displayName: string;
  incomingProtocol: "IMAP" | "POP3" | "JMAP";
  authMode: "PASSWORD" | "APP_PASSWORD" | "OAUTH";
  username: string;
  password: string;
  imapHost: string;
  imapPort: string;
  smtpHost: string;
  smtpPort: string;
  cardDavUrl: string;
  calDavUrl: string;
};

const initial: FormState = {
  connectType: "individual",
  email: "",
  displayName: "",
  incomingProtocol: "IMAP",
  authMode: "PASSWORD",
  username: "",
  password: "",
  imapHost: "",
  imapPort: "993",
  smtpHost: "",
  smtpPort: "587",
  cardDavUrl: "",
  calDavUrl: "",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>(initial);
  const [testing, setTesting] = useState(false);
  const [health, setHealth] = useState<{
    mxOk?: boolean;
    spfOk?: boolean;
    dmarcOk?: boolean;
    dkimOk?: boolean | null;
  } | null>(null);
  const [error, setError] = useState("");

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function testAndCreate() {
    setTesting(true);
    setError("");
    try {
      const res = await fetch("/api/identities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          displayName: form.displayName || form.email.split("@")[0],
          incomingProtocol: form.incomingProtocol,
          authMode: form.authMode,
          username: form.username || form.email,
          password: form.password,
          imapHost: form.imapHost,
          imapPort: Number(form.imapPort) || 993,
          smtpHost: form.smtpHost,
          smtpPort: Number(form.smtpPort) || 587,
          cardDavUrl: form.cardDavUrl || undefined,
          calDavUrl: form.calDavUrl || undefined,
          test: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Connection failed");
      setHealth(data.health || null);
      setStep(6);
      toast.success("Mailbox connected");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-bg px-6 py-10 md:px-10">
      <div className="mx-auto max-w-[680px]">
        <div className="mb-6 flex items-center justify-between">
          <Logo size={26} />
          <span className="mono text-[13px] text-text-3">Step {step} of 6</span>
        </div>
        <div className="mb-10 flex gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-[3px] flex-1 rounded-full",
                i < step ? "bg-accent" : "bg-border-strong",
              )}
            />
          ))}
        </div>

        {step === 1 && (
          <div>
            <h1 className="text-[30px] font-semibold tracking-[-0.02em]">
              Connect an account you own
            </h1>
            <p className="mt-3 max-w-[460px] text-[16px] leading-[1.55] text-text-2">
              No migration, no new address. Point Mailslip at your existing mailbox and we&apos;ll
              read and send through your own servers.
            </p>
            <div className="mt-8 space-y-3.5">
              {(
                [
                  {
                    id: "individual" as const,
                    title: "Individual email address",
                    body: "A single inbox like you@gmail.com or hello@yourdomain.com.",
                  },
                  {
                    id: "domain" as const,
                    title: "Full domain",
                    body: "Connect a domain once; every address becomes a send-from identity.",
                  },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  onClick={() => update("connectType", option.id)}
                  className={cn(
                    "flex w-full items-start gap-4 rounded-[14px] border p-[22px] text-left transition-colors",
                    form.connectType === option.id
                      ? "border-accent bg-accent-tint"
                      : "border-border-strong bg-surface hover:bg-hover",
                  )}
                >
                  <div>
                    <div className="text-[16px] font-semibold">{option.title}</div>
                    <div className="mt-1 text-[14px] text-text-2">{option.body}</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-8 flex justify-end">
              <Button
                onClick={() => {
                  if (form.connectType === "domain") {
                    router.push("/settings/domains");
                    return;
                  }
                  setStep(2);
                }}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="text-[30px] font-semibold tracking-[-0.02em]">Your address</h1>
            <p className="mt-3 text-[16px] text-text-2">
              We&apos;ll use this as your identity label and default username.
            </p>
            <div className="mt-8 space-y-4">
              <Input
                label="Email address"
                mono
                value={form.email}
                onChange={(e) => {
                  update("email", e.target.value);
                  if (!form.username) update("username", e.target.value);
                }}
                placeholder="ada@aurelia.studio"
              />
              <Input
                label="Display name"
                value={form.displayName}
                onChange={(e) => update("displayName", e.target.value)}
                placeholder="Ada Lovelace"
              />
              <div>
                <div className="mb-2 text-[13px] font-medium text-text-2">Quick presets</div>
                <div className="flex flex-wrap gap-2">
                  {(["gmail", "outlook", "custom"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setForm((f) => ({ ...f, ...presets[p] }))}
                      className="rounded-[9px] border border-border-strong bg-surface px-3 py-2 text-[13px] capitalize hover:bg-hover"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={() => setStep(3)} disabled={!form.email.includes("@")}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="text-[30px] font-semibold tracking-[-0.02em]">Incoming & auth</h1>
            <p className="mt-3 text-[16px] text-text-2">
              Gmail and Outlook usually need an app password or OAuth — not your normal login.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-[13px] font-medium text-text-2">Protocol</span>
                <select
                  value={form.incomingProtocol}
                  onChange={(e) =>
                    update("incomingProtocol", e.target.value as FormState["incomingProtocol"])
                  }
                  className="h-[46px] w-full rounded-[11px] border border-border-strong bg-surface px-3"
                >
                  <option value="IMAP">IMAP</option>
                  <option value="POP3">POP3</option>
                  <option value="JMAP">JMAP</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-[13px] font-medium text-text-2">Auth mode</span>
                <select
                  value={form.authMode}
                  onChange={(e) => update("authMode", e.target.value as FormState["authMode"])}
                  className="h-[46px] w-full rounded-[11px] border border-border-strong bg-surface px-3"
                >
                  <option value="PASSWORD">Password</option>
                  <option value="APP_PASSWORD">App password</option>
                  <option value="OAUTH">OAuth 2.0</option>
                </select>
              </label>
              <Input
                label="IMAP host"
                mono
                value={form.imapHost}
                onChange={(e) => update("imapHost", e.target.value)}
                placeholder="imap.aurelia.studio"
              />
              <Input
                label="IMAP port"
                mono
                value={form.imapPort}
                onChange={(e) => update("imapPort", e.target.value)}
              />
              <Input
                label="SMTP host"
                mono
                value={form.smtpHost}
                onChange={(e) => update("smtpHost", e.target.value)}
                placeholder="smtp.aurelia.studio"
              />
              <Input
                label="SMTP port"
                mono
                value={form.smtpPort}
                onChange={(e) => update("smtpPort", e.target.value)}
              />
              <Input
                label="Username"
                mono
                value={form.username}
                onChange={(e) => update("username", e.target.value)}
              />
              <Input
                label={form.authMode === "APP_PASSWORD" ? "App password" : "Password"}
                type="password"
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
              />
            </div>
            {form.authMode === "APP_PASSWORD" && (
              <p className="mt-4 rounded-[11px] border border-border bg-surface-2 px-4 py-3 text-[13px] text-text-2">
                Tip: create an app password in your provider&apos;s security settings. Your normal
                account password usually won&apos;t work with IMAP.
              </p>
            )}
            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button onClick={() => setStep(4)}>Continue</Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h1 className="text-[30px] font-semibold tracking-[-0.02em]">
              Contacts & calendar
            </h1>
            <p className="mt-3 text-[16px] text-text-2">
              Optional. CardDAV for contacts; CalDAV is wired for a future calendar surface.
            </p>
            <div className="mt-8 space-y-4">
              <Input
                label="CardDAV URL"
                mono
                value={form.cardDavUrl}
                onChange={(e) => update("cardDavUrl", e.target.value)}
                placeholder="https://dav.example.com/contacts"
              />
              <Input
                label="CalDAV URL"
                mono
                value={form.calDavUrl}
                onChange={(e) => update("calDavUrl", e.target.value)}
                placeholder="https://dav.example.com/calendars"
              />
            </div>
            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(3)}>
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setStep(5)}>
                  Skip
                </Button>
                <Button onClick={() => setStep(5)}>Continue</Button>
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <h1 className="text-[30px] font-semibold tracking-[-0.02em]">Test connection</h1>
            <p className="mt-3 text-[16px] text-text-2">
              We&apos;ll verify incoming and outgoing access, then check deliverability DNS.
            </p>
            <div className="mt-8 rounded-[14px] border border-border bg-surface p-5 text-[14px]">
              <div className="mono text-text-2">{form.email}</div>
              <div className="mt-2 text-text-3">
                {form.incomingProtocol} · {form.imapHost}:{form.imapPort} · SMTP{" "}
                {form.smtpHost}:{form.smtpPort}
              </div>
            </div>
            {error && <p className="mt-4 text-[13px] text-danger">{error}</p>}
            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(4)}>
                Back
              </Button>
              <Button onClick={testAndCreate} disabled={testing}>
                {testing ? "Testing…" : "Test & connect"}
              </Button>
            </div>
          </div>
        )}

        {step === 6 && (
          <div>
            <h1 className="text-[30px] font-semibold tracking-[-0.02em]">You&apos;re connected</h1>
            <p className="mt-3 text-[16px] text-text-2">
              Mail stays on your server. Disconnect any time — nothing is held hostage.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["MX", health?.mxOk],
                  ["SPF", health?.spfOk],
                  ["DKIM", health?.dkimOk],
                  ["DMARC", health?.dmarcOk],
                ] as const
              ).map(([label, ok]) => (
                <div
                  key={label}
                  className="rounded-[12px] border border-border bg-surface px-4 py-3"
                >
                  <div className="mono text-[12px] text-text-3">{label}</div>
                  <div
                    className={cn(
                      "mt-1 text-[14px] font-medium",
                      ok === true && "text-ok",
                      ok === false && "text-danger",
                      ok == null && "text-text-2",
                    )}
                  >
                    {ok === true ? "Healthy" : ok === false ? "Missing" : "Not checked"}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 flex justify-end">
              <Button onClick={() => router.push("/mail")}>Open inbox</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

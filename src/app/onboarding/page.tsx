"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Step = 1 | 2 | 3 | 4 | 5 | 6;
type PresetId = "gmail" | "outlook" | "custom";

type FormState = {
  connectType: "individual" | "domain";
  preset: PresetId | null;
  email: string;
  displayName: string;
  incomingProtocol: "IMAP" | "POP3" | "JMAP";
  authMode: "PASSWORD" | "APP_PASSWORD" | "OAUTH";
  username: string;
  password: string;
  imapHost: string;
  imapPort: string;
  pop3Host: string;
  pop3Port: string;
  jmapUrl: string;
  smtpHost: string;
  smtpPort: string;
  cardDavUrl: string;
  calDavUrl: string;
};

const PRESETS: Record<
  PresetId,
  {
    label: string;
    hint: string;
    values: Partial<FormState>;
  }
> = {
  gmail: {
    label: "Gmail",
    hint: "imap.gmail.com · app password required",
    values: {
      preset: "gmail",
      incomingProtocol: "IMAP",
      authMode: "APP_PASSWORD",
      imapHost: "imap.gmail.com",
      imapPort: "993",
      pop3Host: "pop.gmail.com",
      pop3Port: "995",
      smtpHost: "smtp.gmail.com",
      smtpPort: "587",
      jmapUrl: "",
    },
  },
  outlook: {
    label: "Outlook",
    hint: "outlook.office365.com · app password or OAuth",
    values: {
      preset: "outlook",
      incomingProtocol: "IMAP",
      authMode: "APP_PASSWORD",
      imapHost: "outlook.office365.com",
      imapPort: "993",
      pop3Host: "outlook.office365.com",
      pop3Port: "995",
      smtpHost: "smtp.office365.com",
      smtpPort: "587",
      jmapUrl: "",
    },
  },
  custom: {
    label: "Custom",
    hint: "Your own IMAP, POP3, or JMAP server",
    values: {
      preset: "custom",
      incomingProtocol: "IMAP",
      authMode: "PASSWORD",
      imapHost: "",
      imapPort: "993",
      pop3Host: "",
      pop3Port: "995",
      smtpHost: "",
      smtpPort: "587",
      jmapUrl: "",
    },
  },
};

const initial: FormState = {
  connectType: "individual",
  preset: null,
  email: "",
  displayName: "",
  incomingProtocol: "IMAP",
  authMode: "PASSWORD",
  username: "",
  password: "",
  imapHost: "",
  imapPort: "993",
  pop3Host: "",
  pop3Port: "995",
  jmapUrl: "",
  smtpHost: "",
  smtpPort: "587",
  cardDavUrl: "",
  calDavUrl: "",
};

type WorkspaceMemberOption = {
  role: string;
  user: { id: string; name?: string | null; email: string };
};

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>(initial);
  const [members, setMembers] = useState<WorkspaceMemberOption[]>([]);
  const [assignUserId, setAssignUserId] = useState<string>("");
  const [access, setAccess] = useState<"SHARED" | "PERSONAL">("SHARED");
  const [allowed, setAllowed] = useState(false);
  const [testing, setTesting] = useState(false);
  const [health, setHealth] = useState<{
    mxOk?: boolean;
    spfOk?: boolean;
    dmarcOk?: boolean;
    dkimOk?: boolean | null;
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("for") || "";
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/team");
      if (!res.ok) {
        router.replace("/mail");
        return;
      }
      const data = await res.json();
      if (cancelled) return;
      const isAdmin = data.role === "OWNER" || data.role === "ADMIN";
      if (!isAdmin) {
        router.replace("/mail");
        return;
      }
      const list = (data.members || []) as WorkspaceMemberOption[];
      setMembers(list);
      if (requested && list.some((member) => member.user.id === requested)) {
        setAssignUserId(requested);
      }
      setAllowed(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const assignable = members.filter(
    (member) => member.role === "MEMBER" && member.user.id !== session?.user?.id,
  );
  const assignee = assignable.find((member) => member.user.id === assignUserId)?.user;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function applyPreset(id: PresetId) {
    const preset = PRESETS[id];
    setForm((f) => ({
      ...f,
      ...preset.values,
      username: f.email || f.username,
    }));
    toast.success(`${preset.label} settings applied`, {
      description: preset.hint,
    });
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
          imapHost: form.imapHost || undefined,
          imapPort: Number(form.imapPort) || undefined,
          pop3Host: form.pop3Host || form.imapHost || undefined,
          pop3Port: Number(form.pop3Port) || undefined,
          jmapUrl: form.jmapUrl || undefined,
          smtpHost: form.smtpHost || undefined,
          smtpPort: Number(form.smtpPort) || undefined,
          cardDavUrl: form.cardDavUrl || undefined,
          calDavUrl: form.calDavUrl || undefined,
          assignUserId: assignee?.id,
          access,
          test: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Connection failed");
      setHealth(data.health || null);
      setStep(6);
      toast.success(assignee ? `Mailbox connected for ${assignee.name || assignee.email}` : "Mailbox connected");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setTesting(false);
    }
  }

  const hostSummary =
    form.incomingProtocol === "JMAP"
      ? form.jmapUrl || "JMAP URL not set"
      : form.incomingProtocol === "POP3"
        ? `${form.pop3Host || "—"}:${form.pop3Port} · SMTP ${form.smtpHost || "—"}:${form.smtpPort}`
        : `${form.imapHost || "—"}:${form.imapPort} · SMTP ${form.smtpHost || "—"}:${form.smtpPort}`;

  if (!allowed) {
    return <div className="min-h-dvh bg-bg" />;
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
              {assignee ? `Connect a mailbox for ${assignee.name || assignee.email}` : "Connect an account you own"}
            </h1>
            <p className="mt-3 max-w-[460px] text-[16px] leading-[1.55] text-text-2">
              {assignee
                ? "The member can read and send with this mailbox. They cannot add or remove connections."
                : "No migration, no new address. Point Mailslip at an existing mailbox."}
            </p>
            {assignable.length > 0 && (
              <label className="mt-6 block">
                <span className="mb-2 block text-[13px] font-medium text-text-2">
                  This mailbox is for
                </span>
                <select
                  value={assignUserId}
                  onChange={(e) => {
                    const next = e.target.value;
                    setAssignUserId(next);
                    if (next) update("connectType", "individual");
                  }}
                  className="h-[46px] w-full rounded-[11px] border border-border-strong bg-surface px-3"
                >
                  <option value="">Me</option>
                  {assignable.map((member) => (
                    <option key={member.user.id} value={member.user.id}>
                      {member.user.name || member.user.email} · {member.user.email}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <fieldset className="mt-6 space-y-3">
              <legend className="mb-2 text-[13px] font-medium text-text-2">Access</legend>
              <label className="flex cursor-pointer gap-3 rounded-[11px] border border-border-strong bg-surface p-3">
                <input
                  type="radio"
                  name="access"
                  className="mt-1"
                  checked={access === "SHARED"}
                  onChange={() => setAccess("SHARED")}
                />
                <span>
                  <span className="block text-[14px] font-medium text-text">Shared</span>
                  <span className="mt-0.5 block text-[13px] text-text-2">
                    Workspace admins can manage it and assign it to other profiles.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer gap-3 rounded-[11px] border border-border-strong bg-surface p-3">
                <input
                  type="radio"
                  name="access"
                  className="mt-1"
                  checked={access === "PERSONAL"}
                  onChange={() => setAccess("PERSONAL")}
                />
                <span>
                  <span className="block text-[14px] font-medium text-text">Personal</span>
                  <span className="mt-0.5 block text-[13px] text-text-2">
                    Only {assignee ? assignee.name || assignee.email : "you"} can use or control this
                    mailbox. No other profile can access it.
                  </span>
                </span>
              </label>
            </fieldset>
            <div className="mt-8 space-y-3.5">
              {(
                [
                  {
                    id: "individual" as const,
                    title: "Individual email address",
                    body: "A single inbox like you@gmail.com or hello@yourdomain.com.",
                  },
                  ...(assignee
                    ? []
                    : [
                        {
                          id: "domain" as const,
                          title: "Full domain",
                          body: "Connect a domain once; every address becomes a send-from identity.",
                        },
                      ]),
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
              Choose a provider preset to fill hosts and ports automatically.
            </p>
            <div className="mt-8 space-y-4">
              <Input
                label="Email address"
                mono
                value={form.email}
                onChange={(e) => {
                  const email = e.target.value;
                  setForm((f) => ({
                    ...f,
                    email,
                    username: !f.username || f.username === f.email ? email : f.username,
                  }));
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
                <div className="grid gap-2 sm:grid-cols-3">
                  {(Object.keys(PRESETS) as PresetId[]).map((id) => {
                    const preset = PRESETS[id];
                    const active = form.preset === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => applyPreset(id)}
                        className={cn(
                          "rounded-[11px] border px-3 py-3 text-left transition-colors",
                          active
                            ? "border-accent bg-accent-tint"
                            : "border-border-strong bg-surface hover:bg-hover",
                        )}
                      >
                        <div className="text-[13.5px] font-semibold">{preset.label}</div>
                        <div className="mt-1 text-[11px] leading-snug text-text-3">
                          {preset.hint}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {form.preset && (
                  <div className="mt-3 rounded-[11px] border border-border bg-surface-2 px-3 py-2 text-[12px] text-text-2 mono">
                    Applied: {hostSummary}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                onClick={() => {
                  if (!form.preset) applyPreset("custom");
                  setStep(3);
                }}
                disabled={!form.email.includes("@")}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="text-[30px] font-semibold tracking-[-0.02em]">Incoming & auth</h1>
            <p className="mt-3 text-[16px] text-text-2">
              Gmail and Outlook usually need an app password — not your normal login.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(Object.keys(PRESETS) as PresetId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => applyPreset(id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[12px] font-medium capitalize",
                    form.preset === id
                      ? "border-accent bg-accent-tint text-text"
                      : "border-border-strong text-text-2 hover:bg-hover",
                  )}
                >
                  {id}
                </button>
              ))}
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
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

              {form.incomingProtocol === "JMAP" ? (
                <div className="sm:col-span-2">
                  <Input
                    label="JMAP URL"
                    mono
                    value={form.jmapUrl}
                    onChange={(e) => update("jmapUrl", e.target.value)}
                    placeholder="https://api.fastmail.com/jmap/session"
                  />
                </div>
              ) : form.incomingProtocol === "POP3" ? (
                <>
                  <Input
                    label="POP3 host"
                    mono
                    value={form.pop3Host}
                    onChange={(e) => update("pop3Host", e.target.value)}
                    placeholder="pop.example.com"
                  />
                  <Input
                    label="POP3 port"
                    mono
                    value={form.pop3Port}
                    onChange={(e) => update("pop3Port", e.target.value)}
                  />
                </>
              ) : (
                <>
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
                </>
              )}

              {form.incomingProtocol !== "JMAP" && (
                <>
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
                </>
              )}

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
                Create an app password in your provider&apos;s security settings. Your normal
                account password usually won&apos;t work with IMAP/POP3.
              </p>
            )}
            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button
                onClick={() => setStep(4)}
                disabled={
                  !form.password ||
                  (form.incomingProtocol === "JMAP"
                    ? !form.jmapUrl
                    : form.incomingProtocol === "POP3"
                      ? !form.pop3Host || !form.smtpHost
                      : !form.imapHost || !form.smtpHost)
                }
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h1 className="text-[30px] font-semibold tracking-[-0.02em]">
              Contacts & calendar
            </h1>
            <p className="mt-3 text-[16px] text-text-2">
              Optional. CardDAV for contacts; CalDAV is stored for a future calendar surface.
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
                {form.incomingProtocol} · {hostSummary}
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
            <div className="mt-8 flex justify-end gap-2">
              {assignee && (
                <Button variant="secondary" onClick={() => router.push("/settings/team")}>
                  Back to team
                </Button>
              )}
              <Button onClick={() => router.push("/mail")}>Open inbox</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

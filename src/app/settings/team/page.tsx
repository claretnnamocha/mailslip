"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Member = {
  id: string;
  role: string;
  user: { id: string; name?: string | null; email: string };
};

export default function TeamSettingsPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [identities, setIdentities] = useState<{ id: string; email: string }[]>([]);
  const [grantIdentityIds, setGrantIdentityIds] = useState<string[]>([]);

  async function load() {
    const [teamRes, idRes] = await Promise.all([
      fetch("/api/team"),
      fetch("/api/identities"),
    ]);
    if (teamRes.ok) setMembers((await teamRes.json()).members || []);
    if (idRes.ok) setIdentities(await idRes.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function addPerson(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        role,
        requirePasswordChange: true,
        identityIds: role === "MEMBER" ? grantIdentityIds : [],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Could not add person");
      return;
    }
    setTempPassword(data.temporaryPassword);
    setName("");
    setEmail("");
    toast.success("Person provisioned — copy credentials now");
    load();
  }

  return (
    <div>
      <h1 className="text-[27px] font-semibold tracking-[-0.02em]">Team</h1>
      <p className="mt-2 text-[15px] text-text-2">
        Admin provisioning — create accounts and hand credentials out-of-band. Not an email invite.
      </p>

      <form
        onSubmit={addPerson}
        className="mt-8 max-w-xl space-y-4 rounded-2xl border border-border bg-surface p-6"
      >
        <h2 className="text-[15px] font-semibold">Add a person</h2>
        <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input
          label="Login email"
          mono
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <label className="block">
          <span className="mb-2 block text-[13px] font-medium text-text-2">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="h-[46px] w-full rounded-[11px] border border-border-strong bg-surface px-3"
          >
            <option value="MEMBER">Member</option>
            <option value="ADMIN">Admin</option>
          </select>
        </label>
        {role === "MEMBER" && (
          <div>
            <div className="mb-2 text-[13px] font-medium text-text-2">
              Grant mailboxes (allow-listed)
            </div>
            <div className="space-y-2">
              {identities.map((id) => (
                <label key={id.id} className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={grantIdentityIds.includes(id.id)}
                    onChange={(e) => {
                      setGrantIdentityIds((prev) =>
                        e.target.checked
                          ? [...prev, id.id]
                          : prev.filter((x) => x !== id.id),
                      );
                    }}
                  />
                  <span className="mono">{id.email}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <Button type="submit" size="sm">
          Create account
        </Button>
        {tempPassword && (
          <div className="rounded-[11px] border border-accent bg-accent-tint p-4 text-[13px]">
            <div className="font-medium">Temporary password (shown once)</div>
            <div className="mt-1 mono text-[15px]">{tempPassword}</div>
            <p className="mt-2 text-text-2">
              Copy and hand this to the person. They&apos;ll be required to change it on first
              sign-in.
            </p>
          </div>
        )}
      </form>

      <div className="mt-8 space-y-2">
        {members.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3"
          >
            <div>
              <div className="font-medium">{m.user.name || m.user.email}</div>
              <div className="mono text-[12px] text-text-3">{m.user.email}</div>
            </div>
            <span className="mono text-[11px] uppercase tracking-wide text-text-2">
              {m.role}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

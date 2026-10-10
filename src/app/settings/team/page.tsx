"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDialog } from "@/components/dialog-provider";
import { toast } from "sonner";

type Member = {
  id: string;
  role: string;
  identityIds: string[];
  user: { id: string; name?: string | null; email: string };
};

type Identity = { id: string; email: string; access?: "SHARED" | "PERSONAL" };

export default function TeamSettingsPage() {
  const { data: session } = useSession();
  const { confirm } = useDialog();
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [grantIdentityIds, setGrantIdentityIds] = useState<string[]>([]);
  const [viewerRole, setViewerRole] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const isAdmin = viewerRole === "OWNER" || viewerRole === "ADMIN";

  async function load() {
    const [teamRes, idRes] = await Promise.all([
      fetch("/api/team"),
      fetch("/api/identities"),
    ]);
    if (teamRes.ok) {
      const data = await teamRes.json();
      setMembers(data.members || []);
      setViewerRole(data.role ?? null);
    }
    if (idRes.ok) {
      const list = (await idRes.json()) as Identity[];
      // Personal mailboxes cannot be assigned to other profiles.
      setIdentities(list.filter((identity) => identity.access !== "PERSONAL"));
    }
  }

  useEffect(() => {
    load();
  }, []);

  function emailFor(id: string) {
    return identities.find((identity) => identity.id === id)?.email || id;
  }

  function toggle(list: string[], id: string, checked: boolean) {
    return checked ? [...list, id] : list.filter((item) => item !== id);
  }

  async function addPerson(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        role,
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
    setGrantIdentityIds([]);
    toast.success("Person provisioned — copy credentials now");
    load();
  }

  async function saveAssignments(userId: string) {
    setSaving(true);
    const res = await fetch(`/api/team/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identityIds: draftIds }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error(data.error || "Could not update mailboxes");
      return;
    }
    toast.success("Mailboxes updated");
    setEditingUserId(null);
    load();
  }

  async function removePerson(member: Member) {
    const ok = await confirm({
      title: `Remove ${member.user.name || member.user.email}?`,
      description:
        "Their login is deleted. Mailboxes stay in the workspace and can be assigned to someone else.",
      confirmLabel: "Remove person",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/team/${member.user.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Could not remove person");
      return;
    }
    toast.success("Person removed");
    if (editingUserId === member.user.id) setEditingUserId(null);
    load();
  }

  return (
    <div>
      <h1 className="text-[27px] font-semibold tracking-[-0.02em]">Team</h1>
      <p className="mt-2 text-[15px] text-text-2">
        Admin provisioning — create accounts and hand credentials out-of-band. Not an email invite.
      </p>

      {isAdmin && (
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
              Assign shared mailboxes. Personal ones stay with their owner and never appear here.
            </div>
            {identities.length === 0 ? (
              <p className="text-[13px] text-text-3">No shared mailboxes connected yet.</p>
            ) : (
              <div className="space-y-2">
                {identities.map((identity) => (
                  <label key={identity.id} className="flex items-center gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      checked={grantIdentityIds.includes(identity.id)}
                      onChange={(e) =>
                        setGrantIdentityIds((prev) => toggle(prev, identity.id, e.target.checked))
                      }
                    />
                    <span className="mono">{identity.email}</span>
                  </label>
                ))}
              </div>
            )}
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
      )}

      <div className="mt-8 space-y-2">
        {members.map((member) => {
          const canRemove =
            isAdmin &&
            member.role !== "OWNER" &&
            member.user.id !== session?.user?.id &&
            (member.role !== "ADMIN" || viewerRole === "OWNER");
          const editing = editingUserId === member.user.id;
          return (
            <div key={member.id} className="rounded-xl border border-border bg-surface px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{member.user.name || member.user.email}</div>
                  <div className="mono text-[12px] text-text-3">{member.user.email}</div>
                  {member.role === "MEMBER" && (
                    <div className="mt-2 text-[12px] text-text-2">
                      {member.identityIds.length === 0
                        ? "No mailboxes assigned"
                        : member.identityIds.map((id) => emailFor(id)).join(", ")}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {isAdmin && member.role === "MEMBER" && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditingUserId(editing ? null : member.user.id);
                          setDraftIds(member.identityIds);
                        }}
                      >
                        {editing ? "Close" : "Assign mailboxes"}
                      </Button>
                      <Link href={`/onboarding?for=${member.user.id}`}>
                        <Button size="sm" variant="secondary">
                          Connect mailbox
                        </Button>
                      </Link>
                    </>
                  )}
                  {canRemove && (
                    <Button size="sm" variant="danger" onClick={() => removePerson(member)}>
                      Remove
                    </Button>
                  )}
                  <span className="mono text-[11px] uppercase tracking-wide text-text-2">
                    {member.role}
                  </span>
                </div>
              </div>
              {editing && (
                <div className="mt-4 space-y-3 border-t border-border pt-4">
                  {identities.length === 0 ? (
                    <p className="text-[13px] text-text-3">No mailboxes connected yet.</p>
                  ) : (
                    identities.map((identity) => (
                      <label key={identity.id} className="flex items-center gap-2 text-[13px]">
                        <input
                          type="checkbox"
                          checked={draftIds.includes(identity.id)}
                          onChange={(e) =>
                            setDraftIds((prev) => toggle(prev, identity.id, e.target.checked))
                          }
                        />
                        <span className="mono">{identity.email}</span>
                      </label>
                    ))
                  )}
                  <Button size="sm" onClick={() => saveAssignments(member.user.id)} disabled={saving}>
                    {saving ? "Saving…" : "Save mailboxes"}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

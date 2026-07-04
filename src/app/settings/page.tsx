"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function ProfileSettingsPage() {
  const { data: session, update } = useSession();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(session?.user?.name || "");
  }, [session]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Failed");
      await update();
      toast.success("Profile updated");
    } catch {
      toast.error("Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-[27px] font-semibold tracking-[-0.02em]">Profile</h1>
      <p className="mt-2 text-[15px] text-text-2">
        Your Mailslip app account — separate from any mailbox you connect.
      </p>
      <div className="mt-8 max-w-lg space-y-4 rounded-2xl border border-border bg-surface p-6">
        <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          label="Email"
          mono
          value={session?.user?.email || ""}
          disabled
        />
        <Button onClick={save} disabled={saving} size="sm">
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

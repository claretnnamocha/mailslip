"use client";
import { FormEvent, useEffect, useState } from "react";
import { SettingsSection } from "@/components/settings/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
export default function SpamPage() {
  const [value, setValue] = useState("");
  const [blocked, setBlocked] = useState<{ id: string; value: string }[]>([]);
  async function load() {
    const res = await fetch("/api/settings/spam");
    if (res.ok) setBlocked((await res.json()).blocked || []);
  }
  useEffect(() => { load(); }, []);
  async function save(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/settings/spam", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value, list: "blocked" }),
    });
    if (!res.ok) return toast.error("Could not block");
    toast.success("Sender blocked");
    setValue("");
    load();
  }
  return (
    <SettingsSection title="Spam & blocking" description="Blocked senders/domains and always-allow list.">
      <form onSubmit={save} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1"><Input label="Sender or domain" mono value={value} onChange={(e) => setValue(e.target.value)} /></div>
        <Button size="sm" type="submit">Block</Button>
      </form>
      <div className="mt-6 space-y-2">
        {blocked.map((b) => <div key={b.id} className="rounded-xl border border-border px-4 py-3 mono text-[13px]">{b.value}</div>)}
      </div>
    </SettingsSection>
  );
}

"use client";

import { FormEvent, useEffect, useState } from "react";
import { SettingsSection } from "@/components/settings/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function SignaturesPage() {
  const [name, setName] = useState("Default");
  const [htmlBody, setHtmlBody] = useState("");
  const [items, setItems] = useState<{ id: string; name: string; htmlBody: string }[]>([]);

  async function load() {
    const res = await fetch("/api/settings/signatures");
    if (res.ok) setItems(await res.json());
  }
  useEffect(() => { load(); }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/settings/signatures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, htmlBody, isDefault: true }),
    });
    if (!res.ok) return toast.error("Could not save");
    toast.success("Signature saved");
    setHtmlBody("");
    load();
  }

  return (
    <SettingsSection title="Signatures" description="Per-identity rich-text signatures for outgoing mail.">
      <form onSubmit={save} className="space-y-4">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="block">
          <span className="mb-2 block text-[13px] font-medium text-text-2">Body (HTML)</span>
          <textarea value={htmlBody} onChange={(e) => setHtmlBody(e.target.value)} className="min-h-28 w-full rounded-[11px] border border-border-strong bg-surface p-3 text-[14px]" />
        </label>
        <Button size="sm" type="submit">Save signature</Button>
      </form>
      <div className="mt-6 space-y-2">
        {items.map((s) => (
          <div key={s.id} className="rounded-xl border border-border px-4 py-3">
            <div className="font-medium">{s.name}</div>
            <div className="mt-1 text-[13px] text-text-2" dangerouslySetInnerHTML={{ __html: s.htmlBody }} />
          </div>
        ))}
      </div>
    </SettingsSection>
  );
}

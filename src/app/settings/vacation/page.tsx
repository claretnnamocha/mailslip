"use client";
import { FormEvent, useState } from "react";
import { SettingsSection } from "@/components/settings/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
export default function VacationPage() {
  const [subject, setSubject] = useState("Out of office");
  const [body, setBody] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault();
    const identities = await fetch("/api/identities").then((r) => r.json());
    if (!identities[0]) return toast.error("Connect an identity first");
    const res = await fetch("/api/settings/vacation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identityId: identities[0].id, enabled: true, subject, body, contactsOnly: false }),
    });
    if (!res.ok) return toast.error("Could not save");
    toast.success("Vacation responder saved");
  }
  return (
    <SettingsSection title="Vacation responder" description="Server-side auto-reply with date range and contacts-only option.">
      <form onSubmit={save} className="space-y-4">
        <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <label className="block">
          <span className="mb-2 block text-[13px] font-medium text-text-2">Message</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-28 w-full rounded-[11px] border border-border-strong p-3" />
        </label>
        <Button size="sm" type="submit">Save responder</Button>
      </form>
    </SettingsSection>
  );
}

"use client";

import { FormEvent, useEffect, useState } from "react";
import { SettingsSection } from "@/components/settings/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function FiltersPage() {
  const [identities, setIdentities] = useState<{ id: string; email: string }[]>([]);
  const [identityId, setIdentityId] = useState("");
  const [name, setName] = useState("");
  const [field, setField] = useState("from");
  const [value, setValue] = useState("");
  const [action, setAction] = useState("move");
  const [target, setTarget] = useState("Archive");
  const [rules, setRules] = useState<{ id: string; name: string; enabled: boolean }[]>([]);

  useEffect(() => {
    fetch("/api/identities").then(async (r) => {
      if (!r.ok) return;
      const data = await r.json();
      setIdentities(data);
      if (data[0]) setIdentityId(data[0].id);
    });
    fetch("/api/settings/filters").then(async (r) => {
      if (r.ok) setRules(await r.json());
    });
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/settings/filters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identityId,
        name,
        conditions: { field, operator: "contains", value },
        actions: { action, target },
      }),
    });
    if (!res.ok) return toast.error("Could not save rule");
    toast.success("Filter saved (Sieve-ready)");
    setName("");
    setValue("");
    const list = await fetch("/api/settings/filters");
    if (list.ok) setRules(await list.json());
  }

  return (
    <SettingsSection title="Filters & rules" description="Server-side Sieve rules: When field matches, Then move / mark / star.">
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-2 block text-[13px] font-medium text-text-2">Identity</span>
          <select value={identityId} onChange={(e) => setIdentityId(e.target.value)} className="h-[46px] w-full rounded-[11px] border border-border-strong px-3">
            {identities.map((i) => <option key={i.id} value={i.id}>{i.email}</option>)}
          </select>
        </label>
        <Input label="Rule name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="When field" value={field} onChange={(e) => setField(e.target.value)} />
        <Input label="Contains" value={value} onChange={(e) => setValue(e.target.value)} />
        <Input label="Then action" value={action} onChange={(e) => setAction(e.target.value)} />
        <Input label="Target folder" value={target} onChange={(e) => setTarget(e.target.value)} />
        <div className="sm:col-span-2"><Button size="sm" type="submit">Add rule</Button></div>
      </form>
      <div className="mt-6 space-y-2">
        {rules.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-[13px]">
            <span>{r.name}</span>
            <span className="mono text-text-3">{r.enabled ? "on" : "off"}</span>
          </div>
        ))}
      </div>
    </SettingsSection>
  );
}

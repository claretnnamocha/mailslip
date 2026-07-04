"use client";
import { FormEvent, useEffect, useState } from "react";
import { SettingsSection } from "@/components/settings/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
export default function EncryptionPage() {
  const [email, setEmail] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [keys, setKeys] = useState<{ id: string; email: string }[]>([]);
  async function load() {
    const res = await fetch("/api/settings/encryption");
    if (res.ok) setKeys(await res.json());
  }
  useEffect(() => { load(); }, []);
  async function save(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/settings/encryption", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, publicKey }),
    });
    if (!res.ok) return toast.error("Could not save key");
    toast.success("PGP key stored");
    setPublicKey("");
    load();
  }
  return (
    <SettingsSection title="Encryption" description="PGP keys for encrypted compose, sign-by-default, and per-contact key status.">
      <form onSubmit={save} className="space-y-4">
        <Input label="Email" mono value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="block">
          <span className="mb-2 block text-[13px] font-medium text-text-2">Public key</span>
          <textarea value={publicKey} onChange={(e) => setPublicKey(e.target.value)} className="min-h-28 w-full rounded-[11px] border border-border-strong p-3 mono text-[12px]" />
        </label>
        <Button size="sm" type="submit">Add key</Button>
      </form>
      <div className="mt-6 space-y-2">
        {keys.map((k) => <div key={k.id} className="rounded-xl border border-border px-4 py-3 mono text-[13px]">{k.email}</div>)}
      </div>
    </SettingsSection>
  );
}

"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Contact = { id: string; name: string; email: string; company?: string | null };

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  async function load() {
    const res = await fetch("/api/contacts");
    if (res.ok) setContacts(await res.json());
  }
  useEffect(() => { load(); }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });
    if (!res.ok) return toast.error("Could not save contact");
    setName("");
    setEmail("");
    load();
  }

  return (
    <div className="min-h-dvh bg-bg">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <Logo size={26} />
        <Link href="/mail" className="text-[13px] font-medium text-accent">Back to inbox</Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-[27px] font-semibold tracking-[-0.02em]">Contacts</h1>
        <p className="mt-2 text-[15px] text-text-2">CardDAV-ready address book.</p>
        <form onSubmit={save} className="mt-8 grid gap-3 rounded-2xl border border-border bg-surface p-6 sm:grid-cols-2">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="Email" mono value={email} onChange={(e) => setEmail(e.target.value)} required />
          <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button size="sm" type="submit">Add contact</Button>
          <Button
            size="sm"
            type="button"
            variant="secondary"
            onClick={async () => {
              const res = await fetch("/api/contacts/sync", { method: "POST" });
              const data = await res.json();
              if (!res.ok) return toast.error(data.error || "Sync failed");
              toast.success(`Synced ${data.synced} contacts`);
              load();
            }}
          >
            Sync CardDAV
          </Button>
        </div>
        </form>
        <div className="mt-6 space-y-2">
          {contacts.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="mono text-[12px] text-text-3">{c.email}</div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

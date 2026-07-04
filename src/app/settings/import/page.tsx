"use client";

import { FormEvent, useEffect, useState } from "react";
import { SettingsSection } from "@/components/settings/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function ImportPage() {
  const [identities, setIdentities] = useState<{ id: string; email: string }[]>([]);
  const [identityId, setIdentityId] = useState("");
  const [sourceHost, setSourceHost] = useState("");
  const [sourceUser, setSourceUser] = useState("");
  const [sourcePassword, setSourcePassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/identities").then(async (r) => {
      if (!r.ok) return;
      const data = await r.json();
      setIdentities(data);
      if (data[0]) setIdentityId(data[0].id);
    });
  }, []);

  async function start(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/settings/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identityId,
          sourceHost,
          sourceUser,
          sourcePassword,
          sourcePort: 993,
          limit: 100,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      toast.success(`Imported ${data.copied} messages`, {
        description: data.message,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SettingsSection
      title="Import / migrate"
      description="IMAP-to-IMAP copy into a connected identity. Nothing is deleted at the source."
    >
      <form onSubmit={start} className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-[13px] font-medium text-text-2">
            Destination identity
          </span>
          <select
            value={identityId}
            onChange={(e) => setIdentityId(e.target.value)}
            className="h-[46px] w-full rounded-[11px] border border-border-strong px-3"
          >
            {identities.map((i) => (
              <option key={i.id} value={i.id}>
                {i.email}
              </option>
            ))}
          </select>
        </label>
        <Input
          label="Source IMAP host"
          mono
          value={sourceHost}
          onChange={(e) => setSourceHost(e.target.value)}
          placeholder="imap.old-provider.com"
          required
        />
        <Input
          label="Source username"
          mono
          value={sourceUser}
          onChange={(e) => setSourceUser(e.target.value)}
          required
        />
        <Input
          label="Source password"
          type="password"
          value={sourcePassword}
          onChange={(e) => setSourcePassword(e.target.value)}
          required
        />
        <Button size="sm" type="submit" disabled={loading || !identityId}>
          {loading ? "Importing…" : "Start import"}
        </Button>
      </form>
    </SettingsSection>
  );
}

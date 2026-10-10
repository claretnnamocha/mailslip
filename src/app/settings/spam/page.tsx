"use client";

import { FormEvent, useEffect, useState } from "react";
import { SettingsSection } from "@/components/settings/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function SpamPage() {
  const [value, setValue] = useState("");
  const [blocked, setBlocked] = useState<{ id: string; value: string }[]>([]);
  const [imageTrusted, setImageTrusted] = useState<string[]>([]);

  async function load() {
    const [spamRes, trustRes] = await Promise.all([
      fetch("/api/settings/spam"),
      fetch("/api/settings/image-trust"),
    ]);
    if (spamRes.ok) setBlocked((await spamRes.json()).blocked || []);
    if (trustRes.ok) setImageTrusted((await trustRes.json()).trusted || []);
  }

  useEffect(() => {
    void load();
  }, []);

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
    void load();
  }

  async function revokeImages(address: string) {
    const res = await fetch("/api/settings/image-trust", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });
    if (!res.ok) return toast.error("Could not update");
    toast.success("Remote images blocked again for this address");
    void load();
  }

  return (
    <div className="space-y-10">
      <SettingsSection
        title="Spam & blocking"
        description="Blocked senders/domains and always-allow list."
      >
        <form onSubmit={save} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="Sender or domain"
              mono
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <Button size="sm" type="submit">
            Block
          </Button>
        </form>
        <div className="mt-6 space-y-2">
          {blocked.map((b) => (
            <div key={b.id} className="rounded-xl border border-border px-4 py-3 mono text-[13px]">
              {b.value}
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Remote images"
        description="Addresses you chose to always load images from. You can also allow a sender from the reading pane."
      >
        {imageTrusted.length === 0 ? (
          <p className="text-[13px] text-text-3">No trusted senders yet.</p>
        ) : (
          <div className="space-y-2">
            {imageTrusted.map((address) => (
              <div
                key={address}
                className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
              >
                <span className="mono text-[13px]">{address}</span>
                <Button size="sm" variant="secondary" onClick={() => void revokeImages(address)}>
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}
      </SettingsSection>
    </div>
  );
}

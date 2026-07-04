"use client";

import { FormEvent, useEffect, useState } from "react";
import { SettingsSection } from "@/components/settings/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDialog } from "@/components/dialog-provider";
import { toast } from "sonner";

type KeyRow = {
  id: string;
  email: string;
  isDefault: boolean;
  hasPrivateKey: boolean;
};

export default function EncryptionPage() {
  const { alert } = useDialog();
  const [email, setEmail] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [keys, setKeys] = useState<KeyRow[]>([]);

  async function load() {
    const res = await fetch("/api/settings/encryption");
    if (res.ok) setKeys(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!publicKey.includes("BEGIN PGP PUBLIC KEY")) {
      await alert({
        title: "Invalid public key",
        description: "Paste a full ASCII-armored PGP public key block.",
      });
      return;
    }
    if (privateKey && !privateKey.includes("BEGIN PGP PRIVATE KEY")) {
      await alert({
        title: "Invalid private key",
        description: "Paste a full ASCII-armored PGP private key block, or leave it blank.",
      });
      return;
    }

    const res = await fetch("/api/settings/encryption", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.toLowerCase(),
        publicKey,
        privateKey: privateKey || undefined,
        isDefault,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return toast.error(data.error || "Could not save key");
    }
    toast.success("PGP key stored");
    setPublicKey("");
    setPrivateKey("");
    setIsDefault(false);
    load();
  }

  return (
    <SettingsSection
      title="Encryption"
      description="Store recipient public keys to encrypt mail, and your private key to decrypt and sign. Private keys are encrypted at rest."
    >
      <form onSubmit={save} className="space-y-4">
        <Input
          label="Email"
          mono
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="person@example.com"
          required
        />
        <label className="block">
          <span className="mb-2 block text-[13px] font-medium text-text-2">Public key</span>
          <textarea
            value={publicKey}
            onChange={(e) => setPublicKey(e.target.value)}
            className="min-h-28 w-full rounded-[11px] border border-border-strong p-3 mono text-[12px]"
            placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----"
            required
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-[13px] font-medium text-text-2">
            Private key (optional — for decrypt / sign)
          </span>
          <textarea
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            className="min-h-28 w-full rounded-[11px] border border-border-strong p-3 mono text-[12px]"
            placeholder="-----BEGIN PGP PRIVATE KEY BLOCK-----"
          />
        </label>
        <label className="flex items-center gap-2 text-[13px] text-text-2">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
          />
          Use as default signing / decrypt key
        </label>
        <Button size="sm" type="submit">
          Add key
        </Button>
      </form>

      <div className="mt-6 space-y-2">
        {keys.length === 0 && (
          <p className="text-[14px] text-text-2">
            No keys yet. Add a recipient&apos;s public key to encrypt to them, and your own
            private key to decrypt replies.
          </p>
        )}
        {keys.map((k) => (
          <div
            key={k.id}
            className="flex items-center justify-between rounded-xl border border-border px-4 py-3"
          >
            <div>
              <div className="mono text-[13px]">{k.email}</div>
              <div className="mt-0.5 text-[12px] text-text-3">
                Public key
                {k.hasPrivateKey ? " · private key on file" : ""}
                {k.isDefault ? " · default" : ""}
              </div>
            </div>
          </div>
        ))}
      </div>
    </SettingsSection>
  );
}

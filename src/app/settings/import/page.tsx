"use client";
import { SettingsSection } from "@/components/settings/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
export default function ImportPage() {
  return (
    <SettingsSection title="Import / migrate" description="IMAP-to-IMAP copy or mbox upload. Nothing is deleted at the source.">
      <div className="space-y-4">
        <Input label="Source IMAP host" mono placeholder="imap.old-provider.com" />
        <Input label="Source username" mono />
        <Input label="Source password" type="password" />
        <Button size="sm" onClick={() => toast.message("Import queued", { description: "Source mail is never deleted." })}>Start import</Button>
      </div>
    </SettingsSection>
  );
}

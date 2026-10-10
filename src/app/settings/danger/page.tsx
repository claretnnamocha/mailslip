"use client";

import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/dialog-provider";
import { clientSignOut } from "@/lib/client-sign-out";
import { toast } from "sonner";

export default function DangerSettingsPage() {
  const { confirm } = useDialog();

  async function deleteAccount() {
    const ok = await confirm({
      title: "Delete your Mailslip account?",
      description:
        "Only your Mailslip profile and connection settings are removed. Mail on your own servers is never touched.",
      confirmLabel: "Delete account",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch("/api/settings/danger", { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not delete account");
      return;
    }
    toast.success("Account deleted");
    await clientSignOut("/login");
  }

  return (
    <div>
      <h1 className="text-[27px] font-semibold tracking-[-0.02em]">Danger zone</h1>
      <p className="mt-2 text-[15px] text-text-2">
        Zero lock-in. Disconnecting or deleting never touches mail on your servers.
      </p>

      <div className="mt-8 max-w-xl space-y-4">
        <div className="rounded-2xl border border-danger/30 bg-surface p-6">
          <h2 className="font-semibold text-danger">Delete account</h2>
          <p className="mt-2 text-[14px] text-text-2">
            Removes your Mailslip profile, workspace membership, and stored connection settings.
            Your mailboxes on IMAP/POP3/JMAP servers are untouched.
          </p>
          <Button size="sm" variant="danger" className="mt-4" onClick={deleteAccount}>
            Delete my account
          </Button>
        </div>
      </div>
    </div>
  );
}

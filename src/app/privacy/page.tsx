import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";

export const metadata: Metadata = {
  title: { absolute: "Privacy policy — Mailslip" },
};

export default function PrivacyPage() {
  return (
    <LegalDocument title="Privacy policy" updated="14 October 2026">
      <p>
        Mailslip is an email client. It connects to mailboxes you already own. It does not host
        those mailboxes, and it does not ask you to move your mail to a new address.
      </p>
      <h2>Account</h2>
      <p>
        When you create a Mailslip account we store your name, email address, and a hash of your
        password. If you sign in through a workspace, we store your membership and role.
      </p>
      <h2>Mailboxes you connect</h2>
      <p>
        For a password or app-password mailbox, the secret is encrypted before it is stored and is
        used only to sign in to that mailbox.
      </p>
      <p>
        For Gmail, you sign in with Google. Mailslip requests access to the mailbox so it can read
        and send mail. Google gives us a refresh token, not your Google password. That token is
        encrypted and used only to open the mailbox you connected. You can disconnect the mailbox
        in Mailslip at any time. Disconnecting deletes the stored token. You can also remove
        Mailslip from your Google account.
      </p>
      <h2>Mail</h2>
      <p>
        Messages stay on your mail provider. Mailslip loads them when you read, search, or send.
        We do not sell mailbox contents, and we do not use them to advertise.
      </p>
      <h2>Contact</h2>
      <p>
        Questions about this policy: <a href="mailto:tech@uselinqr.io">tech@uselinqr.io</a>.
      </p>
    </LegalDocument>
  );
}

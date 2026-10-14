import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";

export const metadata: Metadata = {
  title: { absolute: "Terms of service — Mailslip" },
};

export default function TermsPage() {
  return (
    <LegalDocument title="Terms of service" updated="14 October 2026">
      <p>
        Mailslip lets you read and send mail from mailboxes you already control. By using it, you
        agree to these terms.
      </p>
      <h2>Your mailboxes</h2>
      <p>
        You may connect an address only if you are allowed to use it. You are responsible for the
        mail you send and for keeping your Mailslip account secure.
      </p>
      <h2>The service</h2>
      <p>
        Mailslip is a client. Delivery, storage, and spam filtering stay with the mailbox provider.
        We may change or suspend the service, and we may close an account that abuses it or breaks
        these terms.
      </p>
      <h2>Disconnecting</h2>
      <p>
        You can disconnect a mailbox at any time. Mail already stored by your provider is not
        deleted when you disconnect.
      </p>
      <h2>Contact</h2>
      <p>
        Questions about these terms: <a href="mailto:tech@uselinqr.io">tech@uselinqr.io</a>.
      </p>
    </LegalDocument>
  );
}

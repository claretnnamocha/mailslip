import { pageTitle } from "@/lib/page-meta";

export const metadata = pageTitle("Inbox");

export default function MailLayout({ children }: { children: React.ReactNode }) {
  return children;
}

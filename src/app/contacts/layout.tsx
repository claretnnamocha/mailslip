import { pageTitle } from "@/lib/page-meta";

export const metadata = pageTitle("Contacts");

export default function ContactsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

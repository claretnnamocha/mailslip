import { pageTitle } from "@/lib/page-meta";

export const metadata = pageTitle("Mail identities");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

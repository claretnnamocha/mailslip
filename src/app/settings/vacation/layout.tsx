import { pageTitle } from "@/lib/page-meta";

export const metadata = pageTitle("Vacation responder");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

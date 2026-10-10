import { pageTitle } from "@/lib/page-meta";

export const metadata = pageTitle("Storage");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

import { pageTitle } from "@/lib/page-meta";

export const metadata = pageTitle("Appearance");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

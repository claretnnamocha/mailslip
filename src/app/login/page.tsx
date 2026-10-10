import { resolveHosting } from "@/lib/hosting";
import { pageTitle } from "@/lib/page-meta";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export const metadata = pageTitle("Sign in");

export default async function LoginPage() {
  const { allowSignup } = await resolveHosting();
  return <LoginForm allowSignup={allowSignup} />;
}

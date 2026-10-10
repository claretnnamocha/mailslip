import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { resolveHosting } from "@/lib/hosting";
import { pageTitle } from "@/lib/page-meta";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export const metadata = pageTitle("Sign in");

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect(session.user.mustChangePassword ? "/change-password" : "/mail");
  }
  const { allowSignup } = await resolveHosting();
  return <LoginForm allowSignup={allowSignup} />;
}

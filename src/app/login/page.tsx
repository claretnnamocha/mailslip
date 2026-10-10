import { allowsPublicSignup } from "@/lib/hosting";
import { pageTitle } from "@/lib/page-meta";
import { LoginForm } from "./login-form";

export const metadata = pageTitle("Sign in");

export default function LoginPage() {
  return <LoginForm allowSignup={allowsPublicSignup()} />;
}

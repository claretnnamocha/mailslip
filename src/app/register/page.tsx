import { redirect } from "next/navigation";
import { resolveHosting } from "@/lib/hosting";
import { pageTitle } from "@/lib/page-meta";
import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";
export const metadata = pageTitle("Create account");

export default async function RegisterPage() {
  const { allowSignup } = await resolveHosting();
  if (!allowSignup) redirect("/login");
  return <RegisterForm />;
}

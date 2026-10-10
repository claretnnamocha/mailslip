import { redirect } from "next/navigation";
import { allowsPublicSignup } from "@/lib/hosting";
import { pageTitle } from "@/lib/page-meta";
import { RegisterForm } from "./register-form";

export const metadata = pageTitle("Create account");

export default function RegisterPage() {
  if (!allowsPublicSignup()) redirect("/login");
  return <RegisterForm />;
}

import { redirect } from "next/navigation";
import { allowsPublicSignup } from "@/lib/hosting";
import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  if (!allowsPublicSignup()) redirect("/login");
  return <RegisterForm />;
}

export type HostingMode = "cloud" | "self-hosted";

/** Cloud shows the landing page and public signup. Self-hosted is sign-in only. */
export function hostingMode(): HostingMode {
  const raw = (process.env.MAILSLIP_MODE || "cloud").trim().toLowerCase().replace(/_/g, "-");
  if (raw === "self-hosted" || raw === "selfhosted") return "self-hosted";
  return "cloud";
}

export function allowsPublicSignup() {
  return hostingMode() === "cloud";
}

"use client";

import { signOut } from "next-auth/react";

/**
 * Clear the session, then navigate on the current host.
 * Auth.js callback redirects use server baseUrl (often the platform entry
 * behind Cloudflare for SaaS) — avoid that so slug/BYOD hosts stay put.
 */
export async function clientSignOut(callbackPath = "/login") {
  await signOut({ redirect: false });
  const path = callbackPath.startsWith("/") ? callbackPath : `/${callbackPath}`;
  window.location.assign(path);
}

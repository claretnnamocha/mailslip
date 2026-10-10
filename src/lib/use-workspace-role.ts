"use client";

import { useEffect, useState } from "react";
import { clientSignOut } from "@/lib/client-sign-out";

export function useWorkspaceRole() {
  const [role, setRole] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/team")
      .then(async (response) => {
        if (response.status === 401) {
          await clientSignOut("/login");
          return null;
        }
        return response.ok ? response.json() : null;
      })
      .then((data) => {
        if (cancelled) return;
        setRole(typeof data?.role === "string" ? data.role : null);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    role,
    ready,
    isAdmin: role === "OWNER" || role === "ADMIN",
  };
}

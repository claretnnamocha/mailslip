"use client";

import { useEffect, useState } from "react";

export function useWorkspaceRole() {
  const [role, setRole] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/team")
      .then(async (response) => (response.ok ? response.json() : null))
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

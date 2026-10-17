"use client";

import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { registerMailslipWorker } from "@/lib/pwa";

export function PwaProvider() {
  const { status } = useSession();

  useEffect(() => {
    void registerMailslipWorker();
  }, []);

  useEffect(() => {
    if (status !== "unauthenticated") return;
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.ready.then(async (registration) => {
      const sub = await registration.pushManager.getSubscription();
      if (sub) await sub.unsubscribe().catch(() => undefined);
    });
  }, [status]);

  return null;
}

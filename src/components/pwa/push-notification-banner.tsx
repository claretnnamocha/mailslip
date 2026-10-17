"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  isIosDevice,
  isStandaloneDisplay,
  pushIsSupported,
  savePushSubscription,
  subscribeToPush,
} from "@/lib/pwa";

function subscribeNoop() {
  return () => undefined;
}

export function PushNotificationBanner() {
  const { status } = useSession();
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [installed, setInstalled] = useState(false);
  const standalone =
    useSyncExternalStore(subscribeNoop, isStandaloneDisplay, () => false) || installed;
  const ios = useSyncExternalStore(subscribeNoop, isIosDevice, () => false);
  const pushOk = useSyncExternalStore(subscribeNoop, pushIsSupported, () => false);
  const permission = useSyncExternalStore(
    subscribeNoop,
    () => ("Notification" in window ? Notification.permission : "denied"),
    () => "default" as NotificationPermission,
  );

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/notifications");
      if (res.ok) {
        const data = (await res.json()) as { subscribed?: boolean };
        setSubscribed(Boolean(data.subscribed));
        return;
      }
    } catch {
      // fall through
    }
    if (pushOk && "serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.getSubscription();
        setSubscribed(Boolean(sub));
      } catch {
        setSubscribed(false);
      }
    } else {
      setSubscribed(false);
    }
  }, [pushOk]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings/notifications");
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json()) as { subscribed?: boolean };
          setSubscribed(Boolean(data.subscribed));
          return;
        }
      } catch {
        if (cancelled) return;
      }
      if (!pushOk || !("serviceWorker" in navigator)) {
        if (!cancelled) setSubscribed(false);
        return;
      }
      try {
        const registration = await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.getSubscription();
        if (!cancelled) setSubscribed(Boolean(sub));
      } catch {
        if (!cancelled) setSubscribed(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, pushOk]);

  useEffect(() => {
    const onInstalled = () => setInstalled(true);
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  async function enablePush() {
    setBusy(true);
    try {
      const sub = await subscribeToPush();
      await savePushSubscription(sub);
      toast.success("Notifications on — we’ll alert you for new mail");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not enable notifications");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (status !== "authenticated" || subscribed === null) return null;

  const pushLive = subscribed && permission === "granted";
  if (pushLive) return null;

  const iosNeedsInstall = ios && !standalone;

  if (!pushOk && !iosNeedsInstall) return null;

  if (iosNeedsInstall) {
    return (
      <div
        role="status"
        className="border-b border-accent/20 bg-accent-tint px-4 py-3 text-[13.5px] text-text"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="font-medium">Get mail alerts on this iPhone or iPad.</span>{" "}
            Add Mailslip to your home screen, then turn on notifications.
          </p>
          <Link
            href="/settings/notifications"
            className="shrink-0 text-[13px] font-medium text-accent hover:underline"
          >
            How to install
          </Link>
        </div>
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div
        role="status"
        className="border-b border-border bg-surface-2 px-4 py-3 text-[13.5px] text-text-2"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Notifications are blocked in your browser. Allow them for Mailslip to get alerts when
            you&apos;re away.
          </p>
          <Link
            href="/settings/notifications"
            className="shrink-0 text-[13px] font-medium text-accent hover:underline"
          >
            Open notification settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="border-b border-accent/25 bg-accent-tint px-4 py-3 text-[13.5px] text-text"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="font-medium">Turn on push notifications</span> so new mail can reach you
          even when Mailslip is in the background.
        </p>
        <Button size="sm" disabled={busy} onClick={() => void enablePush()}>
          Turn on notifications
        </Button>
      </div>
    </div>
  );
}

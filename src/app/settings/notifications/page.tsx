"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import {
  isIosDevice,
  isStandaloneDisplay,
  playNotifySound,
  pushIsSupported,
  removePushSubscription,
  savePushSubscription,
  subscribeToPush,
} from "@/lib/pwa";

function subscribeNoop() {
  return () => undefined;
}

type IdentityPref = {
  id: string;
  email: string;
  displayName?: string | null;
  color: string;
  desktop: boolean;
  sound: boolean;
};

type Prefs = {
  badge: boolean;
  subscribed: boolean;
  identities: IdentityPref[];
};

export default function NotificationsPage() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const standalone = useSyncExternalStore(subscribeNoop, isStandaloneDisplay, () => false) || installed;
  const ios = useSyncExternalStore(subscribeNoop, isIosDevice, () => false);
  const pushOk = useSyncExternalStore(subscribeNoop, pushIsSupported, () => false);
  const permission = useSyncExternalStore(
    subscribeNoop,
    () => ("Notification" in window ? Notification.permission : "denied"),
    () => "default" as NotificationPermission,
  );

  const load = useCallback(async () => {
    const res = await fetch("/api/settings/notifications");
    if (res.ok) setPrefs(await res.json());
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/notifications")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Prefs | null) => {
        if (!cancelled && data) setPrefs(data);
      })
      .catch(() => undefined);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      setInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      cancelled = true;
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function patch(body: Record<string, unknown>) {
    const res = await fetch("/api/settings/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("save failed");
    await load();
  }

  async function enablePush() {
    setBusy(true);
    try {
      const sub = await subscribeToPush();
      await savePushSubscription(sub);
      toast.success("Desktop notifications on");
      await load();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not enable notifications");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    try {
      await removePushSubscription();
      toast.success("Desktop notifications off");
      await load();
    } catch {
      toast.error("Could not turn notifications off");
    } finally {
      setBusy(false);
    }
  }

  async function toggleDesktop(identity: IdentityPref, next: boolean) {
    if (next && Notification.permission !== "granted") {
      const ok = await enablePush();
      if (!ok) return;
    }
    try {
      await patch({ identityId: identity.id, desktop: next });
    } catch {
      toast.error("Could not save");
    }
  }

  async function toggleSound(identity: IdentityPref, next: boolean) {
    try {
      await patch({ identityId: identity.id, sound: next });
      if (next) playNotifySound();
    } catch {
      toast.error("Could not save");
    }
  }

  async function toggleBadge(next: boolean) {
    try {
      await patch({ badge: next });
      if (!next && "clearAppBadge" in navigator) {
        await (navigator as Navigator & { clearAppBadge?: () => Promise<void> }).clearAppBadge?.();
      }
    } catch {
      toast.error("Could not save");
    }
  }

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const result = await installEvent.userChoice;
    if (result.outcome === "accepted") {
      setInstallEvent(null);
      setStandalone(true);
    }
  }

  async function sendTest() {
    setBusy(true);
    try {
      if (Notification.permission !== "granted") {
        const ok = await enablePush();
        if (!ok) return;
      }
      const res = await fetch("/api/push/test", { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Test failed");
      }
      toast.success("Test notification sent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Test failed");
    } finally {
      setBusy(false);
    }
  }

  const pushLive = prefs?.subscribed && permission === "granted";
  const iosNeedsInstall = ios && !standalone;

  return (
    <div>
      <h1 className="text-[27px] font-semibold tracking-[-0.02em]">Notifications</h1>
      <p className="mt-2 text-[15px] text-text-2">Tune what interrupts you, per identity.</p>

      <section className="mt-8 rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-[15px] font-semibold">Install app</h2>
        <p className="mt-1 text-[13.5px] text-text-2">
          Add Mailslip to your home screen for a full-screen client and background alerts.
        </p>
        {standalone ? (
          <p className="mt-4 text-[14px] text-ok">Installed on this device.</p>
        ) : ios ? (
          <p className="mt-4 text-[14px] leading-relaxed text-text-2">
            On iPhone or iPad, tap Share, then <span className="font-medium text-text">Add to Home Screen</span>.
            Notifications work once you open Mailslip from that icon.
          </p>
        ) : installEvent ? (
          <Button className="mt-4" size="sm" onClick={() => void install()}>
            Install Mailslip
          </Button>
        ) : (
          <p className="mt-4 text-[14px] text-text-2">
            Use your browser&apos;s install option in the address bar, or open this site over HTTPS.
          </p>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-semibold">Desktop push</h2>
            <p className="mt-1 text-[13.5px] text-text-2">
              Alerts for new mail even when Mailslip is in the background.
            </p>
          </div>
          <Toggle
            label="Desktop push"
            checked={Boolean(pushLive)}
            disabled={busy || iosNeedsInstall || !pushOk}
            onChange={(next) => void (next ? enablePush() : disablePush())}
          />
        </div>
        {iosNeedsInstall && (
          <p className="mt-3 text-[13px] text-text-3">Install to the home screen first to enable push on iOS.</p>
        )}
        {!pushOk && !iosNeedsInstall && (
          <p className="mt-3 text-[13px] text-text-3">This browser does not support web push.</p>
        )}
        {permission === "denied" && (
          <p className="mt-3 text-[13px] text-danger">Notifications are blocked in the browser settings.</p>
        )}
        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <span className="text-[14px]">Unread badge</span>
          <Toggle
            label="Unread badge"
            checked={prefs?.badge !== false}
            onChange={(next) => void toggleBadge(next)}
          />
        </div>
        <div className="mt-4">
          <Button size="sm" variant="secondary" disabled={busy || !pushOk} onClick={() => void sendTest()}>
            Send test notification
          </Button>
        </div>
      </section>

      <div className="mt-6 space-y-4">
        {(prefs?.identities || []).map((identity) => (
          <section key={identity.id} className="rounded-2xl border border-border-strong bg-surface px-5 py-4">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-full" style={{ background: identity.color }} />
              <span className="mono text-[13px] font-semibold">{identity.email}</span>
            </div>
            <div className="flex items-center justify-between border-b border-border py-2.5">
              <span className="text-[14px]">Desktop push for new mail</span>
              <Toggle
                label={`Desktop push for ${identity.email}`}
                checked={identity.desktop}
                disabled={busy}
                onChange={(next) => void toggleDesktop(identity, next)}
              />
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-[14px]">Sound</span>
              <Toggle
                label={`Sound for ${identity.email}`}
                checked={identity.sound}
                onChange={(next) => void toggleSound(identity, next)}
              />
            </div>
          </section>
        ))}
        {prefs && prefs.identities.length === 0 && (
          <p className="text-[14px] text-text-2">Connect a mailbox to choose per-identity alerts.</p>
        )}
      </div>
    </div>
  );
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

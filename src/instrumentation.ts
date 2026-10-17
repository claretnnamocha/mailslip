export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureVapidKeys } = await import("./lib/push");
  void ensureVapidKeys().catch((error) => {
    console.warn("[mailslip] VAPID bootstrap failed (retry on first push):", error);
  });
  const { startMailNotifier } = await import("./lib/mail/notify");
  startMailNotifier();
}

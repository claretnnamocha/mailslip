export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startMailNotifier } = await import("./lib/mail/notify");
  startMailNotifier();
}

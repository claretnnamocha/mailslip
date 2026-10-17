const CACHE = "mailslip-pwa-v1";
const PRECACHE = ["/offline", "/logo-192.png", "/logo-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

function shouldCache(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/offline" ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".ico")
  );
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(event.request);
        if (response.ok && shouldCache(url)) {
          const cache = await caches.open(CACHE);
          cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === "navigate") {
          const offline = await caches.match("/offline");
          if (offline) return offline;
        }
        throw new Error("offline");
      }
    })(),
  );
});

self.addEventListener("push", (event) => {
  event.waitUntil(handlePush(event));
});

async function handlePush(event) {
  let payload = { title: "New mail", body: "You have a new message." };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }

  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of clients) {
    client.postMessage({ type: "new-mail", payload });
  }
  const focused = clients.some((client) => client.focused);
  if (focused && !payload.force) return;

  const url = payload.url || "/mail";
  await self.registration.showNotification(payload.title || "New mail", {
    body: payload.body || "",
    icon: payload.icon || "/logo-192.png",
    badge: payload.badge || "/logo-192.png",
    tag: payload.tag || "mailslip-mail",
    renotify: Boolean(payload.renotify),
    data: { url, identityId: payload.identityId || null },
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/mail";
  event.waitUntil(openOrFocus(target, event.notification.data || {}));
});

async function openOrFocus(url, data) {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of clients) {
    const sameOrigin = client.url.startsWith(self.location.origin);
    if (!sameOrigin) continue;
    client.postMessage({ type: "open-mail", ...data });
    if ("focus" in client) return client.focus();
  }
  return self.clients.openWindow(url);
}

// MODO web push service worker.
// Purpose: receive push events and display notifications.
// No offline caching, no fetch handler — safe to install without wedging previews.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    try {
      payload = { title: "MODO", body: event.data ? event.data.text() : "" };
    } catch (__) {}
  }

  const title = payload.title || "MODO";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icon-192.png",
    badge: payload.badge || "/icon-192.png",
    tag: payload.tag || undefined,
    renotify: !!payload.tag,
    data: { url: payload.url || "/dashboard" },
    vibrate: [80, 40, 80],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        try {
          const u = new URL(c.url);
          if (u.origin === self.location.origin && "focus" in c) {
            c.navigate(url).catch(() => {});
            return c.focus();
          }
        } catch (_) {}
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});

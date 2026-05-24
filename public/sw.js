// Tee Time Tracker service worker.
// Primary purpose: handle Web Push so devices can receive 1h reminders and
// other notifications even when the PWA isn't in the foreground.
const SW_VERSION = "1";

self.addEventListener("install", () => {
  // Activate immediately on first install/update so push starts working on
  // the user's next page load without a manual refresh.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Tee Time Tracker", body: event.data.text() };
  }
  const { title = "Tee Time Tracker", body = "", url = "/tee-times", tag } =
    payload;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag,
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? "/tee-times";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Prefer an already-open client at the right path; otherwise focus any
      // tab and navigate it; otherwise open a new window.
      for (const c of all) {
        if (c.url.endsWith(target) && "focus" in c) {
          return c.focus();
        }
      }
      for (const c of all) {
        if ("navigate" in c && "focus" in c) {
          await c.navigate(target);
          return c.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(target);
      }
    })()
  );
});

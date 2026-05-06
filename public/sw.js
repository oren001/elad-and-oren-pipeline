/* halviinim service worker */

const CACHE = "halviinim-v3-round2";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // pass through; PWA shell only
});

self.addEventListener("push", (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch (_) {
    data = { title: "הלווינים", body: e.data ? e.data.text() : "" };
  }
  const title = data.title || "הלווינים";
  const options = {
    body: data.body || "",
    icon: "/icon",
    badge: "/icon",
    tag: data.tag || "halviinim",
    data: { url: data.url || "/" },
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((wins) => {
        for (const w of wins) {
          if ("focus" in w) return w.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      }),
  );
});

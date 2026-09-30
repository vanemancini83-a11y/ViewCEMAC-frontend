// ✅ ViewCEMAC — Service Worker v14
// À BUMPER à CHAQUE déploiement qui modifie app.js / styles.css / index.html.
const CACHE_NAME = "viewcemac-v14";
const CORE_ASSETS = [
  "/", "/index.html", "/styles.css", "/app.js", "/manifest.json",
  "/auth.html", "/auth.js", "/compte.html", "/compte.js", "/privacy.html",
  "/detail.html", "/detail.js",
  "/icons/viewcemac-icon-192.png", "/icons/viewcemac-icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(CORE_ASSETS)));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(caches.match(e.request).then((c) => c || fetch(e.request)));
});

// ✅ #17 : réception d'une notification push (app ouverte OU fermée)
self.addEventListener("push", (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = { title: "ViewCEMAC", body: e.data ? e.data.text() : "" };
  }
  e.waitUntil(
    self.registration.showNotification(data.title || "ViewCEMAC", {
      body: data.body || "",
      icon: data.icon || "/icons/viewcemac-icon-192.png",
      badge: data.badge || "/icons/viewcemac-icon-192.png",
      data: data.data || {},
    })
  );
});

// ✅ #17 : clic sur la notification → ouvre l'app
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "https://viewcemac.vercel.app";
  e.waitUntil(clients.openWindow(url));
});

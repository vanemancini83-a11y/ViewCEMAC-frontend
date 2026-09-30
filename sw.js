// ✅ ViewCEMAC — Service Worker v10
// À BUMPER à CHAQUE déploiement qui modifie app.js / styles.css / index.html.
const CACHE_NAME = "viewcemac-v13";
const CORE_ASSETS = [
  "/", "/index.html", "/styles.css", "/app.js", "/manifest.json",
  "/auth.html", "/auth.js", "/compte.html", "/compte.js", "/privacy.html", "/detail.html", "/detail.js",
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

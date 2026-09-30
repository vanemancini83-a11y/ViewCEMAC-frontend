// ✅ ViewCEMAC — Service Worker corrigé
// Changements :
//  1. CACHE_NAME bumpé en v9 (à incrémenter à CHAQUE déploiement qui touche
//     app.js / styles.css / index.html — sinon les utilisateurs gardent
//     l'ancienne version indéfiniment).
//  2. Suppression du code mort : le test url.pathname.startsWith("/api/")
//     ne pouvait JAMAIS matcher, car l'API vit sur tradinggab-backend-2.onrender.com
//     (autre domaine) — ces requêtes ne traversent jamais ce service worker.
//  3. On n'intercepte que les GET same-origin : les requêtes cross-origin
//     (polices Google Fonts, API Render) passent directement au réseau.
const CACHE_NAME = "viewcemac-v9";
const CORE_ASSETS = [
  "/", "/index.html", "/styles.css", "/app.js", "/manifest.json",
  "/auth.html", "/auth.js", "/compte.html", "/compte.js", "/privacy.html",
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
  // Ne rien intercepter hors GET (sécurité) ni hors domaine de l'app.
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  // Cache-first pour les assets statiques same-origin :
  // la PWA reste utilisable hors ligne, et le bump de CACHE_NAME
  // au déploiement force la mise à jour.
  e.respondWith(caches.match(e.request).then((c) => c || fetch(e.request)));
});

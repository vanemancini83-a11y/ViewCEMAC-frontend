// ============================================================
// ViewCEMAC — Service Worker v5
// Bump CACHE_NAME à CHAQUE modification (jamais en arrière)
// ============================================================
const CACHE_NAME = 'viewcemac-v9'; // ← bump à chaque déploiement majeur
const OFFLINE_URL = '/offline.html';

// ------------------------------------------------------------
// 1. INSTALL — pré-cache le shell + fallback hors-ligne
// ------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/styles.css',
        '/app.js',
        '/detail.html',
        '/detail.js',
        '/auth.html',
        '/auth.js',
        '/verification.html',
        '/verification.js',
        '/compte.html',
        '/compte.js',
        '/icons/viewcemac-icon-192.png',
        '/icons/viewcemac-icon-512.png',
        '/conditions.html',
        '/privacy.html',
        '/remboursement.html',
        '/contact.html',
        OFFLINE_URL,
      ]).catch(() => {
        console.warn('Pré-cache partiel : certains fichiers introuvables');
      });
    }).then(() => self.skipWaiting())
  );
});

// ------------------------------------------------------------
// 2. ACTIVATE — purge les vieux caches
// ------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ------------------------------------------------------------
// 3. FETCH — API = réseau d'abord, assets = cache
// ------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // API (si servie depuis le même domaine) : réseau d'abord
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(
          JSON.stringify({ erreur: 'Réseau indisponible.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    return;
  }

  // Assets statiques : cache d'abord, réseau en secours
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        if (response.ok && (url.pathname.startsWith('/assets/') || url.pathname.match(/\.(css|js|png|svg|ico|woff2?)$/))) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate') return caches.match(OFFLINE_URL);
      });
    })
  );
});

// ------------------------------------------------------------
// 4. NOTIFICATION CLICK — ouvre l'app (onglet existant ou nouveau)
// ------------------------------------------------------------
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || 'https://viewcemac.vercel.app';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith('https://viewcemac.vercel.app')) {
          return client.navigate(url).then((c) => c?.focus());
        }
      }
      return clients.openWindow(url);
    })
  );
});

// ------------------------------------------------------------
// 5. PUSH — ✅ icônes corrigées (les anciens chemins n'existaient pas :
//    /icons/icon-192.png et /icons/badge-72.png → icône vide dans la notif)
// ------------------------------------------------------------
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'ViewCEMAC', body: event.data?.text() || 'Nouvelle alerte.' };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'ViewCEMAC', {
      body: data.body || 'Nouvelle mise à jour disponible.',
      icon: '/icons/viewcemac-icon-192.png',
      badge: '/icons/viewcemac-icon-192.png',
      data: { url: data.url || 'https://viewcemac.vercel.app' },
      tag: data.tag || 'viewcemac-general',
      renotify: false,
    })
  );
});

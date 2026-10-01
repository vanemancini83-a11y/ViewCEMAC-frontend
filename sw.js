// ============================================================
// frontend-sw.js  →  RENOMME en sw.js et remplace
//                    ton fichier actuel sur le frontend
// ============================================================
// ⚠️ IMPORTANT : le nom du cache est passé à v3. C'est ce qui
//    force les navigateurs des utilisateurs à télécharger la
//    nouvelle version du SW. Ne repasse JAMAIS à v2/v1.
// ============================================================

const CACHE_NAME = 'viewcemac-v3'; // ← bump à chaque déploiement majeur
const OFFLINE_URL = '/offline.html'; // adapte si ton fallback a un autre chemin

// ------------------------------------------------------------
// 1. INSTALL — pré-cache le shell + fallback hors-ligne
// ------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/styles.css',   // ← adapte à tes vrais fichiers
        '/app.js',       // ← adapte à tes vrais fichiers
        OFFLINE_URL,
      ]).catch(() => {
        // Un fichier manquant ne doit pas bloquer l'installation
        console.warn('Pré-cache partiel : certains fichiers introuvables');
      });
    }).then(() => self.skipWaiting()) // active immédiatement le nouveau SW
  );
});

// ------------------------------------------------------------
// 2. ACTIVATE — purge les vieux caches (v1, v2...)
// ------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim()) // prend le contrôle des onglets ouverts
  );
});

// ------------------------------------------------------------
// 3. FETCH — stratégie : API = réseau d'abord, assets = cache
// ------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ne pas intercepter les requêtes non-GET ni cross-origin
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // API (ex. /api/* si servie depuis le même domaine) : réseau d'abord,
  // pas de mise en cache des données utilisateur
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(
          JSON.stringify({ erreur: 'Réseau indisponible. Serveur en cours de réveil ?' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    return;
  }

  // Assets statiques : cache d'abord, réseau en secours, puis cache dynamique
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        if (response.ok && (url.pathname.startsWith('/assets/') || url.pathname.match(/\.(css|js|png|svg|ico|woff2?)$/))) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Page de navigation hors-ligne → fallback
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
      });
    })
  );
});

// ------------------------------------------------------------
// 4. NOTIFICATION CLICK — LE BUG CORRIGÉ (priorité 1 audit)
//    Avant : e.notification.notification.data.url (double
//    .notification → TypeError, clic jamais fonctionnel)
// ------------------------------------------------------------
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // ✅ Correction : un seul .notification + fallback si data manquant
  const url = event.notification.data?.url || 'https://viewcemac.vercel.app';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Réutilise un onglet déjà ouvert sur l'app
      for (const client of windowClients) {
        if (client.url.startsWith('https://viewcemac.vercel.app')) {
          return client.navigate(url).then((c) => c?.focus());
        }
      }
      // Sinon ouvre un nouvel onglet
      return clients.openWindow(url);
    })
  );
});

// ------------------------------------------------------------
// 5. PUSH (si tu gères les push notifications)
//    data.url vient du payload envoyé par ton serveur
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
      icon: '/icons/icon-192.png', // ← adapte à ton chemin réel
      badge: '/icons/badge-72.png',
      data: { url: data.url || 'https://viewcemac.vercel.app' },
      tag: data.tag || 'viewcemac-general',
      renotify: false,
    })
  );
});

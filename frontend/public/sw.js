const CACHE_NAME = 'vibesync-v4';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Only handle GET requests for our own origin
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  
  // Skip socket.io requests
  if (e.request.url.includes('/socket.io/')) return;

  // For navigating to pages (SPA), try network, fallback to cached index.html if offline
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((response) => {
      if (response) return response;
      
      return fetch(e.request).then((networkResponse) => {
        // Only cache valid static assets (status 200)
        if (networkResponse && networkResponse.status === 200 && e.request.url.match(/\.(js|css|png|jpg|svg|woff2|ico)$/)) {
          const cacheCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, cacheCopy));
        }
        return networkResponse;
      }).catch(() => {
        // If it's a script/style that failed, just let it fail
        return null;
      });
    })
  );
});

self.addEventListener('push', (e) => {
  const data = e.data ? e.data.json() : {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'VibeSync', {
      body: data.body || 'New message in your room.',
      icon: '/favicon.svg'
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        client.focus();
      } else {
        self.clients.openWindow('/');
      }
    })
  );
});

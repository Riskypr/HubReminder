// public/sw.js
// Service Worker untuk Push Notification & PWA caching dasar

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: 'HubReminder',
      body: event.data.text() || 'Laporan hari ini belum diisi — tap untuk isi sekarang.',
    };
  }

  const title = payload.title || 'HubReminder';
  const options = {
    body: payload.body || 'Laporan hari ini belum diisi — tap untuk isi sekarang.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    actions: [{ action: 'open-attendance', title: 'Isi absensi' }],
    data: {
      url: payload.url || 'https://monev.maganghub.kemnaker.go.id/dashboard',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const monevUrl = 'https://monev.maganghub.kemnaker.go.id/dashboard';
  const requestedUrl = event.notification.data?.url || monevUrl;
  let targetUrl = monevUrl;
  try {
    const url = new URL(requestedUrl);
    if (url.origin === 'https://monev.maganghub.kemnaker.go.id') targetUrl = url.href;
  } catch {}

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// app/sw-push.ts
// Custom push notification handler untuk Service Worker

export function setupPushListeners(selfWorker: any) {
  selfWorker.addEventListener('push', (event: any) => {
    if (!event.data) return;

    let payload: { title?: string; body?: string; url?: string } = {};
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
      data: {
        url: payload.url || 'https://monev.maganghub.kemnaker.go.id/dashboard',
      },
    };

    event.waitUntil(selfWorker.registration.showNotification(title, options));
  });

  selfWorker.addEventListener('notificationclick', (event: any) => {
    event.notification.close();

    const targetUrl =
      event.notification.data?.url || 'https://monev.maganghub.kemnaker.go.id/dashboard';

    event.waitUntil(
      selfWorker.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList: any[]) => {
        for (const client of clientList) {
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        if (selfWorker.clients.openWindow) {
          return selfWorker.clients.openWindow(targetUrl);
        }
      })
    );
  });
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'New Notification' };
  }

  const title = data.title || 'New Notification';
  const body = data.body || '';
  const options = {
    body,
    icon: '/logo.png',
    badge: '/logo.png',
    data,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const url = '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({ type: 'NOTIFICATION_CLICK', data });
          return;
        }
      }
      return clients.openWindow(url).then((win) => {
        if (win) win.postMessage({ type: 'NOTIFICATION_CLICK', data });
      });
    })
  );
});

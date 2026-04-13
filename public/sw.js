self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const payload = event.data.json();
      const title = payload.title || 'ZIPP Notificación';
      const options = {
        body: payload.body || '',
        icon: '/icons/192.png',
        badge: '/icons/badge.png',
        vibrate: [200, 100, 200, 100, 200],
        data: payload.data || {}
      };
      
      event.waitUntil(self.registration.showNotification(title, options));

      // Broadcast to all open app windows
      self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(client => {
              client.postMessage({ type: 'PUSH_RECEIVED', payload });
          });
      });

    } catch(e) {
      // Not JSON
      event.waitUntil(self.registration.showNotification('ZIPP', {
        body: event.data.text()
      }));
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(windowClients => {
      // Focus existing window
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url.indexOf(self.location.origin) !== -1 && 'focus' in client) {
          return client.focus();
        }
      }
      // Or open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});

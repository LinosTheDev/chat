// service-worker.js

self.addEventListener('push', function(event) {
    const data = event.data.json();
    const title = 'New Message';
    const options = {
      body: data.message,
      vibrate: [200, 100, 200, 100, 200, 100, 200],
      tag: 'chat-notification'
    };
    event.waitUntil(self.registration.showNotification(title, options));
  });  
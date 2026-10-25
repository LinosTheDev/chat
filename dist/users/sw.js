// Import Firebase scripts for FCM background message handling
importScripts('https://www.gstatic.com/firebasejs/8.2.2/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.2.2/firebase-messaging.js');

const firebaseConfig = {
  apiKey: 'AIzaSyDo9xLGYs3rzhgJKV_qVEyNxCUaRratbXc',
  authDomain: 'https://chat-linos-default-rtdb.firebaseio.com/',
  projectId: 'chat-linos',
  storageBucket: 'gs://chat-linos.appspot.com',
  messagingSenderId: '335597863138',
  appId: '1:335597863138:web:bb28765ae4a27bae99debb'
};
firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

const CACHE_NAME = 'chat-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: 'New Message', body: event.data ? event.data.text() : 'You have a new message' };
  }

  const title = data.title || 'New Message';
  const options = {
    body: data.body || data.message || 'You have a new message',
    icon: data.icon || '../icon-192.png',
    badge: data.badge || '../icon-192.png',
    tag: data.tag || 'chat-message',
    renotify: true,
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '../'
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// FCM background message handler - catches data-only push payloads
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || payload.notification || {};
  const title = data.title || 'New Message';
  const options = {
    body: data.body || data.message || 'You have a new message',
    icon: data.icon || '../icon-192.png',
    badge: data.badge || '../icon-192.png',
    tag: 'chat-message',
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: data.url || '../' }
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : '../';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAJYaMUIkIvXOFSUSlUXEgyO7PcplJqBhs",
  authDomain: "fiona-consultation.firebaseapp.com",
  projectId: "fiona-consultation",
  storageBucket: "fiona-consultation.firebasestorage.app",
  messagingSenderId: "149410595083",
  appId: "1:149410595083:web:0c25164b06d8745049e20e"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification;
  self.registration.showNotification(title || 'Fiona ✦', {
    body: body || 'Nouveau message',
    icon: '/favicon.ico',
    vibrate: [200, 100, 200],
    data: payload.data,
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/attente';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

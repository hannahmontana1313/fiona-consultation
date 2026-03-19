// firebase-messaging-sw.js — Service Worker pour notifications push
// Placé dans /public/firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: self.FIREBASE_API_KEY,
  authDomain: self.FIREBASE_AUTH_DOMAIN,
  projectId: self.FIREBASE_PROJECT_ID,
  storageBucket: self.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: self.FIREBASE_MESSAGING_SENDER_ID,
  appId: self.FIREBASE_APP_ID,
});

// IMPORTANT : remplace les valeurs ci-dessous par tes vraies clés Firebase
// (le service worker ne peut pas lire process.env)
// Tu peux aussi utiliser un script de build pour injecter ces valeurs

const messaging = firebase.messaging();

// Notification reçue en background (app fermée ou onglet non actif)
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification;

  self.registration.showNotification(title || 'Fiona ✦', {
    body: body || 'Nouveau message',
    icon: icon || '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    vibrate: [200, 100, 200],
    data: payload.data,
    actions: [
      { action: 'ouvrir', title: 'Voir le message' },
      { action: 'fermer', title: 'Fermer' },
    ],
  });
});

// Clic sur la notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'fermer') return;

  const url = event.notification.data?.url || '/';
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

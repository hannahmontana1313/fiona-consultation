// pages/api/send-notification.js
// Envoie une notification push à un utilisateur via Firebase Admin SDK

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { getFirestore } from 'firebase-admin/firestore';

// Initialiser Firebase Admin (une seule fois)
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      // La clé privée contient des \n à convertir
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const adminDb = getFirestore();
const adminMessaging = getMessaging();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { userId, title, body, url, data } = req.body;

  if (!userId || !title) return res.status(400).json({ error: 'userId et title requis' });

  try {
    // Récupérer le token FCM de l'utilisateur
    const userDoc = await adminDb.doc(`users/${userId}`).get();
    const fcmToken = userDoc.data()?.fcmToken;

    if (!fcmToken) {
      return res.status(200).json({ sent: false, reason: 'Pas de token FCM' });
    }

    // Envoyer la notification
    await adminMessaging.send({
      token: fcmToken,
      notification: { title, body: body || '' },
      webpush: {
        notification: {
          icon: '/icons/icon-192.png',
          badge: '/icons/badge-72.png',
          requireInteraction: true,
        },
        fcmOptions: { link: url || '/' },
      },
      data: data || {},
    });

    res.status(200).json({ sent: true });
  } catch (err) {
    console.error('FCM send error:', err);
    // Token invalide = le supprimer
    if (err.code === 'messaging/registration-token-not-registered') {
      await adminDb.doc(`users/${userId}`).update({ fcmToken: null }).catch(() => {});
    }
    res.status(500).json({ error: err.message });
  }
}

import { useEffect, useState } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc } from 'firebase/firestore';
import { db, getMessagingInstance } from '../lib/firebase';
import { useAuth } from './AuthContext';

export function useNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState('default');
  const [token, setToken] = useState(null);

  // Demander la permission et récupérer le token FCM
  const requestPermission = async () => {
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') return null;

      const messaging = await getMessagingInstance();
      if (!messaging) return null;

      const fcmToken = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      });

      if (fcmToken && user) {
        // Sauvegarder le token dans le profil utilisateur
        await updateDoc(doc(db, 'users', user.uid), {
          fcmToken,
          fcmTokenUpdatedAt: new Date(),
        });
        setToken(fcmToken);
      }

      return fcmToken;
    } catch (err) {
      console.error('Erreur notification push:', err);
      return null;
    }
  };

  // Écouter les messages en foreground (app ouverte)
  useEffect(() => {
    let unsub = null;
    const setup = async () => {
      const messaging = await getMessagingInstance();
      if (!messaging) return;

      unsub = onMessage(messaging, (payload) => {
        // Notification en foreground : afficher une toast maison
        const event = new CustomEvent('fcm-message', { detail: payload });
        window.dispatchEvent(event);
      });
    };
    setup();
    return () => unsub?.();
  }, []);

  // Demander automatiquement si l'utilisateur est connecté
  useEffect(() => {
    if (!user || typeof Notification === 'undefined') return;
    if (Notification.permission === 'granted') {
      requestPermission(); // Récupère/rafraîchit le token silencieusement
    }
    setPermission(Notification.permission);
  }, [user]);

  return { permission, token, requestPermission };
}

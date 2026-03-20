import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: 'fiona-consultation',
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { consultationId } = req.body;
  if (!consultationId) return res.status(400).json({ error: 'consultationId manquant' });

  try {
    const db = getFirestore();
    const snap = await db.collection('consultations').doc(consultationId).get();
    if (!snap.exists) return res.status(404).json({ error: 'Consultation introuvable' });

    const token = snap.data().fcmToken;
    if (!token) return res.status(200).json({ ok: true, skipped: 'pas de token' });

    await getMessaging().send({
      token,
      notification: {
        title: '✨ Fiona est prête !',
        body: 'C\'est ton tour ! Ta consultation commence maintenant.',
      },
      data: { url: '/chat?consultation=' + consultationId },
      webpush: {
        fcmOptions: { link: '/chat?consultation=' + consultationId },
      },
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('send-notif error:', err);
    return res.status(500).json({ error: err.message });
  }
}

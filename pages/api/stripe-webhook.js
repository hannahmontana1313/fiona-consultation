import Stripe from 'stripe';
import { db } from '../../lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { userId, minutes } = session.metadata;

    try {
      // Marquer la consultation comme active + démarrer le timer
      await updateDoc(doc(db, 'consultations', session.id), {
        statut: 'active',
        payeAt: serverTimestamp(),
        debutAt: serverTimestamp(), // le timer démarre maintenant
        secondesRestantes: parseInt(minutes) * 60,
        montantPaye: session.amount_total, // en centimes
      });

      // Ajouter à la collection user pour recherche rapide
      await updateDoc(doc(db, 'users', userId), {
        consultationActive: session.id,
      }).catch(() => {}); // ignore si user doc pas encore prêt
    } catch (err) {
      console.error('Firestore update error:', err);
    }
  }

  res.status(200).json({ received: true });
}

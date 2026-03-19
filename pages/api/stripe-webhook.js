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
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
  const session = event.data.object;
  const { userId, minutes, ancienConsultationId } = session.metadata;
  const targetId = ancienConsultationId || session.id;
  try {
    await updateDoc(doc(db, 'consultations', targetId), {
      statut: 'en_attente',
      payeAt: serverTimestamp(),
      secondesRestantes: parseInt(minutes) * 60,
      montantPaye: session.amount_total,
    });
  } catch (err) {
    console.error('Firestore update error:', err);
  }
}

import Stripe from 'stripe';
import { db } from '../../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { userId, prenom, telephone, question } = req.body;
  if (!userId) return res.status(400).json({ error: 'Paramètres manquants' });

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'Tirage Lenormand express',
            description: '1 carte tirée + interprétation personnalisée par Fiona',
          },
          unit_amount: 500,
        },
        quantity: 1,
      }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/tirage?tirage_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/`,
      metadata: {
        userId,
        prenom,
        telephone: telephone || '',
        type: 'tirage',
      },
    });

    await setDoc(doc(db, 'tirages', session.id), {
      sessionId: session.id,
      userId,
      prenom,
      telephone: telephone || '',
      statut: 'pending',
      createdAt: serverTimestamp(),
      paiement: 'stripe',
      messagesNonLus: 0,
    });

    res.status(200).json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).json({ error: err.message });
  }
}

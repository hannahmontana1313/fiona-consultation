import Stripe from 'stripe';
import { db } from '../../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { consultationId, minutes, tarif, userId } = req.body;

  const prixBase = minutes * tarif;
  const montantCentimes = Math.round((prixBase + 0.25) / (1 - 0.014) * 100);

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: `+${minutes} minutes supplémentaires`,
            description: 'Prolongation de consultation',
          },
          unit_amount: montantCentimes,
        },
        quantity: 1,
      }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/chat?consultation=${consultationId}&added=${minutes}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/chat?consultation=${consultationId}`,
      metadata: {
        type: 'ajout_temps',
        consultationId,
        userId,
        minutes: String(minutes),
      },
    });

    res.status(200).json({ sessionId: session.id, url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

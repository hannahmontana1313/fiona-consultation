import Stripe from 'stripe';
import { db } from '../../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { minutes, tarif, userId, prenom, telephone, domaine, sujet, message } = req.body;

  if (!minutes || !userId) return res.status(400).json({ error: 'Paramètres manquants' });

  const prixBase = minutes * tarif;
  const montantCentimes = Math.round((prixBase + 0.25) / (1 - 0.014) * 100);

  try {
    // Créer la session Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: `Consultation ${minutes} minutes`,
            description: `${domaine} · ${sujet}`,
          },
          unit_amount: montantCentimes,
        },
        quantity: 1,
      }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/chat?session_id={CHECKOUT_SESSION_ID}&uid=${userId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/reserver`,
      metadata: {
  userId,
  prenom,
  domaine,
  sujet,
  message: message?.substring(0, 500) || '',
  minutes: String(minutes),
  tarif: String(tarif),
  
},
    });

    // Pré-créer la consultation en "pending" dans Firestore
    await setDoc(doc(db, 'consultations', session.id), {
      sessionId: session.id,
      userId,
      prenom,
      domaine,
      sujet,
      message: message || '',
      minutes,
      tarif,
      montantCentimes,
      statut: 'pending', // pending → active → terminee
      createdAt: serverTimestamp(),
      paiement: 'stripe',
      telephone: telephone || '',
    });

    res.status(200).json({ sessionId: session.id });
  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).json({ error: err.message });
  }
}

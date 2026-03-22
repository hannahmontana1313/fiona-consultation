import Stripe from 'stripe';
import { db } from '../../../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Calcule le total avec les frais Stripe inclus
// La cliente paie les frais : (montant + 0.25) / (1 - 0.015)
function totalAvecFraisStripe(montant) {
  return Math.round(((montant + 0.25) / (1 - 0.015)) * 100) / 100;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Methode non autorisee' });

  const { consultationId, tiragesChoisis, total } = req.body;

  if (!consultationId || !tiragesChoisis || tiragesChoisis.length === 0) {
    return res.status(400).json({ error: 'Donnees manquantes' });
  }

  try {
    // Recuperer la consultation dans Firebase
    const snap = await getDoc(doc(db, 'consultations', consultationId));
    if (!snap.exists()) return res.status(404).json({ error: 'Consultation introuvable' });

    const consultation = snap.data();
    const tiragesSelectionnes = tiragesChoisis.map(i => consultation.tirages[i]);

    // Total avec frais Stripe repercutes sur la cliente
    const totalAvecFrais = totalAvecFraisStripe(total);
    const fraisStripe = Math.round((totalAvecFrais - total) * 100) / 100;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: tiragesSelectionnes.length === 1
                ? tiragesSelectionnes[0].nom
                : `${tiragesSelectionnes.length} tirages — Consultation Fiona`,
              description: tiragesSelectionnes.map(t => t.nom).join(' + '),
            },
            unit_amount: Math.round(totalAvecFrais * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/consultation/confirmation?id=${consultationId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/consultation/choix?id=${consultationId}`,
      metadata: {
        consultationId,
        tiragesChoisis: JSON.stringify(tiragesChoisis),
      },
    });

    await updateDoc(doc(db, 'consultations', consultationId), {
      tiragesChoisis,
      total,
      totalAvecFrais,
      fraisStripe,
      stripeSessionId: session.id,
      statut: 'en_attente_paiement',
    });

    return res.status(200).json({ url: session.url });

  } catch (e) {
    console.error('Erreur paiement:', e);
    return res.status(500).json({ error: 'Erreur lors du paiement' });
  }
}

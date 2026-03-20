import Stripe from 'stripe';
import { db } from '../../lib/firebase';
import { doc, updateDoc, getDoc, setDoc, serverTimestamp, increment } from 'firebase/firestore';

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

function getStatutVIP(totalDepense) {
  if (totalDepense >= 600) return 'vip';
  if (totalDepense >= 300) return 'gold';
  if (totalDepense >= 100) return 'silver';
  return 'bronze';
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
    const montantEuros = session.amount_total / 100;

    // 1. Mettre à jour la consultation
    try {
      await updateDoc(doc(db, 'consultations', targetId), {
        statut: 'en_attente',
        payeAt: serverTimestamp(),
        secondesRestantes: parseInt(minutes) * 60,
        montantPaye: session.amount_total,
        prioritaire: ancienConsultationId ? false : (session.metadata.prioritaire === 'true'),
      });
    } catch (err) {
      console.error('Firestore update error:', err);
    }

    // 2. Mettre à jour les points fidélité
    if (userId) {
      try {
        const fideliteRef = doc(db, 'fidelite', userId);
        const fideliteSnap = await getDoc(fideliteRef);

        if (!fideliteSnap.exists()) {
          // Première consultation → créer le document + bonus 20 points
          const pointsInitiaux = Math.floor(montantEuros) + 20;
          const totalDepense = montantEuros;
          await setDoc(fideliteRef, {
            userId,
            points: pointsInitiaux,
            totalDepense,
            statut: getStatutVIP(totalDepense),
            premiereConsultation: true,
            cadeauxUtilises: [],
            cadeauxDebloques: [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          // Consultation suivante → ajouter les points
          const data = fideliteSnap.data();
          const nouveauTotal = (data.totalDepense || 0) + montantEuros;
          const pointsGagnes = Math.floor(montantEuros);
          const nouveauxPoints = (data.points || 0) + pointsGagnes;

          // Vérifier si nouveaux cadeaux débloqués
          const paliers = [150, 300, 600];
          const ancienPoints = data.points || 0;
          const cadeauxDebloques = [...(data.cadeauxDebloques || [])];
          paliers.forEach(palier => {
            if (ancienPoints < palier && nouveauxPoints >= palier && !cadeauxDebloques.includes(palier)) {
              cadeauxDebloques.push(palier);
            }
          });

          await updateDoc(fideliteRef, {
            points: nouveauxPoints,
            totalDepense: nouveauTotal,
            statut: getStatutVIP(nouveauTotal),
            cadeauxDebloques,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.error('Fidelite update error:', err);
      }
    }
  }

  res.status(200).json({ received: true });
}

import { db } from '../../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Vérification email admin
  const adminEmail = process.env.ADMIN_EMAIL;
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${adminEmail}`) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  const { consultationId, tirages, remise } = req.body;

  if (!consultationId || !tirages) {
    return res.status(400).json({ error: 'Données manquantes' });
  }

  try {
    await updateDoc(doc(db, 'consultations', consultationId), {
      tirages,
      remise: remise || 0,
      statut: 'prix_envoyes',
    });

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('Erreur envoyer-prix:', e);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}

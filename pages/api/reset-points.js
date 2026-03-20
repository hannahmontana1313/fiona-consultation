import { db } from '../../lib/firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';

export default async function handler(req, res) {
  // Sécurité : vérifier que c'est bien un appel autorisé
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  const aujourd_hui = new Date();
  if (aujourd_hui.getDate() !== 1) {
    return res.status(200).json({ message: 'Pas le 1er du mois, rien à faire.' });
  }

  try {
    const snap = await getDocs(collection(db, 'fidelite'));
    const batch = writeBatch(db);

    snap.docs.forEach(document => {
      batch.update(doc(db, 'fidelite', document.id), {
        points: 0,
        statut: 'bronze',
        cadeauxDebloques: [],
        cadeauxUtilises: [],
        resetAt: new Date(),
      });
    });

    await batch.commit();
    res.status(200).json({ message: `${snap.docs.length} comptes réinitialisés.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

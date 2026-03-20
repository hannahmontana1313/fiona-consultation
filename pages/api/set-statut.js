import { db } from '../../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { statut } = req.body;
  if (!statut) return res.status(400).json({ error: 'Statut manquant' });
  try {
    await setDoc(doc(db, 'config', 'statut'), {
      statut,
      updatedAt: new Date(),
    });
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

import { db } from '../../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { type, situation, questions, prenom, telephone } = req.body;

  if (!type || !situation || !questions || !prenom || !telephone) {
    return res.status(400).json({ error: 'Champs manquants' });
  }

  const isWeekend = [0, 6].includes(new Date().getDay());

  try {
    // Appel à Claude pour générer les tirages
    const prompt = `Tu es une experte en tarot et cartomancie.

Une cliente prénommée ${prenom} cherche une consultation de type "${type}".

Sa situation : ${situation}

Ses questions : ${questions}

Propose 3 tirages de tarot adaptés à sa situation. Pour chaque tirage :
1. Un titre accrocheur et personnalisé
2. Une phrase d'introduction (1-2 phrases)
3. La liste de ce qu'on regarde dans ce tirage (6 à 8 points précis)
4. Une ligne "Idéal pour" en une phrase

Réponds UNIQUEMENT en JSON valide, sans backticks ni markdown :
{
  "tirages": [
    {
      "emoji": "💔",
      "nom": "Titre du tirage",
      "intro": "Phrase d'introduction...",
      "regards": ["Point 1", "Point 2", "Point 3", "Point 4", "Point 5", "Point 6"],
      "ideal": "Idéal pour..."
    }
  ]
}`;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const claudeData = await claudeRes.json();
    const text = claudeData.content.map(i => i.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    // Sauvegarde dans Firebase
    const docRef = await addDoc(collection(db, 'consultations'), {
      prenom,
      telephone,
      type,
      situation,
      questions,
      tirages: parsed.tirages.map(t => ({ ...t, prix: 0 })),
      isWeekend,
      remise: 0,
      statut: 'en_attente',
      createdAt: serverTimestamp(),
    });

    return res.status(200).json({ id: docRef.id });

  } catch (e) {
    console.error('Erreur:', e.message);
    return res.status(500).json({ error: 'Erreur lors de la generation' });
}
}

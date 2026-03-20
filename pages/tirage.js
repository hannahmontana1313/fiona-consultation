import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db } from '../lib/firebase';
import { doc, onSnapshot, collection, addDoc, serverTimestamp, updateDoc, getDoc } from 'firebase/firestore';
import { useAuth } from '../components/AuthContext';
import Stars from '../components/Stars';
import Navbar from '../components/Navbar';

const CARTES_LENORMAND = [
  { id: 1, nom: 'Le Cavalier', emoji: '🐴', couleur: '#E8D5B7', description: 'Nouvelles, messages, rapidité' },
  { id: 2, nom: 'Le Trèfle', emoji: '🍀', couleur: '#90EE90', description: 'Chance, petits bonheurs, espoir' },
  { id: 3, nom: 'Le Navire', emoji: '⛵', couleur: '#87CEEB', description: 'Voyage, commerce, ambition' },
  { id: 4, nom: 'La Maison', emoji: '🏠', couleur: '#DEB887', description: 'Foyer, sécurité, famille' },
  { id: 5, nom: "L'Arbre", emoji: '🌳', couleur: '#228B22', description: 'Santé, racines, croissance' },
  { id: 6, nom: 'Les Nuages', emoji: '☁️', couleur: '#B0C4DE', description: 'Confusion, doutes, incertitude' },
  { id: 7, nom: 'Le Serpent', emoji: '🐍', couleur: '#9ACD32', description: 'Sagesse, tentation, rivalité' },
  { id: 8, nom: 'Le Cercueil', emoji: '⚰️', couleur: '#696969', description: 'Fin, transformation, renouveau' },
  { id: 9, nom: 'Les Fleurs', emoji: '💐', couleur: '#FFB6C1', description: 'Bonheur, cadeau, invitation' },
  { id: 10, nom: 'La Faux', emoji: '🌾', couleur: '#DAA520', description: 'Décision, coupure, récolte' },
  { id: 11, nom: 'Le Fouet', emoji: '⚡', couleur: '#FF6347', description: 'Conflits, répétition, sport' },
  { id: 12, nom: 'Les Oiseaux', emoji: '🐦', couleur: '#87CEEB', description: 'Communication, couple, bavardage' },
  { id: 13, nom: "L'Enfant", emoji: '👶', couleur: '#FFD700', description: 'Nouveauté, innocence, début' },
  { id: 14, nom: 'Le Renard', emoji: '🦊', couleur: '#FF8C00', description: 'Ruse, travail, méfiance' },
  { id: 15, nom: "L'Ours", emoji: '🐻', couleur: '#8B4513', description: 'Force, autorité, protection' },
  { id: 16, nom: "L'Étoile", emoji: '⭐', couleur: '#FFD700', description: 'Espoir, guidance, avenir lumineux' },
  { id: 17, nom: 'La Cigogne', emoji: '🦢', couleur: '#F0F8FF', description: 'Changement, évolution, mouvement' },
  { id: 18, nom: 'Le Chien', emoji: '🐕', couleur: '#DEB887', description: 'Amitié, fidélité, confiance' },
  { id: 19, nom: 'La Tour', emoji: '🗼', couleur: '#A9A9A9', description: 'Solitude, institution, ambition' },
  { id: 20, nom: 'Le Jardin', emoji: '🌺', couleur: '#98FB98', description: 'Social, public, rencontres' },
  { id: 21, nom: 'La Montagne', emoji: '⛰️', couleur: '#808080', description: 'Obstacle, défi, patience' },
  { id: 22, nom: 'Les Chemins', emoji: '🛤️', couleur: '#F4A460', description: 'Choix, décision, carrefour' },
  { id: 23, nom: 'Les Souris', emoji: '🐭', couleur: '#BC8F8F', description: 'Perte, stress, diminution' },
  { id: 24, nom: 'Le Cœur', emoji: '❤️', couleur: '#FF69B4', description: 'Amour, sentiment, joie' },
  { id: 25, nom: "L'Anneau", emoji: '💍', couleur: '#FFD700', description: 'Engagement, contrat, cycle' },
  { id: 26, nom: 'Le Livre', emoji: '📚', couleur: '#4169E1', description: 'Secret, connaissance, mystère' },
  { id: 27, nom: 'La Lettre', emoji: '✉️', couleur: '#F5DEB3', description: 'Message, document, nouvelle' },
  { id: 28, nom: "L'Homme", emoji: '👨', couleur: '#4682B4', description: 'Homme important, consultant' },
  { id: 29, nom: 'La Femme', emoji: '👩', couleur: '#DB7093', description: 'Femme importante, consultante' },
  { id: 30, nom: 'Les Lys', emoji: '🌸', couleur: '#DDA0DD', description: 'Paix, sagesse, sensualité' },
  { id: 31, nom: 'Le Soleil', emoji: '☀️', couleur: '#FFD700', description: 'Succès, énergie, clarté' },
  { id: 32, nom: 'La Lune', emoji: '🌙', couleur: '#9370DB', description: 'Intuition, rêves, reconnaissance' },
  { id: 33, nom: 'La Clé', emoji: '🗝️', couleur: '#DAA520', description: 'Solution, certitude, succès' },
  { id: 34, nom: 'Le Poisson', emoji: '🐟', couleur: '#00CED1', description: 'Argent, abondance, indépendance' },
  { id: 35, nom: "L'Ancre", emoji: '⚓', couleur: '#2F4F4F', description: 'Stabilité, persévérance, travail' },
  { id: 36, nom: 'La Croix', emoji: '✝️', couleur: '#8B0000', description: 'Destin, épreuve, foi' },
];

export default function Tirage() {
  const { user } = useAuth();
  const router = useRouter();
  const { tirage_id } = router.query;

  const [tirage, setTirage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [carteRetournee, setCarteRetournee] = useState(false);
  const [carteChoisie, setCarteChoisie] = useState(null);
  const [question, setQuestion] = useState('');
  const [questionEnvoyee, setQuestionEnvoyee] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [bloque, setBloque] = useState(false);
  const [avisOpen, setAvisOpen] = useState(false);
  const [avisNote, setAvisNote] = useState(5);
  const [avisTexte, setAvisTexte] = useState('');
  const [avisEnvoye, setAvisEnvoye] = useState(false);

  useEffect(() => {
    if (!router.isReady || !user) return;
    if (!tirage_id) { router.push('/'); return; }
  }, [router.isReady, user, tirage_id]);

  useEffect(() => {
    if (!tirage_id) return;
    const unsub = onSnapshot(doc(db, 'tirages', tirage_id), snap => {
      if (!snap.exists()) return;
      const data = snap.data();
      setTirage(data);
      setLoading(false);
      if (data.carteId) {
        const carte = CARTES_LENORMAND.find(c => c.id === data.carteId);
        setCarteChoisie(carte);
        setCarteRetournee(true);
      }
      if (data.statut === 'termine') {
        setBloque(true);
        setAvisOpen(true);
      }
    });
    return unsub;
  }, [tirage_id]);

  useEffect(() => {
    if (!tirage_id) return;
    const q = collection(db, 'tirages', tirage_id, 'messages');
    const unsub = onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      setMessages(msgs);
      const msgFin = msgs.find(m => m.texte?.includes('consultation privée'));
      if (msgFin) {
        setBloque(true);
        setTimeout(() => setAvisOpen(true), 1500);
      }
    });
    return unsub;
  }, [tirage_id]);

  const tirerCarte = async () => {
    const carteAleatoire = CARTES_LENORMAND[Math.floor(Math.random() * CARTES_LENORMAND.length)];
    setCarteChoisie(carteAleatoire);
    setCarteRetournee(true);
    await updateDoc(doc(db, 'tirages', tirage_id), {
      carteId: carteAleatoire.id,
      carteNom: carteAleatoire.nom,
    });
  };

  const envoyerQuestion = async () => {
    if (!question.trim()) return;
    await updateDoc(doc(db, 'tirages', tirage_id), { question });
    await addDoc(collection(db, 'tirages', tirage_id, 'messages'), {
      texte: question,
      auteur: 'client',
      createdAt: serverTimestamp(),
    });
    setQuestionEnvoyee(true);
  };

  const envoyerMessage = async () => {
    if (!input.trim() || bloque) return;
    const texte = input.trim();
    setInput('');
    await addDoc(collection(db, 'tirages', tirage_id, 'messages'), {
      texte,
      auteur: 'client',
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'tirages', tirage_id), {
      lastMessage: texte,
      lastMessageAt: serverTimestamp(),
      messagesNonLus: (tirage?.messagesNonLus || 0) + 1,
    });
  };

  const envoyerAvis = async () => {
    if (!avisTexte.trim()) return;
    await addDoc(collection(db, 'avis'), {
      consultationId: tirage_id,
      userId: user.uid,
      prenom: tirage?.prenom || '',
      note: avisNote,
      texte: avisTexte,
      visible: false,
      createdAt: serverTimestamp(),
    });
    try {
      const fideliteRef = doc(db, 'fidelite', user.uid);
      const fideliteSnap = await getDoc(fideliteRef);
      if (fideliteSnap.exists()) {
        const data = fideliteSnap.data();
        const nouveauxPoints = (data.points || 0) + 5;
        const paliers = [150, 300, 600];
        const cadeauxDebloques = [...(data.cadeauxDebloques || [])];
        paliers.forEach(palier => {
          if ((data.points || 0) < palier && nouveauxPoints >= palier && !cadeauxDebloques.includes(palier)) cadeauxDebloques.push(palier);
        });
        await updateDoc(fideliteRef, { points: nouveauxPoints, cadeauxDebloques, updatedAt: serverTimestamp() });
      }
    } catch (err) { console.error('Fidelite avis error:', err); }
    setAvisEnvoye(true);
    setAvisOpen(false);
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <Stars />
      <div style={{ textAlign: 'center', color: 'var(--vd)', fontFamily: "'Playfair Display',serif", fontSize: '1.2rem' }}>
        Préparation de ton tirage…
      </div>
    </div>
  );

  return (
    <>
      <Stars />
      <Navbar />
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '2rem 1rem' }}>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.8rem', color: 'var(--vd)', marginBottom: '0.5rem' }}>
            🔮 Tirage Lenormand
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
            Concentre-toi sur ta question et tire ta carte
          </p>
        </div>

        {!carteRetournee ? (
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <p style={{ color: 'var(--muted)', marginBottom: '1.5rem', fontSize: '14px' }}>
              Clique sur le tas de cartes pour révéler ta carte du destin ✨
            </p>
            <div onClick={tirerCarte} style={{ cursor: 'pointer', display: 'inline-block', position: 'relative' }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} style={{
                  position: i === 0 ? 'relative' : 'absolute',
                  top: i === 0 ? 0 : -i * 3,
                  left: i === 0 ? 0 : i * 2,
                  width: 140, height: 220,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, var(--v), var(--pd))',
                  border: '2px solid rgba(255,255,255,0.3)',
                  boxShadow: '0 8px 32px rgba(123,94,167,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '3rem',
                  transition: 'transform 0.2s',
                }}>
                  ✦
                </div>
              ))}
            </div>
            <p style={{ color: 'var(--v)', marginTop: '2rem', fontSize: '13px', fontStyle: 'italic' }}>
              Clique pour tirer ta carte
            </p>
          </div>
        ) : (
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{
              width: 160, height: 240, borderRadius: 16, margin: '0 auto 1.5rem',
              background: `linear-gradient(135deg, ${carteChoisie.couleur}, white)`,
              border: '3px solid var(--vl)',
              boxShadow: '0 16px 48px rgba(123,94,167,0.3)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '12px',
            }}>
              <div style={{ fontSize: '4rem' }}>{carteChoisie.emoji}</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '14px', color: 'var(--vd)', fontWeight: 500, textAlign: 'center', padding: '0 8px' }}>
                {carteChoisie.nom}
              </div>
            </div>
            <div style={{ padding: '12px 20px', borderRadius: 'var(--r)', background: 'rgba(123,94,167,0.08)', border: '1px solid var(--vl)', display: 'inline-block', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '13px', color: 'var(--muted)', fontStyle: 'italic' }}>
                {carteChoisie.description}
              </div>
            </div>
          </div>
        )}

        {carteRetournee && !questionEnvoyee && (
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", color: 'var(--vd)', marginBottom: '1rem', fontSize: '1.1rem' }}>
              ✦ Quelle est ta question ?
            </h3>
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Pose ta question à Fiona pour qu'elle interprète ta carte…"
              rows={3}
              style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 14px', fontFamily: "'DM Sans',sans-serif", fontSize: '14px', resize: 'none', outline: 'none', color: 'var(--txt)', boxSizing: 'border-box', marginBottom: '1rem' }}
            />
            <button onClick={envoyerQuestion} className="btn btn-primary" style={{ width: '100%' }}>
              Envoyer ma question à Fiona ✦
            </button>
          </div>
        )}

        {questionEnvoyee && (
          <div className="card" style={{ padding: '1.5rem' }}>
            {!bloque && (
              <div style={{ marginBottom: '1rem', padding: '10px', background: 'rgba(123,94,167,0.06)', borderRadius: 'var(--r)', fontSize: '13px', color: 'var(--muted)', textAlign: 'center' }}>
                ⏳ Fiona va interpréter ta carte et te répondre très bientôt…
              </div>
            )}
            {bloque && (
              <div style={{ marginBottom: '1rem', padding: '10px', background: 'rgba(60,160,100,0.08)', borderRadius: 'var(--r)', fontSize: '13px', color: '#1A7040', textAlign: 'center' }}>
                ✅ Tirage terminé — merci pour ta confiance 🔮
              </div>
            )}
            <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1rem' }}>
              {messages.map(msg => {
                const isClient = msg.auteur === 'client';
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignSelf: isClient ? 'flex-end' : 'flex-start', alignItems: isClient ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                    <div className={isClient ? 'bubble-client' : 'bubble-admin'} style={{ padding: '10px 15px', borderRadius: '18px', fontSize: '14px', lineHeight: 1.6 }}>
                      {msg.texte}
                    </div>
                  </div>
                );
              })}
            </div>
            {!bloque && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') envoyerMessage(); }}
                  placeholder="Envoyer un message…"
                  style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 14px', fontFamily: "'DM Sans',sans-serif", fontSize: '14px', outline: 'none', color: 'var(--txt)' }}
                />
                <button onClick={envoyerMessage} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg, var(--v), var(--pd))', color: '#fff', cursor: 'pointer', fontSize: '16px' }}>↑</button>
              </div>
            )}
          </div>
        )}
      </div>

      {avisOpen && !avisEnvoye && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(42,26,74,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem' }}>
          <div className="card" style={{ maxWidth: 380, width: '100%', padding: '2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⭐</div>
            <h3 style={{ fontFamily: "'Playfair Display',serif", color: 'var(--vd)', marginBottom: '0.5rem' }}>Comment s'est passé ton tirage ?</h3>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '1.5rem' }}>Ton avis aide d'autres personnes à me faire confiance ✨</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '1.5rem' }}>
              {[1,2,3,4,5].map(n => (
                <span key={n} onClick={() => setAvisNote(n)} style={{ fontSize: '2rem', cursor: 'pointer', opacity: n <= avisNote ? 1 : 0.3, transition: 'opacity 0.15s' }}>⭐</span>
              ))}
            </div>
            <textarea value={avisTexte} onChange={e => setAvisTexte(e.target.value)} placeholder="Dis-moi ce que tu as pensé du tirage..." rows={3}
              style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 14px', fontFamily: "'DM Sans',sans-serif", fontSize: '14px', resize: 'none', outline: 'none', color: 'var(--txt)', marginBottom: '1rem', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setAvisOpen(false)} className="btn btn-outline" style={{ flex: 1 }}>Plus tard</button>
              <button onClick={envoyerAvis} className="btn btn-primary" style={{ flex: 2 }}>Envoyer mon avis ✦</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

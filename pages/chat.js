import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  collection, doc, addDoc, onSnapshot, updateDoc,
  query, orderBy, serverTimestamp, getDoc, increment, where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../components/AuthContext';
import Stars from '../components/Stars';
import { getTarifActuel } from '../lib/stripe';

export default function Chat() {
  const { user } = useAuth();
  const router = useRouter();
  const { consultation: consultationIdParam, session_id, added } = router.query;

  const [consultation, setConsultation] = useState(null);
  const [consultationId, setConsultationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [secondesRestantes, setSecrestantes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bloque, setBloque] = useState(false);
  const [alertes, setAlertes] = useState(new Set());
  const [ajoutTempsOpen, setAjoutTempsOpen] = useState(false);
  const [adminIsTyping, setAdminIsTyping] = useState(false);
  const [ajoutMinutes, setAjoutMinutes] = useState(10);
  const [loadingAjout, setLoadingAjout] = useState(false);
  const [avisOpen, setAvisOpen] = useState(false);
  const [avisNote, setAvisNote] = useState(5);
  const [avisTexte, setAvisTexte] = useState('');
  const [avisEnvoye, setAvisEnvoye] = useState(false);

  const msgsRef = useRef(null);
  const timerRef = useRef(null);
  const inputRef = useRef(null);
  const tarif = getTarifActuel();

  useEffect(() => {
    if (!router.isReady || !user) return;
    const id = consultationIdParam || session_id;
    if (id) setConsultationId(id);
    else router.push('/reserver');
  }, [router.isReady, user, consultationIdParam, session_id]);

  useEffect(() => {
    if (added && consultationId) {
      const mins = parseInt(added);
      if (!isNaN(mins)) {
        updateDoc(doc(db, 'consultations', consultationId), {
          secondesRestantes: increment(mins * 60),
        });
        addSystemMsg(`✨ ${mins} minutes ajoutées !`);
      }
    }
  }, [added, consultationId]);

  useEffect(() => {
    if (!consultationId) return;
    const unsub = onSnapshot(doc(db, 'consultations', consultationId), snap => {
      if (!snap.exists()) return;
      const data = snap.data();
      setConsultation(data);
      setSecrestantes(data.secondesRestantes ?? null);
      setLoading(false);
      if (data.statut === 'terminee') { setBloque(true); setAvisOpen(true); }
      if (data.statut === 'en_attente' || data.statut === 'active') setBloque(false);
      setAdminIsTyping(data.adminIsTyping || false);
    });
    return unsub;
  }, [consultationId]);

  useEffect(() => {
    if (!user || !consultation) return;
    if (consultation.statut !== 'terminee') return;
    const q = query(
      collection(db, 'consultations'),
      where('userId', '==', user.uid),
      where('statut', 'in', ['en_attente', 'active']),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      if (!snap.empty) {
        const nouvelle = snap.docs[0];
        if (nouvelle.id !== consultationId) {
          router.push('/chat?consultation=' + nouvelle.id);
        }
      }
    });
    return unsub;
  }, [consultation?.statut, user]);

  useEffect(() => {
    if (!consultationId) return;
    const q = query(
      collection(db, 'consultations', consultationId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
      if (msgs.length === 0) {
        setTimeout(() => sendSystemMsg(
          'Coucou et bienvenue ✨ Prends quelques instants pour m\'expliquer ta situation calmement. Ensuite, pose-moi tes questions une par une pour que je puisse te répondre de la façon la plus claire possible. Le temps de consultation est en cours et le compteur s\'affiche en haut du chat.',
          'admin'
        ), 500);
      }
    });
    return unsub;
  }, [consultationId]);

  useEffect(() => {
    if (msgsRef.current) {
      msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (secondesRestantes === null || bloque || consultation?.statut !== 'active') return;

    timerRef.current = setInterval(() => {
      setSecrestantes(prev => {
        const next = prev - 1;

        if (next === 300 && !alertes.has(300)) {
          addSystemMsg('⏰ Il te reste 5 minutes');
          setAlertes(a => new Set([...a, 300]));
        }
        if (next === 120 && !alertes.has(120)) {
          addSystemMsg('⚠️ Attention, plus que 2 minutes !');
          setAlertes(a => new Set([...a, 120]));
        }
        if (next === 30 && !alertes.has(30)) {
          addSystemMsg('🔴 Moins de 30 secondes !');
          setAlertes(a => new Set([...a, 30]));
        }
        if (next <= 0) {
          clearInterval(timerRef.current);
          setBloque(true);
          addSystemMsg('⏳ Ton temps de consultation est terminé. Tu peux ajouter du temps pour continuer l\'échange sans perdre le fil.');
          updateDoc(doc(db, 'consultations', consultationId), {
            secondesRestantes: 0,
            statut: 'terminee',
          });
          ajouterPointsBonus30min();
          return 0;
        }

        if (next % 30 === 0) {
          updateDoc(doc(db, 'consultations', consultationId), {
            secondesRestantes: next,
          }).catch(() => {});
        }

        return next;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [secondesRestantes !== null, bloque, consultation?.statut]);

  const formatTimer = (secs) => {
    if (secs === null) return '--:--';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const sendSystemMsg = async (text, auteur = 'system') => {
    if (!consultationId) return;
    await addDoc(collection(db, 'consultations', consultationId, 'messages'), {
      texte: text,
      auteur,
      type: auteur === 'system' ? 'alerte' : 'message',
      createdAt: serverTimestamp(),
    });
  };

  const addSystemMsg = (text) => sendSystemMsg(text, 'system');

  const envoyerMessage = async () => {
    if (!input.trim() || bloque || !consultationId) return;
    const texte = input.trim();
    setInput('');
    await addDoc(collection(db, 'consultations', consultationId, 'messages'), {
      texte,
      auteur: 'client',
      type: 'message',
      userId: user.uid,
      lu: false,
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'consultations', consultationId), {
      lastMessage: texte,
      lastMessageAt: serverTimestamp(),
      messagesNonLus: increment(1),
    });
  };

  const handleAjouterTemps = async () => {
    setLoadingAjout(true);
    try {
      const res = await fetch('/api/ajouter-temps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consultationId,
          minutes: ajoutMinutes,
          tarif,
          userId: user.uid,
        }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      alert('Erreur : ' + err.message);
    }
    setLoadingAjout(false);
  };

  const ajouterPointsBonus30min = async () => {
    try {
      if (consultation && consultation.minutes >= 30) {
        const fideliteRef = doc(db, 'fidelite', user.uid);
        const fideliteSnap = await getDoc(fideliteRef);
        if (fideliteSnap.exists()) {
          const data = fideliteSnap.data();
          const nouveauxPoints = (data.points || 0) + 10;
          const paliers = [150, 300, 600];
          const cadeauxDebloques = [...(data.cadeauxDebloques || [])];
          paliers.forEach(palier => {
            if ((data.points || 0) < palier && nouveauxPoints >= palier && !cadeauxDebloques.includes(palier)) {
              cadeauxDebloques.push(palier);
            }
          });
          await updateDoc(fideliteRef, {
            points: nouveauxPoints,
            cadeauxDebloques,
            updatedAt: serverTimestamp(),
          });
        }
      }
    } catch (err) {
      console.error('Fidelite bonus 30min error:', err);
    }
  };

  const envoyerAvis = async () => {
    if (!avisTexte.trim() || !consultationId) return;
    await addDoc(collection(db, 'avis'), {
      consultationId,
      userId: user.uid,
      prenom: consultation.prenom,
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
          if ((data.points || 0) < palier && nouveauxPoints >= palier && !cadeauxDebloques.includes(palier)) {
            cadeauxDebloques.push(palier);
          }
        });
        await updateDoc(fideliteRef, {
          points: nouveauxPoints,
          cadeauxDebloques,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.error('Fidelite avis error:', err);
    }
    setAvisEnvoye(true);
    setAvisOpen(false);
  };

  const timerPct = consultation
    ? Math.max(0, (secondesRestantes / (consultation.minutes * 60)) * 100)
    : 100;

  const timerColor = secondesRestantes < 60 ? '#E24B4A'
    : secondesRestantes < 120 ? '#EF9F27' : '#fff';

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <Stars />
        <div style={{ textAlign: 'center', color: 'var(--vd)', fontFamily: "'Playfair Display',serif", fontSize: '1.2rem' }}>
          Chargement de ta consultation…
        </div>
      </div>
    );
  }

  if (bloque && consultation?.statut === 'terminee' && messages.length > 0) {
    return (
      <>
        <Stars />
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '1rem', height: '100vh', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ padding: '1rem 1.25rem', background: 'linear-gradient(135deg, var(--v), var(--pd))', borderRadius: 'var(--r2)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.1rem' }}>✦ Fiona — Consultation terminée</div>
            <Link href="/historique" style={{ color: 'rgba(255,255,255,0.85)', fontSize: '13px' }}>← Retour</Link>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', padding: '4px 0' }}>
            {messages.map(msg => {
              if (msg.type === 'alerte') return <div key={msg.id} className="alert-msg" style={{ alignSelf: 'center' }}>{msg.texte}</div>;
              const isClient = msg.auteur === 'client';
              return (
                <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignSelf: isClient ? 'flex-end' : 'flex-start', alignItems: isClient ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                  <div className={isClient ? 'bubble-client' : 'bubble-admin'} style={{ padding: '10px 15px', borderRadius: '18px', fontSize: '14px', lineHeight: 1.6 }}>{msg.texte}</div>
                </div>
              );
            })}
          </div>
          {avisOpen && !avisEnvoye && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(42,26,74,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem' }}>
              <div className="card" style={{ maxWidth: 380, width: '100%', padding: '2rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⭐</div>
                <h3 style={{ fontFamily: "'Playfair Display',serif", color: 'var(--vd)', marginBottom: '0.5rem' }}>
                  Comment s'est passée ta consultation ?
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '1.5rem' }}>
                  Ton avis aide d'autres personnes à me faire confiance ✨
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '1.5rem' }}>
                  {[1,2,3,4,5].map(n => (
                    <span key={n} onClick={() => setAvisNote(n)} style={{ fontSize: '2rem', cursor: 'pointer', opacity: n <= avisNote ? 1 : 0.3, transition: 'opacity 0.15s' }}>⭐</span>
                  ))}
                </div>
                <textarea
                  value={avisTexte}
                  onChange={e => setAvisTexte(e.target.value)}
                  placeholder="Dis-moi ce que tu as pensé de la consultation..."
                  rows={3}
                  style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 14px', fontFamily: "'DM Sans',sans-serif", fontSize: '14px', resize: 'none', outline: 'none', color: 'var(--txt)', marginBottom: '1rem', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setAvisOpen(false)} className="btn btn-outline" style={{ flex: 1 }}>Plus tard</button>
                  <button onClick={envoyerAvis} className="btn btn-primary" style={{ flex: 2 }}>Envoyer mon avis ✦</button>
                </div>
              </div>
            </div>
          )}
          <Link href={`/reserver?ancien=${consultationId}`} className="btn btn-primary" style={{ textAlign: 'center' }}>Nouvelle consultation ✦</Link>
        </div>
      </>
    );
  }

  if (consultation?.statut === 'en_attente') {
    return (
      <>
        <Stars />
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem' }}>
          <div className="card" style={{ maxWidth: 480, width: '100%', padding: '3rem 2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✦</div>
            <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.6rem', color: 'var(--vd)', marginBottom: '1rem' }}>
              Tu es dans la salle d'attente
            </h1>
            <p style={{ color: 'var(--muted)', lineHeight: 1.7, marginBottom: '1.5rem' }}>
              Ton paiement a bien été reçu. Je vais démarrer ta consultation très bientôt.
              Le chronomètre ne démarrera qu'une fois que j'aurai accepté ta demande.
            </p>
            <div style={{ padding: '1rem', borderRadius: 'var(--r)', background: 'rgba(123,94,167,0.08)', border: '1px solid var(--vl)', fontSize: '14px', color: 'var(--vd)' }}>
              ⏳ En attente de confirmation…
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Stars />
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', maxWidth: 700, margin: '0 auto', padding: '0.75rem', gap: '0.75rem' }}>

        <div style={{ background: 'linear-gradient(135deg, var(--v), var(--pd))', borderRadius: 'var(--r2)', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 8px 32px rgba(123,94,167,0.35)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', border: '2px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Playfair Display',serif", color: '#fff', fontWeight: 500, fontSize: '1.1rem' }}>F</div>
            <div>
              <div style={{ color: '#fff', fontWeight: 500, fontSize: '1rem' }}>Fiona</div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#6EE895', display: 'inline-block' }} />
                En ligne
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="timer-display" style={{ color: timerColor, transition: 'color 0.5s' }}>{formatTimer(secondesRestantes)}</div>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '11px' }}>Temps restant</div>
          </div>
        </div>

        <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.4)', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 3, background: secondesRestantes < 60 ? 'linear-gradient(90deg, #E24B4A, #F09595)' : secondesRestantes < 120 ? 'linear-gradient(90deg, #EF9F27, #FAC775)' : 'linear-gradient(90deg, var(--v), var(--pd))', width: `${timerPct}%`, transition: 'width 1s linear, background 0.5s' }} />
        </div>

        <div style={{ background: 'rgba(255,255,255,0.85)', borderRadius: 'var(--r)', border: '1px solid var(--border)', padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
          <span style={{ color: 'var(--muted)' }}>✦ Consultation en cours</span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setAjoutTempsOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--v)', fontSize: '13px', fontWeight: 500, padding: 0 }}>+ Ajouter du temps</button>
            <button onClick={() => router.push('/historique')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '13px', padding: 0 }}>Terminer</button>
          </div>
        </div>

        <div ref={msgsRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', padding: '4px 0' }}>
          {messages.map(msg => {
            if (msg.type === 'alerte') return (
              <div key={msg.id} className="alert-msg" style={{ alignSelf: 'center' }}>{msg.texte}</div>
            );
            const isClient = msg.auteur === 'client';
            return (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignSelf: isClient ? 'flex-end' : 'flex-start', alignItems: isClient ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                <div className={isClient ? 'bubble-client' : 'bubble-admin'} style={{ padding: '10px 15px', borderRadius: '18px', fontSize: '14px', lineHeight: 1.6 }}>{msg.texte}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '3px', padding: '0 4px' }}>
                  {msg.createdAt?.toDate?.()?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) || ''}
                </div>
              </div>
            );
          })}
        </div>

        {adminIsTyping && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px', color: 'var(--muted)', fontSize: '13px', fontStyle: 'italic' }}>
            <div style={{ display: 'flex', gap: '3px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--v)', display: 'inline-block', animation: 'bounce 1s infinite' }} />
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--v)', display: 'inline-block', animation: 'bounce 1s infinite 0.2s' }} />
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--v)', display: 'inline-block', animation: 'bounce 1s infinite 0.4s' }} />
            </div>
            Fiona est en train d'écrire…
          </div>
        )}

        <div style={{ background: 'rgba(255,255,255,0.9)', borderRadius: 'var(--r2)', border: '1px solid var(--border)', padding: '10px 12px', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyerMessage(); } }}
            placeholder={bloque ? 'Ton temps est écoulé. Ajoute du temps pour continuer.' : 'Écris ton message… (Entrée pour envoyer)'}
            disabled={bloque}
            style={{ flex: 1, border: 'none', outline: 'none', resize: 'none', fontFamily: "'DM Sans',sans-serif", fontSize: '14px', lineHeight: 1.5, background: 'transparent', color: 'var(--txt)', maxHeight: 120, opacity: bloque ? 0.5 : 1 }}
            rows={1}
          />
          <button onClick={envoyerMessage} disabled={bloque || !input.trim()} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: bloque || !input.trim() ? 'rgba(123,94,167,0.2)' : 'linear-gradient(135deg, var(--v), var(--pd))', color: '#fff', cursor: bloque ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0, boxShadow: bloque ? 'none' : '0 4px 12px rgba(123,94,167,0.35)', transition: 'all 0.2s' }}>↑</button>
        </div>
      </div>

      {ajoutTempsOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(42,26,74,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem' }}>
          <div className="card" style={{ maxWidth: 380, width: '100%', padding: '2rem' }}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", color: 'var(--vd)', marginBottom: '1rem' }}>Ajouter du temps ✦</h3>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              Tarif actuel : <strong style={{ color: 'var(--vd)' }}>{tarif}€/min</strong>
              {tarif === 5 ? ' (week-end)' : ' (semaine)'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginBottom: '1.5rem' }}>
              {[5, 10, 15, 20, 30, 45].map(m => (
                <div key={m} onClick={() => setAjoutMinutes(m)} style={{ padding: '12px', borderRadius: 'var(--r)', textAlign: 'center', border: `1.5px solid ${ajoutMinutes === m ? 'var(--v)' : 'var(--border)'}`, background: ajoutMinutes === m ? 'rgba(123,94,167,0.08)' : 'transparent', cursor: 'pointer', transition: 'all 0.15s' }}>
                  <div style={{ fontWeight: 600, color: 'var(--vd)' }}>{m} min</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{(m * tarif).toFixed(0)}€</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setAjoutTempsOpen(false)} className="btn btn-outline" style={{ flex: 1 }}>Annuler</button>
              <button onClick={handleAjouterTemps} disabled={loadingAjout} className="btn btn-primary" style={{ flex: 2 }}>
                {loadingAjout ? 'Redirection…' : `Payer ${(ajoutMinutes * tarif).toFixed(0)}€ →`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

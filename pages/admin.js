import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  collection, doc, onSnapshot, query, orderBy,
  addDoc, updateDoc, serverTimestamp, where, getDoc, setDoc, deleteDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../components/AuthContext';
import Stars from '../components/Stars';

export default function Admin() {
  const { user, isAdmin, loading, deconnexion } = useAuth();
  const router = useRouter();

  const [consultations, setConsultations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reponse, setReponse] = useState('');
  const [search, setSearch] = useState('');
  const [statut, setStatut] = useState('En ligne');
  const [sonActif, setSonActif] = useState(false);
  const [timers, setTimers] = useState({});
  const [onglet, setOnglet] = useState('conversations');
  const [avis, setAvis] = useState([]);
  const [tiragesEnAttente, setTiragesEnAttente] = useState(0);
  const [consultationsTirageEnAttente, setConsultationsTirageEnAttente] = useState(0);
  const notifSound = useRef(null);
  const msgsRef = useRef(null);
  const prevConsultationIds = useRef(new Set());
  const timerIntervals = useRef({});

  useEffect(() => {
    if (typeof AudioContext !== 'undefined') {
      const ctx = new AudioContext();
      notifSound.current = {
        play: () => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g);
          g.connect(ctx.destination);
          o.frequency.setValueAtTime(880, ctx.currentTime);
          o.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
          g.gain.setValueAtTime(0.3, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          o.start(ctx.currentTime);
          o.stop(ctx.currentTime + 0.4);
          return Promise.resolve();
        }
      };
    }
  }, []);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push('/');
  }, [user, isAdmin, loading]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'statut'), snap => {
      if (snap.exists()) setStatut(snap.data().statut || 'En ligne');
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'avis'), snap => {
      setAvis(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'tirages'), snap => {
      const enAttente = snap.docs.filter(d => d.data().statut === 'en_attente').length;
      setTiragesEnAttente(enAttente);
    });
    return unsub;
  }, []);

  // Ecoute les nouvelles consultations tirage personnalise
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'consultations_tirage'), snap => {
      const enAttente = snap.docs.filter(d =>
        ['en_attente', 'prix_envoyes', 'paye'].includes(d.data().statut)
      ).length;
      setConsultationsTirageEnAttente(enAttente);
    });
    return unsub;
  }, []);

  useEffect(() => {
    consultations.forEach(c => {
      if (c.statut === 'active' && c.secondesRestantes > 0) {
        if (!timerIntervals.current[c.id]) {
          setTimers(prev => {
            if (!(c.id in prev)) return { ...prev, [c.id]: c.secondesRestantes };
            return prev;
          });
          timerIntervals.current[c.id] = setInterval(() => {
            setTimers(prev => {
              const current = prev[c.id];
              if (current === undefined) return prev;
              const next = current - 1;
              if (next <= 0) {
                clearInterval(timerIntervals.current[c.id]);
                delete timerIntervals.current[c.id];
                updateDoc(doc(db, 'consultations', c.id), { secondesRestantes: 0, statut: 'terminee' });
                return { ...prev, [c.id]: 0 };
              }
              if (next % 30 === 0) {
                updateDoc(doc(db, 'consultations', c.id), { secondesRestantes: next });
              }
              return { ...prev, [c.id]: next };
            });
          }, 1000);
        }
      } else {
        if (timerIntervals.current[c.id]) {
          clearInterval(timerIntervals.current[c.id]);
          delete timerIntervals.current[c.id];
        }
        if (!(c.id in timers)) {
          setTimers(prev => ({ ...prev, [c.id]: c.secondesRestantes ?? 0 }));
        }
      }
    });
  }, [consultations.map(c => c.id + '-' + c.statut).join(','), sonActif]);

  useEffect(() => {
    const q = query(collection(db, 'consultations'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (sonActif) {
        data.forEach(c => {
          if (c.statut === 'en_attente' && !prevConsultationIds.current.has(c.id)) {
            notifSound.current?.play().catch(() => {});
          }
        });
      }
      prevConsultationIds.current = new Set(data.map(c => c.id));
      setConsultations(data);
      data.forEach(c => {
        if (!(c.id in timers)) {
          setTimers(prev => ({ ...prev, [c.id]: c.secondesRestantes ?? 0 }));
        }
      });
    });
    return unsub;
  }, [sonActif]);

  useEffect(() => {
    if (!selected) return;
    const q = query(
      collection(db, 'consultations', selected, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const dernierMsg = msgs[msgs.length - 1];
      if (dernierMsg?.auteur === 'client' && sonActif) {
        notifSound.current?.play().catch(() => {});
      }
      setMessages(msgs);
      setTimeout(() => {
        if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
      }, 50);
    });
    return unsub;
  }, [selected, sonActif]);

  useEffect(() => {
    if (!selected) return;
    updateDoc(doc(db, 'consultations', selected), { messagesNonLus: 0 }).catch(() => {});
  }, [selected]);

  const changerStatut = async (nouveau) => {
    setStatut(nouveau);
    await fetch('/api/set-statut', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: nouveau }),
    });
  };

  const accepterConsultation = async (id) => {
    await updateDoc(doc(db, 'consultations', id), {
      statut: 'active',
      debutAt: serverTimestamp(),
    });
    await addDoc(collection(db, 'consultations', id, 'messages'), {
      texte: "Coucou et bienvenue ✨ Prends quelques instants pour m'expliquer ta situation calmement. Ensuite, pose-moi tes questions une par une pour que je puisse te répondre de la façon la plus claire possible. Le temps de consultation est en cours et le compteur s'affiche en haut du chat.",
      auteur: 'admin', type: 'message', lu: true, createdAt: serverTimestamp(),
    });
    fetch('/api/send-notif', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consultationId: id }),
    }).catch(() => {});
    await fetch('/api/set-statut', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: 'En consultation' }),
    });
    const consultation = consultations.find(c => c.id === id);
    if (consultation && consultation.paiement === 'wero' && consultation.userId) {
      try {
        const fideliteRef = doc(db, 'fidelite', consultation.userId);
        const fideliteSnap = await getDoc(fideliteRef);
        const montantEuros = parseFloat(consultation.montant || 0);
        const getStatutVIP = (total) => {
          if (total >= 600) return 'vip';
          if (total >= 300) return 'gold';
          if (total >= 100) return 'silver';
          return 'bronze';
        };
        if (!fideliteSnap.exists()) {
          const pointsInitiaux = Math.floor(montantEuros) + 20;
          await setDoc(fideliteRef, {
            userId: consultation.userId,
            points: pointsInitiaux,
            totalDepense: montantEuros,
            statut: getStatutVIP(montantEuros),
            premiereConsultation: true,
            cadeauxUtilises: [],
            cadeauxDebloques: [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          const data = fideliteSnap.data();
          const nouveauTotal = (data.totalDepense || 0) + montantEuros;
          const nouveauxPoints = (data.points || 0) + Math.floor(montantEuros);
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
        console.error('Fidelite Wero error:', err);
      }
    }
  };

  const handleTyping = async () => {
    if (!selected) return;
    await updateDoc(doc(db, 'consultations', selected), {
      adminIsTyping: true,
      adminTypingAt: serverTimestamp(),
    });
    setTimeout(async () => {
      await updateDoc(doc(db, 'consultations', selected), { adminIsTyping: false });
    }, 3000);
  };

  const envoyerReponse = async () => {
    if (!reponse.trim() || !selected) return;
    const texte = reponse.trim();
    setReponse('');
    await addDoc(collection(db, 'consultations', selected, 'messages'), {
      texte, auteur: 'admin', type: 'message', lu: true, createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'consultations', selected), {
      lastMessageAdmin: texte, lastMessageAdminAt: serverTimestamp(),
    });
  };

  const terminerConsultation = async (id) => {
    if (!confirm('Terminer cette consultation ?')) return;
    await updateDoc(doc(db, 'consultations', id), { statut: 'terminee', secondesRestantes: 0 });
    await addDoc(collection(db, 'consultations', id, 'messages'), {
      texte: 'La consultation a ete cloturee.', auteur: 'system', type: 'alerte', createdAt: serverTimestamp(),
    });
    await fetch('/api/set-statut', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: 'En ligne' }),
    });
  };

  const quickMsg = (txt) => setReponse(txt);

  const formatTimer = (id) => {
    const secs = timers[id] ?? 0;
    if (!secs) return '00:00';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  };

  const timerColor = (id) => {
    const secs = timers[id] ?? 0;
    if (secs < 60) return '#C0305A';
    if (secs < 120) return '#B07800';
    return 'var(--v)';
  };

  const actives = consultations.filter(c => c.statut === 'active').sort((a, b) => (b.prioritaire ? 1 : 0) - (a.prioritaire ? 1 : 0));
  const enAttente = consultations.filter(c => c.statut === 'en_attente').sort((a, b) => (b.prioritaire ? 1 : 0) - (a.prioritaire ? 1 : 0));
  const terminees = consultations.filter(c => c.statut === 'terminee');
  const totalNonLus = consultations.reduce((acc, c) => acc + (c.messagesNonLus || 0), 0);
  const totalPaye = consultations
    .filter(c => c.statut !== 'pending' && c.statut !== 'en_attente')
    .reduce((acc, c) => acc + (c.paiement === 'wero' ? parseFloat(c.montant || 0) : (c.montantPaye || 0) / 100), 0);
  const avisEnAttente = avis.filter(a => !a.visible).length;

  const filteredConsultations = consultations.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (c.prenom || '').toLowerCase().includes(s) || (c.sujet || '').toLowerCase().includes(s);
  });

  const selectedData = consultations.find(c => c.id === selected);

  const clientsMap = {};
  consultations.forEach(c => {
    if (!c.userId) return;
    if (!clientsMap[c.userId]) {
      clientsMap[c.userId] = { userId: c.userId, prenom: c.prenom, email: c.email || '', telephone: c.telephone || '', totalDepense: 0, nbConsultations: 0 };
    }
    const montant = c.paiement === 'wero' ? parseFloat(c.montant || 0) : (c.montantPaye || 0) / 100;
    clientsMap[c.userId].totalDepense += montant;
    clientsMap[c.userId].nbConsultations += 1;
    if (c.telephone) clientsMap[c.userId].telephone = c.telephone;
    if (c.email) clientsMap[c.userId].email = c.email;
  });
  const clients = Object.values(clientsMap).sort((a, b) => b.totalDepense - a.totalDepense);

  if (loading) return null;

  return (
    <>
      <Stars />
      <div style={{ minHeight: '100vh', padding: '1rem', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', padding: '1rem 1.5rem', background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(12px)', borderRadius: 'var(--r2)', border: '1px solid var(--border)' }}>
          <span style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.3rem', color: 'var(--vd)' }}>
            ✦ Dashboard Fiona
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '50px', fontSize: '12px', fontWeight: 500, background: statut === 'En ligne' ? 'rgba(60,160,100,0.12)' : statut === 'En consultation' ? 'rgba(240,192,64,0.15)' : 'rgba(200,60,80,0.1)', color: statut === 'En ligne' ? '#1A7040' : statut === 'En consultation' ? '#7A4A00' : '#A02040' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: statut === 'En ligne' ? '#3CA060' : statut === 'En consultation' ? '#F0C040' : '#C0305A', display: 'inline-block' }} />
              {statut}
            </div>
            <button onClick={() => changerStatut(statut === 'En ligne' ? 'Hors ligne' : 'En ligne')} className="btn btn-outline" style={{ fontSize: '13px', padding: '7px 16px' }}>
              {statut === 'En ligne' ? 'Passer hors ligne' : 'Passer en ligne'}
            </button>
            <button onClick={() => { setSonActif(s => !s); notifSound.current?.play().catch(() => {}); }} className="btn btn-outline" style={{ fontSize: '13px', padding: '7px 16px' }}>
              {sonActif ? 'Son active 🔊' : 'Activer le son 🔇'}
            </button>
            <button onClick={async () => {
              await fetch('/api/set-statut', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ statut: 'Hors ligne' }) });
              await deconnexion();
              router.push('/');
            }} className="btn btn-outline" style={{ fontSize: '13px', padding: '7px 16px', color: '#A02040', borderColor: '#E0B0C0' }}>
              Deconnexion
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '1rem' }}>
          {[
            { label: 'Actives', val: actives.length, color: 'var(--v)' },
            { label: 'En attente', val: enAttente.length, color: '#B07800' },
            { label: 'Terminees', val: terminees.length, color: 'var(--muted)' },
            { label: 'Non lus', val: totalNonLus, color: '#C0305A' },
            { label: 'Encaisse', val: totalPaye.toFixed(0) + 'e', color: '#1A7040' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.88)', borderRadius: 'var(--r)', border: '1px solid var(--border)', padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.6rem', fontFamily: "'Playfair Display',serif", color: s.color }}>{s.val}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {['conversations', 'consultations-tirage', 'contacts', 'avis', 'tirages'].map(o => (
            <button key={o} onClick={() => setOnglet(o)} style={{ padding: '8px 20px', borderRadius: '50px', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", fontSize: '14px', fontWeight: 500, background: onglet === o ? 'linear-gradient(135deg, var(--v), var(--pd))' : 'rgba(255,255,255,0.8)', color: onglet === o ? '#fff' : 'var(--muted)', border: onglet === o ? 'none' : '1px solid var(--border)', position: 'relative' }}>
              {o === 'conversations' ? 'Conversations'
                : o === 'contacts' ? 'Mes clients'
                : o === 'consultations-tirage' ? (
                  <span>
                    Tirages perso
                    {consultationsTirageEnAttente > 0 && (
                      <span style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#C0305A', color: '#fff', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {consultationsTirageEnAttente}
                      </span>
                    )}
                  </span>
                )
                : o === 'avis' ? (
                  <span>
                    Avis clients
                    {avisEnAttente > 0 && (
                      <span style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#C0305A', color: '#fff', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {avisEnAttente}
                      </span>
                    )}
                  </span>
                ) : (
                  <span>
                    Tirages
                    {tiragesEnAttente > 0 && (
                      <span style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#C0305A', color: '#fff', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {tiragesEnAttente}
                      </span>
                    )}
                  </span>
                )}
            </button>
          ))}
        </div>

        {onglet === 'consultations-tirage' && <ConsultationsTirageAdmin user={user} />}
        {onglet === 'tirages' && <TiragesAdmin />}

        {onglet === 'avis' && (
          <div style={{ background: 'rgba(255,255,255,0.88)', borderRadius: 'var(--r2)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.2rem', color: 'var(--vd)' }}>Avis clients</h2>
              {avisEnAttente > 0 && (
                <div style={{ padding: '4px 12px', borderRadius: '50px', background: 'rgba(200,60,80,0.1)', color: '#A02040', fontSize: '12px', fontWeight: 500 }}>
                  {avisEnAttente} en attente de publication
                </div>
              )}
            </div>
            <AvisAdmin />
          </div>
        )}

        {onglet === 'contacts' && (
          <div style={{ background: 'rgba(255,255,255,0.88)', borderRadius: 'var(--r2)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.2rem', color: 'var(--vd)' }}>Mes clients</h2>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: 'rgba(123,94,167,0.06)' }}>
                    {['Prenom', 'Email', 'Telephone', 'Consultations', 'Total depense'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--muted)', fontWeight: 500, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client, i) => (
                    <tr key={client.userId} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(123,94,167,0.02)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--vd)' }}>{client.prenom}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--muted)' }}>{client.email || '-'}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--muted)' }}>{client.telephone || '-'}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--muted)' }}>{client.nbConsultations}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1A7040' }}>{client.totalDepense.toFixed(2)}e</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {onglet === 'conversations' && (
          <div>
            {enAttente.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                {enAttente.map(c => (
                  <div key={c.id} style={{ padding: '1rem 1.5rem', borderRadius: 'var(--r)', background: 'rgba(255,220,100,0.15)', border: '2px solid #F0C040', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--vd)' }}>
                        {c.prioritaire && <span style={{ color: '#F0C040', marginRight: '4px' }}>PRIORITAIRE</span>}
                        {c.cadeauUtilise && <span style={{ marginRight: '4px' }}>Cadeau</span>}
                        Nouvelle demande - {c.prenom}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '3px' }}>
                        {c.domaine} - {c.sujet} - {c.minutes} min - {c.paiement === 'wero' ? parseFloat(c.montant || 0).toFixed(2) + 'e via Wero' : ((c.montantPaye || 0) / 100).toFixed(2) + 'e via Stripe'} paye
                      </div>
                      {c.paiement === 'wero' && c.telephone && (
                        <div style={{ fontSize: '13px', color: 'var(--vd)', marginTop: '4px', fontWeight: 500 }}>Tel: {c.telephone}</div>
                      )}
                    </div>
                    <button onClick={() => accepterConsultation(c.id)} style={{ padding: '10px 24px', borderRadius: '50px', background: 'linear-gradient(135deg, var(--v), var(--pd))', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", fontWeight: 600, fontSize: '14px' }}>
                      Accepter et Demarrer
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1rem', height: 'calc(100vh - 280px)' }}>
              <div style={{ background: 'rgba(255,255,255,0.88)', borderRadius: 'var(--r2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border)' }}>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Chercher un client" style={{ width: '100%', border: '1px solid var(--border)', borderRadius: '50px', padding: '7px 14px', fontSize: '13px', background: 'var(--bg)', color: 'var(--txt)', outline: 'none', fontFamily: "'DM Sans',sans-serif" }} />
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
                  {filteredConsultations.map(c => (
                    <div key={c.id} onClick={() => setSelected(c.id)} style={{ padding: '0.85rem', borderRadius: 'var(--r)', cursor: 'pointer', marginBottom: '4px', position: 'relative', transition: 'all 0.15s', background: selected === c.id ? 'rgba(123,94,167,0.1)' : 'transparent', border: selected === c.id ? '1px solid var(--vl)' : '1px solid transparent' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div style={{ fontWeight: 500, fontSize: '14px', color: 'var(--vd)' }}>{c.prenom}</div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: timerColor(c.id) }}>
                          {c.statut === 'active' ? formatTimer(c.id) : c.statut === 'en_attente' ? 'Attente' : 'OK'}
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.domaine} - {c.sujet}
                      </div>
                      {c.messagesNonLus > 0 && (
                        <div style={{ position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: '50%', background: 'var(--pd)', color: '#fff', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {c.messagesNonLus}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {selected && selectedData ? (
                <div style={{ background: 'rgba(255,255,255,0.88)', borderRadius: 'var(--r2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, var(--vl), var(--pl))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '14px', color: 'var(--vd)' }}>
                        {(selectedData.prenom || 'C')[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: '15px', color: 'var(--vd)' }}>{selectedData.prenom}</div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                          {selectedData.domaine} - {selectedData.sujet}
                          {selectedData.telephone ? ' - Tel: ' + selectedData.telephone : ''}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {selectedData.statut === 'en_attente' && (
                        <button onClick={() => accepterConsultation(selected)} style={{ padding: '8px 20px', borderRadius: '50px', background: 'linear-gradient(135deg, var(--v), var(--pd))', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", fontWeight: 600, fontSize: '13px' }}>
                          Accepter et Demarrer
                        </button>
                      )}
                      {selectedData.statut === 'active' && (
                        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.4rem', color: timerColor(selected) }}>
                          {formatTimer(selected)}
                        </div>
                      )}
                      <button onClick={() => terminerConsultation(selected)} style={{ padding: '6px 14px', borderRadius: '50px', border: '1px solid #E0B0C0', background: 'rgba(200,60,80,0.06)', color: '#A02040', cursor: 'pointer', fontSize: '12px', fontFamily: "'DM Sans',sans-serif" }}>
                        Terminer
                      </button>
                    </div>
                  </div>
                  {selectedData.message && (
                    <div style={{ padding: '10px 1.25rem', background: 'rgba(123,94,167,0.05)', borderBottom: '1px solid var(--border)', fontSize: '13px', color: 'var(--muted)' }}>
                      <strong style={{ color: 'var(--vd)' }}>Contexte: </strong>{selectedData.message}
                    </div>
                  )}
                  <div style={{ padding: '8px 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {["Coucou et bienvenue", "Pose-moi tes questions une par une", "Il te reste peu de temps", "Merci pour cette consultation"].map(msg => (
                      <button key={msg} onClick={() => quickMsg(msg)} style={{ padding: '4px 12px', borderRadius: '50px', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: '12px', color: 'var(--muted)', fontFamily: "'DM Sans',sans-serif" }}>{msg}</button>
                    ))}
                  </div>
                  <div ref={msgsRef} style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {messages.map(msg => {
                      if (msg.type === 'alerte') return (
                        <div key={msg.id} className="alert-msg" style={{ alignSelf: 'center' }}>{msg.texte}</div>
                      );
                      const isAdminMsg = msg.auteur === 'admin';
                      return (
                        <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignSelf: isAdminMsg ? 'flex-end' : 'flex-start', alignItems: isAdminMsg ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                          <div className={isAdminMsg ? 'bubble-client' : 'bubble-admin'} style={{ padding: '10px 15px', borderRadius: '18px', fontSize: '14px', lineHeight: 1.6 }}>
                            {msg.texte}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '3px', padding: '0 4px' }}>
                            {msg.auteur === 'admin' ? 'Fiona' : selectedData.prenom}
                            {isAdminMsg && <span style={{ marginLeft: '4px', color: msg.lu ? '#3CA060' : 'var(--muted)' }}>{msg.lu ? 'lu' : 'envoye'}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ padding: '10px 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', alignItems: 'flex-end', background: 'rgba(255,255,255,0.95)' }}>
                    <textarea value={reponse} onChange={e => { setReponse(e.target.value); handleTyping(); }}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyerReponse(); } }}
                      placeholder={'Repondre a ' + (selectedData.prenom || '') + '...'} rows={2}
                      style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 14px', fontFamily: "'DM Sans',sans-serif", fontSize: '14px', resize: 'none', outline: 'none', color: 'var(--txt)', background: 'var(--bgs)' }} />
                    <button onClick={envoyerReponse} style={{ width: 42, height: 42, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg, var(--v), var(--pd))', color: '#fff', cursor: 'pointer', fontSize: '16px' }}>
                      ↑
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 'var(--r2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: 'var(--muted)' }}>
                  <div style={{ fontSize: '3rem', opacity: 0.3 }}>✦</div>
                  <div style={{ fontSize: '15px' }}>Selectionne une conversation</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ============================================================
// NOUVEAU : Gestion des consultations tirage personnalise
// ============================================================
function ConsultationsTirageAdmin({ user }) {
  const [demandes, setDemandes] = useState([]);
  const [open, setOpen] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'consultations_tirage'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setDemandes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const setTiragePrix = (demandeId, tirageIdx, prix) => {
    setDemandes(prev => prev.map(d => {
      if (d.id !== demandeId) return d;
      const tirages = [...d.tirages];
      tirages[tirageIdx] = { ...tirages[tirageIdx], prix: parseFloat(prix) || 0 };
      return { ...d, tirages };
    }));
  };

  const setRemise = (demandeId, remise) => {
    setDemandes(prev => prev.map(d =>
      d.id === demandeId ? { ...d, remise: parseFloat(remise) || 0 } : d
    ));
  };

  const envoyerPrix = async (d) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'consultations_tirage', d.id), {
        tirages: d.tirages,
        remise: d.remise || 0,
        statut: 'prix_envoyes',
      });
      setOpen(null);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const calcTotal = (d) => {
    const base = (d.tirages || []).reduce((s, t) => s + (t.prix || 0), 0);
    const we = d.isWeekend ? 14 : 0;
    const remise = d.remise || 0;
    return base + we - remise;
  };

  const statutLabel = (s) => {
    if (s === 'en_attente') return { txt: 'Nouveau', bg: 'rgba(255,220,100,0.2)', color: '#7A4A00' };
    if (s === 'prix_envoyes') return { txt: 'Prix envoyés', bg: 'rgba(123,94,167,0.1)', color: 'var(--vd)' };
    if (s === 'en_attente_paiement' || s === 'en_attente_paiement_wero') return { txt: 'Attente paiement', bg: 'rgba(60,160,100,0.1)', color: '#1A7040' };
    if (s === 'paye') return { txt: 'Payé', bg: 'rgba(60,160,100,0.15)', color: '#1A7040' };
    return { txt: s, bg: 'var(--border)', color: 'var(--muted)' };
  };

  return (
    <div style={{ background: 'rgba(255,255,255,0.88)', borderRadius: 'var(--r2)', border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.2rem', color: 'var(--vd)' }}>Consultations tirage personnalise</h2>
        <div style={{ fontSize: '13px', color: 'var(--muted)' }}>{demandes.length} demandes</div>
      </div>

      {demandes.length === 0 && (
        <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '14px', fontStyle: 'italic' }}>
          Aucune demande pour l'instant.
        </p>
      )}

      {demandes.map(d => {
        const isOpen = open === d.id;
        const sl = statutLabel(d.statut);
        const isSent = ['prix_envoyes', 'en_attente_paiement', 'en_attente_paiement_wero', 'paye'].includes(d.statut);
        const presets = [5, 10, 15, 20];

        return (
          <div key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
            {/* Header demande */}
            <div
              onClick={() => setOpen(isOpen ? null : d.id)}
              style={{ padding: '1rem 1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: isOpen ? 'rgba(123,94,167,0.04)' : 'transparent' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: '15px', color: 'var(--vd)', marginBottom: 2 }}>{d.prenom}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  {d.type} · {d.tirages?.length || 0} tirages · {d.isWeekend ? 'Week-end' : 'Semaine'}
                  {d.telephone ? ' · ' + d.telephone : ''}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '50px', background: sl.bg, color: sl.color, fontWeight: 500, whiteSpace: 'nowrap' }}>
                  {sl.txt}
                </span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{isOpen ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* Corps demande */}
            {isOpen && (
              <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,0.5)' }}>

                {/* Situation et questions */}
                <div style={{ background: 'rgba(123,94,167,0.05)', borderRadius: 'var(--r)', padding: '0.85rem 1rem', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: '0.3rem' }}>Situation</div>
                  <p style={{ fontSize: '13px', color: 'var(--txt)', lineHeight: 1.65 }}>{d.situation}</p>
                </div>
                <div style={{ background: 'rgba(123,94,167,0.05)', borderRadius: 'var(--r)', padding: '0.85rem 1rem', marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: '0.3rem' }}>Questions</div>
                  <p style={{ fontSize: '13px', color: 'var(--txt)', lineHeight: 1.65 }}>{d.questions}</p>
                </div>

                {/* Tirages avec prix */}
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: '0.85rem' }}>
                  Tirages suggeres — saisir le prix
                </div>
                {(d.tirages || []).map((t, i) => (
                  <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '1rem 1.25rem', marginBottom: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: '0.5rem' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 2 }}>Tirage {i + 1}</div>
                        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '17px', color: 'var(--vd)' }}>{t.emoji} {t.nom}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <input
                          type="number" min="0" placeholder="0"
                          value={t.prix || ''}
                          disabled={isSent}
                          onChange={e => setTiragePrix(d.id, i, e.target.value)}
                          style={{ width: 75, border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '6px 8px', fontFamily: "'DM Sans',sans-serif", fontSize: '15px', textAlign: 'right', color: 'var(--txt)', background: isSent ? 'var(--bgs)' : 'white' }}
                        />
                        <span style={{ fontSize: '14px', color: 'var(--muted)' }}>€</span>
                      </div>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '0.6rem' }}>{t.intro}</p>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.35rem' }}>Ce que l'on regarde</div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 0.6rem' }}>
                      {(t.regards || []).map((r, j) => (
                        <li key={j} style={{ fontSize: '12px', color: 'var(--muted)', padding: '2px 0 2px 12px', position: 'relative', lineHeight: 1.6 }}>
                          <span style={{ position: 'absolute', left: 2 }}>·</span>{r}
                        </li>
                      ))}
                    </ul>
                    <p style={{ fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic' }}>👉 {t.ideal}</p>
                  </div>
                ))}

                {/* Remise (si 2+ tirages) */}
                {(d.tirages || []).length >= 2 && (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: '0.75rem' }}>Remise multi-tirages</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <input
                        type="number" min="0" placeholder="0"
                        value={d.remise || ''}
                        disabled={isSent}
                        onChange={e => setRemise(d.id, e.target.value)}
                        style={{ width: 90, border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '7px 10px', fontFamily: "'DM Sans',sans-serif", fontSize: '15px', textAlign: 'right', color: 'var(--txt)', background: isSent ? 'var(--bgs)' : 'white' }}
                      />
                      <span style={{ fontSize: '14px', color: 'var(--muted)' }}>€ de remise</span>
                    </div>
                    {!isSent && (
                      <div style={{ display: 'flex', gap: 6, marginTop: '0.6rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', color: 'var(--muted)', alignSelf: 'center' }}>Raccourcis :</span>
                        {presets.map(p => (
                          <button key={p} onClick={() => setRemise(d.id, p)}
                            style={{ border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '3px 10px', fontSize: '12px', color: d.remise === p ? '#fff' : 'var(--muted)', background: d.remise === p ? 'var(--v)' : 'transparent', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                            {p} €
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Recap total */}
                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '1rem 1.25rem', marginBottom: '1.25rem', background: 'rgba(123,94,167,0.04)' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: '0.75rem' }}>Recapitulatif</div>
                  {(d.tirages || []).map((t, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--muted)', padding: '3px 0' }}>
                      <span>{t.emoji} {t.nom}</span><span>{t.prix || 0} €</span>
                    </div>
                  ))}
                  {d.isWeekend && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#b45309', padding: '3px 0' }}>
                      <span>Supplement week-end (forfait unique)</span><span>+14 €</span>
                    </div>
                  )}
                  {(d.remise || 0) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#166534', padding: '3px 0' }}>
                      <span>Remise multi-tirages</span><span>-{d.remise} €</span>
                    </div>
                  )}
                  <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 600, color: 'var(--vd)' }}>
                    <span>Total cliente</span><span>{calcTotal(d)} €</span>
                  </div>
                </div>

                {!isSent ? (
                  <button
                    onClick={() => envoyerPrix(d)}
                    disabled={saving}
                    style={{ width: '100%', padding: '0.85rem', background: 'linear-gradient(135deg, var(--v), var(--pd))', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontFamily: "'DM Sans',sans-serif", fontSize: '13px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, letterSpacing: '0.05em' }}
                  >
                    Envoyer les tarifs a la cliente
                  </button>
                ) : (
                  <p style={{ textAlign: 'center', fontSize: '13px', color: '#1A7040', fontStyle: 'italic' }}>
                    Tarifs envoyes a la cliente
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Avis admin (inchange)
// ============================================================
function AvisAdmin() {
  const [avis, setAvis] = useState([]);
  useEffect(() => {
    const q = collection(db, 'avis');
    return onSnapshot(q, snap => setAvis(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  const toggleVisible = async (id, visible) => {
    await updateDoc(doc(db, 'avis', id), { visible: !visible });
  };

  const supprimerAvis = async (id) => {
    if (!confirm('Supprimer cet avis ?')) return;
    await deleteDoc(doc(db, 'avis', id));
  };

  return (
    <div style={{ padding: '1rem' }}>
      {avis.length === 0 && <p style={{ color: 'var(--muted)', padding: '1rem' }}>Aucun avis pour l'instant.</p>}
      {avis.map(a => (
        <div key={a.id} style={{ padding: '1rem', borderRadius: 'var(--r)', border: '1px solid var(--border)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: '4px' }}>
              {[1,2,3,4,5].map(n => <span key={n} style={{ opacity: n <= a.note ? 1 : 0.2 }}>⭐</span>)}
            </div>
            <p style={{ fontSize: '14px', color: 'var(--txt)', marginBottom: '4px', fontStyle: 'italic' }}>"{a.texte}"</p>
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>— {a.prenom}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={() => toggleVisible(a.id, a.visible)} style={{ padding: '6px 14px', borderRadius: '50px', border: 'none', cursor: 'pointer', background: a.visible ? 'rgba(60,160,100,0.15)' : 'rgba(200,60,80,0.1)', color: a.visible ? '#1A7040' : '#A02040', fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap' }}>
              {a.visible ? 'Visible' : 'Publier'}
            </button>
            <button onClick={() => supprimerAvis(a.id)} style={{ padding: '6px 14px', borderRadius: '50px', border: '1px solid #E0B0C0', background: 'rgba(200,60,80,0.06)', color: '#A02040', cursor: 'pointer', fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap' }}>
              Supprimer
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Tirages express (inchange)
// ============================================================
function TiragesAdmin() {
  const [tirages, setTirages] = useState([]);
  const [selectedTirage, setSelectedTirage] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reponse, setReponse] = useState('');

  useEffect(() => {
    const q = collection(db, 'tirages');
    return onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setTirages(data);
    });
  }, []);

  useEffect(() => {
    if (!selectedTirage) return;
    const q = collection(db, 'tirages', selectedTirage, 'messages');
    return onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      setMessages(msgs);
    });
  }, [selectedTirage]);

  const envoyerReponse = async () => {
    if (!reponse.trim() || !selectedTirage) return;
    const texte = reponse.trim();
    setReponse('');
    await addDoc(collection(db, 'tirages', selectedTirage, 'messages'), {
      texte, auteur: 'admin', createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'tirages', selectedTirage), {
      lastMessageAdmin: texte, lastMessageAdminAt: serverTimestamp(), statut: 'en_cours',
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
    await addDoc(collection(db, 'tirages', selectedTirage, 'messages'), {
      texte: 'Si tu souhaites plus de details, nhésite pas a prendre une consultation privee avec moi !',
      auteur: 'admin', createdAt: serverTimestamp(),
    });
  };

  const terminerTirage = async (id) => {
    await updateDoc(doc(db, 'tirages', id), { statut: 'termine' });
  };

  const tirageSelectionne = tirages.find(t => t.id === selectedTirage);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1rem', height: 'calc(100vh - 320px)' }}>
      <div style={{ background: 'rgba(255,255,255,0.88)', borderRadius: 'var(--r2)', border: '1px solid var(--border)', overflowY: 'auto' }}>
        {tirages.length === 0 && <p style={{ color: 'var(--muted)', padding: '1rem', fontSize: '14px' }}>Aucun tirage pour l'instant.</p>}
        {tirages.map(t => (
          <div key={t.id} onClick={() => setSelectedTirage(t.id)} style={{ padding: '0.85rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--border)', background: selectedTirage === t.id ? 'rgba(123,94,167,0.1)' : t.statut === 'en_attente' ? 'rgba(255,220,100,0.1)' : 'transparent' }}>
            <div style={{ fontWeight: 500, fontSize: '14px', color: 'var(--vd)', display: 'flex', justifyContent: 'space-between' }}>
              <span>🔮 {t.prenom}</span>
              {t.statut === 'en_attente' && <span style={{ fontSize: '10px', background: '#F0C040', color: '#7A4A00', padding: '2px 6px', borderRadius: '50px' }}>Nouveau</span>}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '3px' }}>
              {t.carteNom || 'Carte non tiree'} · {t.statut}
            </div>
          </div>
        ))}
      </div>

      {selectedTirage && tirageSelectionne ? (
        <div style={{ background: 'rgba(255,255,255,0.88)', borderRadius: 'var(--r2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: '15px', color: 'var(--vd)' }}>🔮 {tirageSelectionne.prenom}</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                Carte : <strong>{tirageSelectionne.carteNom || 'Non tiree'}</strong>
                {tirageSelectionne.telephone ? ' · Tel: ' + tirageSelectionne.telephone : ''}
              </div>
              {tirageSelectionne.question && (
                <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(123,94,167,0.06)', borderRadius: 'var(--r)', fontSize: '13px', color: 'var(--vd)', fontStyle: 'italic' }}>
                  "{tirageSelectionne.question}"
                </div>
              )}
            </div>
            <button onClick={() => terminerTirage(selectedTirage)} style={{ padding: '6px 14px', borderRadius: '50px', border: '1px solid #E0B0C0', background: 'rgba(200,60,80,0.06)', color: '#A02040', cursor: 'pointer', fontSize: '12px' }}>
              Terminer
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {messages.map(msg => {
              const isAdmin = msg.auteur === 'admin';
              return (
                <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignSelf: isAdmin ? 'flex-end' : 'flex-start', alignItems: isAdmin ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                  <div className={isAdmin ? 'bubble-client' : 'bubble-admin'} style={{ padding: '10px 15px', borderRadius: '18px', fontSize: '14px', lineHeight: 1.6 }}>
                    {msg.texte}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ padding: '10px 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <textarea value={reponse} onChange={e => setReponse(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyerReponse(); } }}
              placeholder={`Interpreter la carte de ${tirageSelectionne.prenom}...`} rows={2}
              style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 14px', fontFamily: "'DM Sans',sans-serif", fontSize: '14px', resize: 'none', outline: 'none', color: 'var(--txt)', background: 'var(--bgs)' }} />
            <button onClick={envoyerReponse} style={{ width: 42, height: 42, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg, var(--v), var(--pd))', color: '#fff', cursor: 'pointer', fontSize: '16px' }}>↑</button>
          </div>
        </div>
      ) : (
        <div style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 'var(--r2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', opacity: 0.3 }}>🔮</div>
            <div style={{ fontSize: '15px' }}>Selectionne un tirage</div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  collection, doc, onSnapshot, query, orderBy,
  addDoc, updateDoc, serverTimestamp, increment,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../components/AuthContext';
import Stars from '../components/Stars';

export default function Admin() {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();

  const [consultations, setConsultations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reponse, setReponse] = useState('');
  const [search, setSearch] = useState('');
  const [statut, setStatut] = useState('En ligne');
  const [sonActif, setSonActif] = useState(false);
  const [timers, setTimers] = useState({});
  const notifSound = useRef(null);
  const msgsRef = useRef(null);
  const prevMsgCount = useRef(0);
  const timerIntervals = useRef({});

  useEffect(() => {
    notifSound.current = typeof Audio !== 'undefined' ? new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3') : null;
  }, []);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push('/');
  }, [user, isAdmin, loading]);

  // Timer local synchronisé avec Firestore
  useEffect(() => {
    consultations.forEach(c => {
      if (c.statut === 'active' && c.secondesRestantes > 0) {
        if (!timerIntervals.current[c.id]) {
          timerIntervals.current[c.id] = setInterval(() => {
            setTimers(prev => {
              const current = prev[c.id] ?? c.secondesRestantes;
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
    return () => {};
  }, [consultations]);

  useEffect(() => {
    const q = query(collection(db, 'consultations'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setConsultations(data);
      data.forEach(c => {
        if (!(c.id in timers)) {
          setTimers(prev => ({ ...prev, [c.id]: c.secondesRestantes ?? 0 }));
        }
      });
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!selected) return;
    const q = query(
      collection(db, 'consultations', selected, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (msgs.length > prevMsgCount.current) {
        const last = msgs[msgs.length - 1];
        if (last?.auteur === 'client') if (sonActif) notifSound.current?.play().catch(() => {});
      }
      prevMsgCount.current = msgs.length;
      setMessages(msgs);
      setTimeout(() => {
        if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
      }, 50);
    });
    return unsub;
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    updateDoc(doc(db, 'consultations', selected), { messagesNonLus: 0 }).catch(() => {});
  }, [selected]);

  const accepterConsultation = async (id) => {
    await updateDoc(doc(db, 'consultations', id), {
      statut: 'active',
      debutAt: serverTimestamp(),
    });
    await addDoc(collection(db, 'consultations', id, 'messages'), {
      texte: 'Coucou et bienvenue ✨ Prends quelques instants pour m\'expliquer ta situation calmement. Ensuite, pose-moi tes questions une par une pour que je puisse te répondre de la façon la plus claire possible. Le temps de consultation est en cours et le compteur s\'affiche en haut du chat.',
      auteur: 'admin', type: 'message', lu: true, createdAt: serverTimestamp(),
    });
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
      texte: 'La consultation a été clôturée.', auteur: 'system', type: 'alerte', createdAt: serverTimestamp(),
    });
  };

  const quickMsg = (txt) => setReponse(txt);

  const formatTimer = (id) => {
    const secs = timers[id] ?? 0;
    if (!secs) return '00:00';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const timerColor = (id) => {
    const secs = timers[id] ?? 0;
    if (secs < 60) return '#C0305A';
    if (secs < 120) return '#B07800';
    return 'var(--v)';
  };

  const actives = consultations.filter(c => c.statut === 'active');
  const enAttente = consultations.filter(c => c.statut === 'en_attente');
  const terminees = consultations.filter(c => c.statut === 'terminee');
  const totalNonLus = consultations.reduce((acc, c) => acc + (c.messagesNonLus || 0), 0);
  const totalPaye = consultations.filter(c => c.statut !== 'pending' && c.statut !== 'en_attente')
    .reduce((acc, c) => acc + (c.montantPaye || 0), 0);

  const filteredConsultations = consultations.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.prenom?.toLowerCase().includes(s) || c.sujet?.toLowerCase().includes(s);
  });

  const selectedData = consultations.find(c => c.id === selected);

  if (loading) return null;

  return (
    <>
      <Stars />
      <div style={{ minHeight: '100vh', padding: '1rem', maxWidth: 1200, margin: '0 auto' }}>

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '1rem', padding: '1rem 1.5rem',
          background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(12px)',
          borderRadius: 'var(--r2)', border: '1px solid var(--border)',
        }}>
          <span style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.3rem', color: 'var(--vd)' }}>
            ✦ Dashboard Fiona
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '4px 12px', borderRadius: '50px', fontSize: '12px', fontWeight: 500,
              background: statut === 'En ligne' ? 'rgba(60,160,100,0.12)' : 'rgba(200,60,80,0.1)',
              color: statut === 'En ligne' ? '#1A7040' : '#A02040',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: statut === 'En ligne' ? '#3CA060' : '#C0305A', display: 'inline-block' }} />
              {statut}
            </div>
            <button onClick={() => setStatut(s => s === 'En ligne' ? 'Hors ligne' : 'En ligne')}
              className="btn btn-outline" style={{ fontSize: '13px', padding: '7px 16px' }}>
              {statut === 'En ligne' ? 'Passer hors ligne' : 'Passer en ligne'}
            </button>
            <button onClick={() => { setSonActif(s => !s); notifSound.current?.play().catch(() => {}); }}
              className="btn btn-outline" style={{ fontSize: '13px', padding: '7px 16px' }}>
              {sonActif ? '🔔 Son activé' : '🔕 Activer le son'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '1rem' }}>
          {[
            { label: 'Actives', val: actives.length, color: 'var(--v)' },
            { label: 'En attente', val: enAttente.length, color: '#B07800' },
            { label: 'Terminées', val: terminees.length, color: 'var(--muted)' },
            { label: 'Non lus', val: totalNonLus, color: '#C0305A' },
            { label: 'Encaissé', val: `${(totalPaye / 100).toFixed(0)}€`, color: '#1A7040' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'rgba(255,255,255,0.88)', borderRadius: 'var(--r)',
              border: '1px solid var(--border)', padding: '1rem', textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.6rem', fontFamily: "'Playfair Display',serif", color: s.color }}>{s.val}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Demandes en attente */}
        {enAttente.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            {enAttente.map(c => (
              <div key={c.id} style={{
                padding: '1rem 1.5rem', borderRadius: 'var(--r)',
                background: 'rgba(255,220,100,0.15)', border: '2px solid #F0C040',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '8px',
              }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--vd)' }}>⏳ Nouvelle demande — {c.prenom}</div>
                  <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '3px' }}>
                    {c.domaine} · {c.sujet} · {c.minutes} min · {c.paiement === 'wero' ? `${parseFloat(c.montant || 0).toFixed(2)}€` : `${((c.montantPaye || 0) / 100).toFixed(2)}€`} payé
                  </div>
                  {c.message && <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px', fontStyle: 'italic' }}>"{c.message}"</div>}
                </div>
                <button onClick={() => accepterConsultation(c.id)} style={{
                  padding: '10px 24px', borderRadius: '50px',
                  background: 'linear-gradient(135deg, var(--v), var(--pd))',
                  color: '#fff', border: 'none', cursor: 'pointer',
                  fontFamily: "'DM Sans',sans-serif", fontWeight: 600, fontSize: '14px',
                  boxShadow: '0 4px 12px rgba(123,94,167,0.35)',
                }}>
                  ✓ Accepter & Démarrer
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1rem', height: 'calc(100vh - 280px)' }}>
          <div style={{
            background: 'rgba(255,255,255,0.88)', borderRadius: 'var(--r2)',
            border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border)' }}>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Chercher un client…"
                style={{ width: '100%', border: '1px solid var(--border)', borderRadius: '50px', padding: '7px 14px', fontSize: '13px', background: 'var(--bg)', color: 'var(--txt)', outline: 'none', fontFamily: "'DM Sans',sans-serif" }} />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
              {filteredConsultations.map(c => (
                <div key={c.id} onClick={() => setSelected(c.id)} style={{
                  padding: '0.85rem', borderRadius: 'var(--r)', cursor: 'pointer',
                  marginBottom: '4px', position: 'relative', transition: 'all 0.15s',
                  background: selected === c.id ? 'rgba(123,94,167,0.1)' : 'transparent',
                  border: selected === c.id ? '1px solid var(--vl)' : '1px solid transparent',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ fontWeight: 500, fontSize: '14px', color: 'var(--vd)' }}>{c.prenom}</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: timerColor(c.id) }}>
                      {c.statut === 'active' ? formatTimer(c.id) : c.statut === 'en_attente' ? '⏳ Attente' : '✓'}
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.domaine} · {c.sujet}
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
            <div style={{
              background: 'rgba(255,255,255,0.88)', borderRadius: 'var(--r2)',
              border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, var(--vl), var(--pl))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '14px', color: 'var(--vd)' }}>
                    {selectedData.prenom?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '15px', color: 'var(--vd)' }}>{selectedData.prenom}</div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{selectedData.domaine} · {selectedData.sujet}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {selectedData.statut === 'en_attente' && (
                    <button onClick={() => accepterConsultation(selected)} style={{
                      padding: '8px 20px', borderRadius: '50px',
                      background: 'linear-gradient(135deg, var(--v), var(--pd))',
                      color: '#fff', border: 'none', cursor: 'pointer',
                      fontFamily: "'DM Sans',sans-serif", fontWeight: 600, fontSize: '13px',
                    }}>✓ Accepter & Démarrer</button>
                  )}
                  {selectedData.statut === 'active' && (
                    <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.4rem', color: timerColor(selected) }}>
                      {formatTimer(selected)}
                    </div>
                  )}
                  <button onClick={() => terminerConsultation(selected)} style={{
                    padding: '6px 14px', borderRadius: '50px', border: '1px solid #E0B0C0',
                    background: 'rgba(200,60,80,0.06)', color: '#A02040', cursor: 'pointer',
                    fontSize: '12px', fontFamily: "'DM Sans',sans-serif",
                  }}>Terminer</button>
                </div>
              </div>

              {selectedData.message && (
                <div style={{ padding: '10px 1.25rem', background: 'rgba(123,94,167,0.05)', borderBottom: '1px solid var(--border)', fontSize: '13px', color: 'var(--muted)' }}>
                  <strong style={{ color: 'var(--vd)' }}>Contexte : </strong>{selectedData.message}
                </div>
              )}

              <div style={{ padding: '8px 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {['Coucou et bienvenue ✨', 'Pose-moi tes questions une par une', 'Il te reste peu de temps, souhaites-tu prolonger ?', 'Merci pour cette consultation 🌙'].map(msg => (
                  <button key={msg} onClick={() => quickMsg(msg)} style={{
                    padding: '4px 12px', borderRadius: '50px', border: '1px solid var(--border)',
                    background: 'transparent', cursor: 'pointer', fontSize: '12px',
                    color: 'var(--muted)', fontFamily: "'DM Sans',sans-serif",
                  }}>{msg}</button>
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
                        {msg.auteur === 'admin' ? 'Fiona' : selectedData.prenom} · {msg.createdAt?.toDate?.()?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) || ''}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ padding: '10px 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', alignItems: 'flex-end', background: 'rgba(255,255,255,0.95)' }}>
                <textarea value={reponse} onChange={e => setReponse(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyerReponse(); } }}
                  placeholder={`Répondre à ${selectedData.prenom}…`} rows={2}
                  style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 14px', fontFamily: "'DM Sans',sans-serif", fontSize: '14px', resize: 'none', outline: 'none', color: 'var(--txt)', background: 'var(--bgs)' }} />
                <button onClick={envoyerReponse} style={{ width: 42, height: 42, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg, var(--v), var(--pd))', color: '#fff', cursor: 'pointer', fontSize: '16px', boxShadow: '0 4px 12px rgba(123,94,167,0.35)' }}>↑</button>
              </div>
            </div>
          ) : (
            <div style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 'var(--r2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: 'var(--muted)' }}>
              <div style={{ fontSize: '3rem', opacity: 0.3 }}>✦</div>
              <div style={{ fontSize: '15px' }}>Sélectionne une conversation</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
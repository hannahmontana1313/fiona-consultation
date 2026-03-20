import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Stars from '../components/Stars';
import Navbar from '../components/Navbar';
import { useAuth } from '../components/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const STATUTS = {
  bronze: { label: '🥉 Bronze', couleur: '#cd7f32', min: 0, max: 100 },
  silver: { label: '🥈 Silver', couleur: '#c0c0c0', min: 100, max: 300 },
  gold: { label: '🥇 Gold', couleur: '#ffd700', min: 300, max: 600 },
  vip: { label: '👑 VIP', couleur: '#a855f7', min: 600, max: 600 },
};

const CADEAUX = {
  150: { label: '5€ offerts', icon: '🎁', description: 'Bon de réduction de 5€ sur ta prochaine consultation' },
  300: { label: '-10% + priorité', icon: '⭐', description: '-10% sur ta prochaine consultation + priorité dans la file' },
  600: { label: 'Accès VIP', icon: '👑', description: '-15% sur toutes tes consultations + accès prioritaire permanent' },
};

export default function Fidelite() {
  const { user } = useAuth();
  const router = useRouter();
  const [fidelite, setFidelite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ticketActif, setTicketActif] = useState(null);
  const [ticketGratte, setTicketGratte] = useState(false);

  useEffect(() => {
    if (!user) { router.push('/connexion'); return; }
    const fetch = async () => {
      const snap = await getDoc(doc(db, 'fidelite', user.uid));
      if (snap.exists()) setFidelite(snap.data());
      setLoading(false);
    };
    fetch();
  }, [user]);

  const getProchainPalier = (points) => {
    if (points < 150) return { palier: 150, reste: 150 - points, cadeau: '5€ offerts' };
    if (points < 300) return { palier: 300, reste: 300 - points, cadeau: '-10% + priorité' };
    if (points < 600) return { palier: 600, reste: 600 - points, cadeau: 'accès VIP' };
    return null;
  };

  const ouvrirTicket = (palier) => {
    setTicketActif(palier);
    setTicketGratte(false);
  };

  const gratterTicket = async () => {
    setTicketGratte(true);
    // Marquer le cadeau comme utilisé
    const cadeauxUtilises = [...(fidelite.cadeauxUtilises || []), ticketActif];
    await updateDoc(doc(db, 'fidelite', user.uid), { cadeauxUtilises });
    setFidelite(prev => ({ ...prev, cadeauxUtilises }));
  };

  if (loading) return (
    <>
      <Stars /><Navbar />
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--muted)' }}>Chargement...</div>
    </>
  );

  if (!fidelite) return (
    <>
      <Stars /><Navbar />
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <p style={{ color: 'var(--muted)', marginBottom: '1rem' }}>Tu n'as pas encore de points fidélité.</p>
        <p style={{ color: 'var(--muted)' }}>Effectue ta première consultation pour en gagner ! 🔮</p>
      </div>
    </>
  );

  const statut = STATUTS[fidelite.statut || 'bronze'];
  const prochainPalier = getProchainPalier(fidelite.points || 0);
  const cadeauxDebloques = (fidelite.cadeauxDebloques || []).filter(p => !(fidelite.cadeauxUtilises || []).includes(p));
  const progression = prochainPalier
    ? Math.round(((fidelite.points || 0) / prochainPalier.palier) * 100)
    : 100;

  return (
    <>
      <Stars />
      <Navbar />

      <main style={{ paddingBottom: '4rem' }}>
        <div className="container" style={{ maxWidth: 680, paddingTop: '3rem' }}>

          {/* Titre */}
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '2rem', color: 'var(--vd)',
            textAlign: 'center', marginBottom: '2rem',
          }}>
            💎 Mon programme fidélité
          </h1>

          {/* Carte statut */}
          <div className="card" style={{
            padding: '2rem', marginBottom: '1.5rem', textAlign: 'center',
            background: `linear-gradient(135deg, ${statut.couleur}15, ${statut.couleur}08)`,
            borderColor: `${statut.couleur}40`,
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
              {statut.label.split(' ')[0]}
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--vd)', marginBottom: '4px' }}>
              {statut.label.split(' ')[1]}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '1.5rem' }}>
              Total dépensé : <strong>{Math.round(fidelite.totalDepense || 0)}€</strong>
            </div>
            <div style={{
              fontSize: '2.5rem', fontWeight: 700,
              fontFamily: "'Playfair Display', serif", color: 'var(--vd)',
            }}>
              {fidelite.points || 0} points
            </div>
          </div>

          {/* Barre de progression */}
          {prochainPalier && (
            <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: 'var(--muted)' }}>
                <span>🔥 Prochain cadeau : <strong>{prochainPalier.cadeau}</strong></span>
                <span><strong>{prochainPalier.reste} points</strong> restants</span>
              </div>
              <div style={{ background: 'var(--border)', borderRadius: '99px', height: '10px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '99px',
                  background: 'linear-gradient(90deg, var(--v), var(--vl))',
                  width: `${progression}%`,
                  transition: 'width 1s ease',
                }} />
              </div>
              <div style={{ textAlign: 'right', fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                {fidelite.points || 0} / {prochainPalier.palier} points
              </div>
            </div>
          )}

          {/* Cadeaux à gratter */}
          {cadeauxDebloques.length > 0 && (
            <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem', borderColor: 'var(--vl)' }}>
              <h2 style={{ fontSize: '1.1rem', color: 'var(--vd)', marginBottom: '1rem' }}>
                🎟️ Tes cadeaux à gratter !
              </h2>
              {cadeauxDebloques.map(palier => (
                <div key={palier} onClick={() => ouvrirTicket(palier)} style={{
                  padding: '1rem', borderRadius: 'var(--r)',
                  background: 'linear-gradient(135deg, rgba(123,94,167,0.1), rgba(232,160,200,0.1))',
                  border: '2px dashed var(--vl)', cursor: 'pointer',
                  textAlign: 'center', marginBottom: '0.75rem',
                  transition: 'transform 0.2s',
                }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <div style={{ fontSize: '2rem' }}>{CADEAUX[palier].icon}</div>
                  <div style={{ fontWeight: 600, color: 'var(--vd)', marginTop: '4px' }}>
                    🎟️ Ticket à gratter
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                    Clique pour gratter ton cadeau !
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Paliers */}
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', color: 'var(--vd)', marginBottom: '1rem' }}>
              🎁 Les paliers cadeaux
            </h2>
            {Object.entries(CADEAUX).map(([palier, cadeau]) => {
              const atteint = (fidelite.points || 0) >= parseInt(palier);
              return (
                <div key={palier} style={{
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  padding: '0.75rem 0', borderBottom: '1px solid var(--border)',
                  opacity: atteint ? 1 : 0.5,
                }}>
                  <div style={{ fontSize: '1.5rem' }}>{cadeau.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, color: 'var(--vd)', fontSize: '14px' }}>
                      {palier} points → {cadeau.label}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{cadeau.description}</div>
                  </div>
                  {atteint && <span style={{ color: 'green', fontSize: '1.2rem' }}>✅</span>}
                </div>
              );
            })}
          </div>

          {/* Statuts VIP */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', color: 'var(--vd)', marginBottom: '1rem' }}>
              👑 Les statuts VIP
            </h2>
            {Object.entries(STATUTS).map(([key, s]) => {
              const actif = fidelite.statut === key;
              return (
                <div key={key} style={{
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  padding: '0.75rem', borderRadius: 'var(--r)',
                  marginBottom: '0.5rem',
                  background: actif ? `${s.couleur}15` : 'transparent',
                  border: actif ? `1px solid ${s.couleur}40` : '1px solid transparent',
                }}>
                  <div style={{ fontSize: '1.5rem' }}>{s.label.split(' ')[0]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: actif ? 700 : 500, color: 'var(--vd)', fontSize: '14px' }}>
                      {s.label} {actif && '← ton statut actuel'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      {key === 'bronze' && 'Accès standard'}
                      {key === 'silver' && '-5% sur toutes les consultations'}
                      {key === 'gold' && '-10% sur toutes les consultations + priorité file'}
                      {key === 'vip' && '-15% sur toutes les consultations + accès prioritaire'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </main>

      {/* Popup ticket à gratter */}
      {ticketActif && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '1rem',
        }}>
          <div style={{
            background: 'var(--bg)', borderRadius: 'var(--r)',
            padding: '2.5rem', maxWidth: 380, width: '100%',
            textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎟️</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--vd)', marginBottom: '0.5rem' }}>
              Ton cadeau t'attend !
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '1.5rem' }}>
              Merci pour ta confiance 🤍 Tu fais partie de mes clientes fidèles ❤️
            </p>

            {!ticketGratte ? (
              <div
                onClick={gratterTicket}
                style={{
                  padding: '2rem', borderRadius: 'var(--r)',
                  background: 'linear-gradient(135deg, var(--v), var(--vl))',
                  cursor: 'pointer', color: '#fff', fontWeight: 700,
                  fontSize: '1.1rem', marginBottom: '1rem',
                  boxShadow: '0 4px 20px rgba(123,94,167,0.4)',
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                ✨ Gratte ici pour révéler ton cadeau !
              </div>
            ) : (
              <div style={{
                padding: '2rem', borderRadius: 'var(--r)',
                background: 'linear-gradient(135deg, rgba(255,215,0,0.2), rgba(123,94,167,0.2))',
                border: '2px solid gold', marginBottom: '1rem',
              }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
                  {CADEAUX[ticketActif].icon}
                </div>
                <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--vd)' }}>
                  {CADEAUX[ticketActif].label}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '0.5rem' }}>
                  {CADEAUX[ticketActif].description}
                </div>
              </div>
            )}

            <button
              onClick={() => setTicketActif(null)}
              style={{
                background: 'none', border: '1px solid var(--border)',
                borderRadius: 'var(--r)', padding: '0.5rem 1.5rem',
                color: 'var(--muted)', cursor: 'pointer', fontSize: '13px',
              }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </>
  );
}

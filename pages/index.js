import Link from 'next/link';
import { useState, useEffect } from 'react';
import Stars from '../components/Stars';
import Navbar from '../components/Navbar';
import { useAuth } from '../components/AuthContext';
import { getTarifActuel } from '../lib/stripe';

export default function Home() {
  const { user } = useAuth();
  const tarif = getTarifActuel();
  const isWeekend = tarif === 5;
  const [avis, setAvis] = useState([]);

  useEffect(() => {
    const q = query(
      collection(db, 'avis'),
      where('visible', '==', true),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setAvis(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  return (
    <>
      <Stars />
      <Navbar />

      <main style={{ paddingBottom: '4rem' }}>
        {/* Hero */}
        <section style={{
          textAlign: 'center', padding: '5rem 1.25rem 3rem',
          position: 'relative', zIndex: 1,
        }}>
          <div className="badge badge-purple fade-up" style={{ marginBottom: '1.5rem' }}>
            ✦ Consultation privée & confidentielle ✦
          </div>

          <h1 className="fade-up" style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 'clamp(2.2rem, 5vw, 3.5rem)',
            lineHeight: 1.25, color: 'var(--vd)',
            marginBottom: '1.25rem',
            animationDelay: '0.1s',
          }}>
            Bienvenue dans ton espace<br />
            <em className="gradient-text">de consultation privée</em>
          </h1>

          <p className="fade-up" style={{
            maxWidth: 540, margin: '0 auto 2.5rem',
            color: 'var(--muted)', fontSize: '1.05rem', lineHeight: 1.75,
            animationDelay: '0.2s',
          }}>
            Un espace intime et confidentiel où tu peux poser toutes tes questions librement,
            sans jugement. Échange avec moi en direct, par message, comme une conversation privée.
          </p>

          <div className="fade-up" style={{ animationDelay: '0.3s' }}>
            <Link
              href={user ? '/reserver' : '/inscription'}
              className="btn btn-primary btn-lg pulse"
            >
              ✦ Commencer une conversation
            </Link>
          </div>
        </section>

        <div className="container">
          {/* Comment ça fonctionne */}
          <section className="card fade-up" style={{ padding: '2.5rem', marginBottom: '1.5rem' }}>
            <h2 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '1.6rem', color: 'var(--vd)',
              textAlign: 'center', marginBottom: '2rem',
            }}>
              💬 Comment ça fonctionne ?
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
              {[
                { n: '1', icon: '🔐', title: 'Création de compte', desc: 'Inscris-toi gratuitement avec ton email' },
                { n: '2', icon: '📋', title: 'Décris ta situation', desc: 'Remplis le mini formulaire pour optimiser ton temps' },
                { n: '3', icon: '💳', title: 'Paiement sécurisé', desc: 'Choisis ta durée et paye en toute sécurité' },
                { n: '4', icon: '💬', title: 'Chat en direct', desc: 'Le chronomètre démarre et tu peux me poser tes questions' },
              ].map(step => (
                <div key={step.n} style={{
                  padding: '1.5rem', borderRadius: 'var(--r)',
                  background: 'rgba(123,94,167,0.04)', border: '1px solid var(--border)',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{step.icon}</div>
                  <div style={{
                    fontSize: '11px', fontWeight: 600, color: 'var(--v)',
                    textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px',
                  }}>Étape {step.n}</div>
                  <div style={{ fontWeight: 500, color: 'var(--vd)', marginBottom: '6px' }}>{step.title}</div>
                  <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>{step.desc}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Tarifs */}
          <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="card" style={{ padding: '2rem', textAlign: 'center', position: 'relative' }}>
              {!isWeekend && (
                <div className="badge badge-success" style={{ marginBottom: '1rem' }}>
                  ● Tarif actuel
                </div>
              )}
              <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>En semaine</div>
              <div style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '3rem', color: 'var(--vd)', lineHeight: 1,
              }}>
                2€
              </div>
              <div style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '4px' }}>par minute</div>
            </div>
            <div className="card" style={{
              padding: '2rem', textAlign: 'center',
              background: 'linear-gradient(135deg, rgba(123,94,167,0.06), rgba(232,160,200,0.08))',
              borderColor: 'var(--vl)',
            }}>
              {isWeekend && (
                <div className="badge badge-purple" style={{ marginBottom: '1rem' }}>
                  ● Tarif actuel
                </div>
              )}
              <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>Week-end</div>
              <div style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '3rem', color: 'var(--vd)', lineHeight: 1,
              }}>
                5€
              </div>
              <div style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '4px' }}>par minute</div>
            </div>
          </section>

          {/* Features */}
          <section className="card" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              {[
                { icon: '✍️', title: '100% écrit', desc: 'Échanges uniquement par message, à ton rythme' },
                { icon: '⏱️', title: 'Chronomètre en direct', desc: 'Le temps restant s\'affiche en temps réel' },
                { icon: '➕', title: 'Ajouter du temps', desc: 'Prolonge ta consultation à tout moment' },
                { icon: '📖', title: 'Historique complet', desc: 'Retrouve toutes tes consultations passées' },
              ].map(f => (
                <div key={f.title} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{f.icon}</span>
                  <div>
                    <div style={{ fontWeight: 500, color: 'var(--vd)', marginBottom: '4px' }}>{f.title}</div>
                    <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Important */}
          <div style={{
            padding: '1rem 1.5rem',
            background: 'rgba(255,255,255,0.6)', borderRadius: 'var(--r)',
            border: '1px solid var(--border)',
            fontSize: '13px', color: 'var(--muted)', textAlign: 'center',
            lineHeight: 1.8,
          }}>
            ⚠️ Le temps démarre dès l'ouverture du chat · Le chrono ne s'arrête jamais · Aucun remboursement après démarrage
          </div>

          {/* Témoignages */}
          {avis.length > 0 && (
            <section className="card" style={{ padding: '2.5rem', marginTop: '1.5rem' }}>
              <h2 style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '1.6rem', color: 'var(--vd)',
                textAlign: 'center', marginBottom: '2rem',
              }}>
                ⭐ Ce qu'elles disent
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                {avis.map(a => (
                  <div key={a.id} style={{
                    padding: '1.5rem', borderRadius: 'var(--r)',
                    background: 'rgba(123,94,167,0.04)', border: '1px solid var(--border)',
                  }}>
                    <div style={{ marginBottom: '0.75rem' }}>
                      {[1,2,3,4,5].map(n => (
                        <span key={n} style={{ opacity: n <= a.note ? 1 : 0.2 }}>⭐</span>
                      ))}
                    </div>
                    <p style={{ fontSize: '14px', color: 'var(--txt)', lineHeight: 1.7, marginBottom: '1rem', fontStyle: 'italic' }}>
                      "{a.texte}"
                    </p>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--vd)' }}>
                      — {a.prenom}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  );
}

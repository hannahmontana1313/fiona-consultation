import Link from 'next/link';
import { useState, useEffect } from 'react';
import Stars from '../components/Stars';
import Navbar from '../components/Navbar';
import { useAuth } from '../components/AuthContext';
import { getTarifActuel } from '../lib/stripe';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Home() {
  const { user } = useAuth();
  const tarif = getTarifActuel();
  const isWeekend = tarif === 5;
  const [avis, setAvis] = useState([]);
  const [fidelite, setFidelite] = useState(null);
  const [statutFiona, setStatutFiona] = useState('En ligne');

  const MESSAGES_DU_JOUR = [
    "✨ Les astres s'alignent aujourd'hui pour révéler ce que ton cœur pressent déjà...",
    "🌙 La lune murmure des secrets à ceux qui savent écouter. Es-tu prête à entendre la vérité ?",
    "🔮 Chaque question que tu portes en toi mérite une réponse. L'univers a des messages pour toi.",
    "⭐ Les cartes ne mentent jamais. Elles révèlent ce que ton âme sait déjà.",
    "🌟 Ton destin n'est pas écrit dans le marbre, mais les signes sont là pour te guider.",
    "💫 Certaines coïncidences ne sont pas des hasards. L'univers te parle, es-tu prête à l'écouter ?",
    "🌸 Les énergies du jour sont favorables aux révélations. C'est le moment de chercher les réponses.",
    "🕯️ Dans le silence de ton intuition se trouve la vérité que tu cherches.",
    "🌠 Les étoiles ont tracé un chemin pour toi. Laisse la voyance t'aider à le trouver.",
    "🔯 L'avenir appartient à ceux qui croient en la puissance de leur intuition.",
    "🌙 Ce que tu ressens profondément en toi est souvent le reflet de ce qui est vrai.",
    "✨ Les portes de la clairvoyance s'ouvrent à ceux qui cherchent avec sincérité.",
    "💜 Ton âme connaît déjà les réponses. Laisse les cartes les révéler.",
    "🌟 Aujourd'hui est un jour propice pour lever le voile sur ce qui te trouble.",
    "🔮 L'univers conspire toujours en faveur de ceux qui cherchent leur vérité.",
    "⭐ Chaque tirage est un dialogue entre ton âme et les forces invisibles qui t'entourent.",
    "🌸 Les signes sont partout. Il suffit de savoir les lire.",
    "💫 Ta vie est guidée par des forces que tu peux apprendre à comprendre.",
    "🕯️ La voyance n'est pas de la magie, c'est la lumière qui éclaire ce que tu ressens déjà.",
    "🌙 Les mystères de demain commencent à se dessiner aujourd'hui.",
    "✨ Fais confiance aux messages que l'univers t'envoie. Ils sont là pour une raison.",
    "🌠 Ton chemin de vie est unique. Laisse la sagesse des cartes t'y guider.",
    "💜 Ce qui semble flou aujourd'hui deviendra clair avec la bonne guidance.",
    "🔯 L'intuition est ton plus grand pouvoir. La voyance t'aide à l'amplifier.",
    "🌟 Chaque jour apporte de nouvelles possibilités. Sois ouverte aux messages du destin.",
    "🔮 Les cartes révèlent non pas ce qui doit arriver, mais ce qui peut arriver.",
    "⭐ Ta destinée t'appartient. La voyance t'aide simplement à mieux la comprendre.",
    "🌸 Les énergies universelles parlent à travers les cartes. Es-tu prête à les écouter ?",
    "💫 Ce que tu cherches te cherche aussi. Laisse la voyance créer cette rencontre.",
    "🕯️ Dans chaque question se cache une réponse. Laisse les cartes la révéler.",
    "🌙 La sagesse des anciens s'exprime à travers les symboles. Laisse-les te guider.",
  ];

  const messageDuJour = MESSAGES_DU_JOUR[new Date().getDate() % MESSAGES_DU_JOUR.length];

  useEffect(() => {
    if (!user) return;
    const fetchFidelite = async () => {
      const snap = await getDoc(doc(db, 'fidelite', user.uid));
      if (snap.exists()) setFidelite(snap.data());
    };
    fetchFidelite();
  }, [user]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'statut'), snap => {
      if (snap.exists()) setStatutFiona(snap.data().statut || 'En ligne');
    });
    return unsub;
  }, []);

  const getProchainPalier = (points) => {
    if (points < 150) return { palier: 150, reste: 150 - points, cadeau: '5€ offerts' };
    if (points < 300) return { palier: 300, reste: 300 - points, cadeau: '-10% + priorité' };
    if (points < 600) return { palier: 600, reste: 600 - points, cadeau: 'accès VIP' };
    return null;
  };

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

  const prochainPalier = fidelite ? getProchainPalier(fidelite.points) : null;

  return (
    <>
      <Stars />
      <Navbar />

      {/* Message du jour */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(42,26,74,0.9), rgba(123,94,167,0.85))',
        color: '#fff', textAlign: 'center', padding: '12px 20px',
        fontSize: '14px', lineHeight: 1.6, letterSpacing: '0.3px',
      }}>
        {messageDuJour}
      </div>

      {/* Statut Fiona */}
      <div style={{
        textAlign: 'center', padding: '8px 20px',
        background: statutFiona === 'En ligne' ? 'rgba(60,160,100,0.1)' : statutFiona === 'En consultation' ? 'rgba(240,192,64,0.1)' : 'rgba(200,60,80,0.08)',
        borderBottom: `1px solid ${statutFiona === 'En ligne' ? 'rgba(60,160,100,0.2)' : statutFiona === 'En consultation' ? 'rgba(240,192,64,0.2)' : 'rgba(200,60,80,0.15)'}`,
        fontSize: '13px',
        color: statutFiona === 'En ligne' ? '#1A7040' : statutFiona === 'En consultation' ? '#7A4A00' : '#A02040',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
          background: statutFiona === 'En ligne' ? '#3CA060' : statutFiona === 'En consultation' ? '#F0C040' : '#C0305A',
        }} />
        {statutFiona === 'En ligne' && 'Fiona est en ligne — je réponds rapidement ! ✨'}
        {statutFiona === 'En consultation' && 'Fiona est en consultation — je reviens très bientôt 🔮'}
        {statutFiona === 'Hors ligne' && 'Fiona est hors ligne — laisse ta demande, je reviens bientôt 🌙'}
      </div>

      {/* Bandeau fidélité */}
      {user && fidelite && prochainPalier && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(232,160,200,0.15), rgba(123,94,167,0.15))',
          borderBottom: '1px solid rgba(123,94,167,0.2)',
          textAlign: 'center', padding: '10px 20px',
          fontSize: '13px', color: 'var(--vd)',
        }}>
          🔥 Tu es à <strong>{prochainPalier.reste} points</strong> de ton prochain cadeau : <strong>{prochainPalier.cadeau}</strong> !
          <Link href="/fidelite" style={{ marginLeft: '8px', color: 'var(--v)', fontWeight: 600, textDecoration: 'underline' }}>
            Voir mes points
          </Link>
        </div>
      )}

      {user && fidelite && !prochainPalier && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(123,94,167,0.15))',
          borderBottom: '1px solid rgba(255,215,0,0.3)',
          textAlign: 'center', padding: '10px 20px',
          fontSize: '13px', color: 'var(--vd)',
        }}>
          👑 Tu as atteint le statut <strong>VIP</strong> ! Merci pour ta fidélité 🤍
          <Link href="/fidelite" style={{ marginLeft: '8px', color: 'var(--v)', fontWeight: 600, textDecoration: 'underline' }}>
            Voir mes avantages
          </Link>
        </div>
      )}

      <main style={{ paddingBottom: '4rem' }}>
        <section style={{
  textAlign: 'center', padding: '5rem 1.25rem 3rem',
  position: 'relative', zIndex: 1,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2rem',
}}>
  <img
    src="/Gemini_Generated_Image_paa407paa407paa4.png"
    alt="Fiona voyante"
    style={{ width: 320, flexShrink: 0, mixBlendMode: 'multiply' }}
  />
  <div style={{ flex: 1, maxWidth: 540 }}>
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
  </div>
  <img
    src="/Gemini_Generated_Image_paa407paa407paa4.png"
    alt="Fiona voyante"
    style={{ width: 320, flexShrink: 0, transform: 'scaleX(-1)', mixBlendMode: 'multiply' }}
  />
</section>

        <div className="container">
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

          <section className="card" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              {[
                { icon: '✍️', title: '100% écrit', desc: 'Échanges uniquement par message, à ton rythme' },
                { icon: '⏱️', title: 'Chronomètre en direct', desc: "Le temps restant s'affiche en temps réel" },
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

          <section className="card" style={{ padding: '2rem', marginBottom: '1.5rem', background: 'linear-gradient(135deg, rgba(42,26,74,0.05), rgba(123,94,167,0.08))', borderColor: 'var(--vl)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '3rem' }}>🔮</div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.3rem', color: 'var(--vd)', marginBottom: '4px' }}>
                  Tirage Lenormand Express
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
                  Tire 1 carte et reçois une interprétation personnalisée par Fiona en direct.
                </p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.8rem', color: 'var(--vd)' }}>5€</div>
                <Link href={user ? '/tirage-reserver' : '/inscription'} className="btn btn-primary" style={{ marginTop: '8px', display: 'block', whiteSpace: 'nowrap' }}>
                  🔮 Tirer ma carte
                </Link>
              </div>
            </div>
          </section>

          <div style={{
            padding: '1rem 1.5rem',
            background: 'rgba(255,255,255,0.6)', borderRadius: 'var(--r)',
            border: '1px solid var(--border)',
            fontSize: '13px', color: 'var(--muted)', textAlign: 'center',
            lineHeight: 1.8,
          }}>
            ⚠️ Le temps démarre dès l'ouverture du chat · Le chrono ne s'arrête jamais · Aucun remboursement après démarrage
          </div>

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

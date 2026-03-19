import { useRouter } from 'next/router';
import Stars from '../components/Stars';
import Navbar from '../components/Navbar';
import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../components/AuthContext';

export default function AttenteWero() {
  const router = useRouter();
  const { user } = useAuth();
  const { prenom, domaine, sujet, message, minutes, montant } = router.query;
  const [enregistre, setEnregistre] = useState(false);

  useEffect(() => {
    if (!user || !minutes || enregistre) return;
    const id = `wero_${user.uid}_${Date.now()}`;
    setDoc(doc(db, 'consultations', id), {
      consultationId: id,
      userId: user.uid,
      prenom, domaine, sujet, message,
      minutes: parseInt(minutes),
      montant: parseFloat(montant),
      statut: 'en_attente',
      paiement: 'wero',
      createdAt: serverTimestamp(),
      secondesRestantes: parseInt(minutes) * 60,
      messagesNonLus: 0,
      lastMessage: `Paiement Wero en attente de confirmation`,
    });
    setEnregistre(true);
  }, [user, minutes]);

  return (
    <>
      <Stars />
      <Navbar />
      <div className="container-sm" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
        <div className="card fade-up" style={{ overflow: 'hidden' }}>
          <div style={{
            padding: '2rem', background: 'linear-gradient(135deg, var(--v), var(--pd))',
            color: '#fff', textAlign: 'center',
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📱</div>
            <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.5rem', fontWeight: 400 }}>
              Paiement Wero
            </h1>
          </div>

          <div style={{ padding: '2rem' }}>
            <div style={{
              padding: '1.5rem', borderRadius: 'var(--r)',
              background: 'rgba(123,94,167,0.06)', border: '2px solid var(--vl)',
              textAlign: 'center', marginBottom: '1.5rem',
            }}>
              <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>Montant à envoyer</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '2.5rem', color: 'var(--vd)' }}>
                {parseFloat(montant || 0).toFixed(2).replace('.', ',')}€
              </div>
              <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>{minutes} minutes · Sans frais</div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                Comment payer via Wero
              </div>
              {[
                { n: '1', txt: 'Ouvre ton application bancaire (BNP, Société Générale, CIC, La Banque Postale…)' },
                { n: '2', txt: 'Va dans l\'onglet "Wero" ou "Virement instantané"' },
                { n: '3', txt: `Envoie ${parseFloat(montant || 0).toFixed(2)}€ au numéro` },
                { n: '4', txt: 'Indique ton prénom en commentaire pour que je t\'identifie' },
              ].map(step => (
                <div key={step.n} style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'flex-start' }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, var(--v), var(--pd))',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: 600,
                  }}>
                    {step.n}
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--txt)', lineHeight: 1.6, paddingTop: '3px' }}>
                    {step.txt}
                  </div>
                </div>
              ))}
            </div>

            {/* Numéro Wero */}
            <div style={{
              padding: '1.25rem', borderRadius: 'var(--r)',
              background: 'rgba(255,255,255,0.9)', border: '1.5px solid var(--border)',
              textAlign: 'center', marginBottom: '1.5rem',
            }}>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>Numéro Wero</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 600, color: 'var(--vd)', letterSpacing: '2px' }}>
                06 86 09 44 38
              </div>
              <button
                onClick={() => navigator.clipboard?.writeText('0686094438')}
                style={{
                  marginTop: '8px', padding: '4px 14px', borderRadius: '50px',
                  border: '1px solid var(--border)', background: 'transparent',
                  fontSize: '12px', color: 'var(--muted)', cursor: 'pointer',
                  fontFamily: "'DM Sans',sans-serif",
                }}
              >
                Copier le numéro
              </button>
            </div>

            <div style={{
              padding: '12px', borderRadius: 'var(--r)',
              background: 'rgba(239,159,39,0.1)', border: '1px solid rgba(239,159,39,0.3)',
              fontSize: '13px', color: '#7A4A00', lineHeight: 1.6, marginBottom: '1.5rem',
            }}>
              ⚠️ Ton accès au chat sera activé manuellement dès réception du paiement. 
              Cela prend généralement 2 à 5 minutes pendant mes heures de disponibilité.
            </div>

            <button onClick={() => router.push('/historique')} className="btn btn-primary btn-full">
              ✓ J'ai effectué le paiement
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../components/AuthContext';
import Stars from '../components/Stars';
import Navbar from '../components/Navbar';
import { loadStripe } from '@stripe/stripe-js';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function TirageReserver() {
  const { user, userData } = useAuth();
  const router = useRouter();
  const [prenom, setPrenom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fidelite, setFidelite] = useState(null);
  const [cadeauUtilise, setCadeauUtilise] = useState(false);
  const [cadeauAnniversaire, setCadeauAnniversaire] = useState(false);

  useEffect(() => {
    if (!user) { router.push('/inscription'); return; }
  }, [user]);

  useEffect(() => {
    if (!userData) return;
    setPrenom(userData.prenom || '');
    setTelephone(userData.telephone || '');
  }, [userData]);

  useEffect(() => {
    if (!user) return;
    const fetchFidelite = async () => {
      const snap = await getDoc(doc(db, 'fidelite', user.uid));
      if (snap.exists()) setFidelite(snap.data());
    };
    fetchFidelite();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const verifier = async () => {
      if (router.query.anniversaire !== '1') return;
      const snap = await getDoc(doc(db, 'cadeauxAnniversaire', user.uid));
      if (snap.exists() && snap.data().utilise) return;
      setCadeauAnniversaire(true);
    };
    verifier();
  }, [user, router.query]);

  const getCadeauxDisponibles = () => {
    if (!fidelite) return [];
    const debloques = fidelite.cadeauxDebloques || [];
    const utilises = fidelite.cadeauxUtilises || [];
    return debloques.filter(p => !utilises.includes(p));
  };

  const cadeauxDisponibles = getCadeauxDisponibles();
  const meilleurCadeau = cadeauxDisponibles.length > 0 ? Math.max(...cadeauxDisponibles) : null;

  const getCadeauLabel = (palier) => {
    if (palier === 150) return { label: '5€ offerts', remise: 5, type: 'fixe' };
    if (palier === 300) return { label: '-10%', remise: 0.10, type: 'pct' };
    if (palier === 600) return { label: '-15%', remise: 0.15, type: 'pct' };
    return null;
  };

  const cadeauInfo = meilleurCadeau ? getCadeauLabel(meilleurCadeau) : null;

  const getRemiseVIP = () => {
    if (!fidelite) return 0;
    if (fidelite.statut === 'silver') return 0.05;
    if (fidelite.statut === 'gold') return 0.10;
    if (fidelite.statut === 'vip') return 0.15;
    return 0;
  };

  const prixBase = 5;

  const calculerPrixFinal = () => {
    if (cadeauAnniversaire) return 0;
    let p = prixBase;
    if (cadeauUtilise && cadeauInfo) {
      if (cadeauInfo.type === 'fixe') p = Math.max(0, p - cadeauInfo.remise);
      else p = p * (1 - cadeauInfo.remise);
    } else {
      const remiseVIP = getRemiseVIP();
      if (remiseVIP > 0) p = p * (1 - remiseVIP);
    }
    return Math.max(0, p);
  };

  const prix = calculerPrixFinal();

  const marquerCadeauUtilise = async () => {
    if (cadeauUtilise && meilleurCadeau) {
      const { doc: firestoreDoc, updateDoc: firestoreUpdate, arrayUnion } = await import('firebase/firestore');
      const { db: firestoreDb } = await import('../lib/firebase');
      await firestoreUpdate(firestoreDoc(firestoreDb, 'fidelite', user.uid), {
        cadeauxUtilises: arrayUnion(meilleurCadeau),
        dernierCadeauUtilise: meilleurCadeau,
        dernierCadeauUtiliseAt: new Date(),
      }).catch(() => {});
    }
  };

  const handlePayer = async () => {
    if (!prenom.trim()) return setError('Merci d\'indiquer ton prénom.');
    setLoading(true);
    setError('');

    if (cadeauAnniversaire) {
      await updateDoc(doc(db, 'cadeauxAnniversaire', user.uid), { utilise: true });
      router.push({
        pathname: '/tirage',
        query: { userId: user.uid, prenom, telephone, gratuit: 'anniversaire' },
      });
      return;
    }

    await marquerCadeauUtilise();
    try {
      const res = await fetch('/api/create-checkout-tirage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          prenom,
          telephone,
          prixFinal: Math.round(prix * 100),
          cadeauUtilise: cadeauUtilise ? meilleurCadeau : null,
          statutVIP: fidelite?.statut || 'bronze',
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
      await stripe.redirectToCheckout({ sessionId: data.sessionId });
    } catch (err) {
      setError('Erreur : ' + err.message);
      setLoading(false);
    }
  };

  const handleWero = async () => {
    if (cadeauAnniversaire) {
      await updateDoc(doc(db, 'cadeauxAnniversaire', user.uid), { utilise: true });
      router.push({
        pathname: '/tirage',
        query: { userId: user.uid, prenom, telephone, gratuit: 'anniversaire' },
      });
      return;
    }
    await marquerCadeauUtilise();
    router.push({
      pathname: '/attente-wero',
      query: {
        prenom,
        telephone,
        domaine: 'Tirage Lenormand',
        sujet: 'Tirage express',
        message: '',
        minutes: '0',
        montant: String(prix.toFixed(2)),
        userId: user?.uid,
        tarif: '0',
        tirage: 'true',
        cadeauUtilise: cadeauUtilise ? String(meilleurCadeau) : '',
        statutVIP: fidelite?.statut || 'bronze',
      },
    });
  };

  return (
    <>
      <Stars />
      <Navbar />
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '2rem 1rem' }}>
        <div className="card fade-up" style={{ overflow: 'hidden' }}>
          <div style={{
            padding: '1.75rem 2rem',
            background: 'linear-gradient(135deg, #2A1A4A, #7B5EA7)',
            color: '#fff', textAlign: 'center',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🔮</div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', fontWeight: 400 }}>
              Tirage Lenormand Express
            </h1>
            <p style={{ fontSize: '13px', opacity: 0.85, marginTop: '6px' }}>
              1 carte tirée + interprétation personnalisée par Fiona
            </p>
          </div>

          <div style={{ padding: '2rem' }}>
            <div style={{
              padding: '1rem', borderRadius: 'var(--r)',
              background: 'rgba(123,94,167,0.08)', border: '1px solid var(--vl)',
              textAlign: 'center', marginBottom: '1.5rem',
            }}>
              {(cadeauAnniversaire || cadeauUtilise || getRemiseVIP() > 0) && (
                <div style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'line-through' }}>
                  5,00€
                </div>
              )}
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '2rem', color: 'var(--vd)' }}>
                {cadeauAnniversaire ? '🎂 Gratuit !' : `${prix.toFixed(2).replace('.', ',')}€`}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                {cadeauAnniversaire ? 'Cadeau anniversaire 🎁' : 'paiement unique · réponse rapide'}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Ton prénom</label>
              <input className="input" value={prenom}
                onChange={e => setPrenom(e.target.value)}
                placeholder="Prénom..." required />
            </div>

            <div className="form-group">
              <label className="form-label">Ton numéro de téléphone</label>
              <input className="input" type="tel" value={telephone}
                onChange={e => setTelephone(e.target.value)}
                placeholder="06, 07 ou numéro international..." />
            </div>

            <div style={{
              padding: '1rem', borderRadius: 'var(--r)',
              background: 'rgba(255,255,255,0.6)', border: '1px solid var(--border)',
              fontSize: '13px', color: 'var(--muted)', lineHeight: 1.7,
              marginBottom: '1.5rem',
            }}>
              🃏 Tu tireras ta carte après le paiement<br />
              ✨ Fiona interprétera ta carte en direct<br />
              💬 Tu pourras échanger par chat
            </div>

            {cadeauAnniversaire && (
              <div style={{
                marginBottom: '1rem', padding: '14px', borderRadius: 'var(--r)',
                background: 'linear-gradient(135deg, rgba(240,192,64,0.15), rgba(123,94,167,0.15))',
                border: '2px solid #F0C040', textAlign: 'center',
              }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>🎂</div>
                <div style={{ fontWeight: 600, color: 'var(--vd)', fontSize: '14px' }}>
                  Cadeau anniversaire — Tirage Gratuit !
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                  Valable aujourd'hui uniquement 🎁
                </div>
              </div>
            )}

            {!cadeauAnniversaire && cadeauInfo && (
              <div onClick={() => setCadeauUtilise(c => !c)} style={{
                marginBottom: '1rem', padding: '14px', borderRadius: 'var(--r)',
                border: `1.5px solid ${cadeauUtilise ? 'var(--vl)' : 'var(--border)'}`,
                background: cadeauUtilise ? 'rgba(123,94,167,0.08)' : 'rgba(255,255,255,0.7)',
                cursor: 'pointer', display: 'flex', gap: '10px', alignItems: 'center',
                transition: 'all 0.18s',
              }}>
                <span style={{ fontSize: '1.5rem' }}>🎁</span>
                <div>
                  <div style={{ fontWeight: 500, fontSize: '14px', color: 'var(--vd)' }}>
                    Utiliser mon cadeau — {cadeauInfo.label}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                    Cadeau de fidélité disponible · Utilisable 1 fois
                  </div>
                </div>
                <div style={{ marginLeft: 'auto', width: 20, height: 20, borderRadius: '50%', border: `2px solid ${cadeauUtilise ? 'var(--v)' : 'var(--border)'}`, background: cadeauUtilise ? 'var(--v)' : 'transparent', flexShrink: 0 }} />
              </div>
            )}

            {!cadeauAnniversaire && !cadeauUtilise && getRemiseVIP() > 0 && (
              <div style={{
                marginBottom: '1rem', padding: '10px 14px', borderRadius: 'var(--r)',
                background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)',
                fontSize: '13px', color: 'var(--vd)',
              }}>
                👑 Remise {fidelite?.statut?.toUpperCase()} appliquée : -{Math.round(getRemiseVIP() * 100)}%
              </div>
            )}

            {error && <p className="form-error" style={{ marginBottom: '1rem' }}>{error}</p>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={handlePayer}
                disabled={loading}
                className="btn btn-primary"
                style={{ width: '100%', padding: '14px', fontSize: '15px' }}
              >
                {loading ? 'Redirection…' : cadeauAnniversaire ? '🎂 Utiliser mon cadeau gratuit →' : `💳 Payer ${prix.toFixed(2).replace('.', ',')}€ par carte →`}
              </button>
              {!cadeauAnniversaire && (
                <div onClick={handleWero} style={{
                  padding: '14px', borderRadius: 'var(--r)',
                  border: '1.5px solid var(--border)',
                  background: 'rgba(255,255,255,0.7)',
                  cursor: 'pointer', display: 'flex', gap: '10px', alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <span style={{ fontSize: '1.2rem' }}>📱</span>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '14px', color: 'var(--vd)' }}>
                      Payer {prix.toFixed(2).replace('.', ',')}€ via Wero
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>06 86 09 44 38 · Sans frais</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

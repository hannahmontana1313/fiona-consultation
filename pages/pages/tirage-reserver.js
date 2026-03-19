import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../components/AuthContext';
import Stars from '../components/Stars';
import Navbar from '../components/Navbar';
import { loadStripe } from '@stripe/stripe-js';

export default function TirageReserver() {
  const { user, userData } = useAuth();
  const router = useRouter();
  const [prenom, setPrenom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) { router.push('/inscription'); return; }
  }, [user]);

  useEffect(() => {
    if (!userData) return;
    setPrenom(userData.prenom || '');
    setTelephone(userData.telephone || '');
  }, [userData]);

  const handlePayer = async () => {
    if (!prenom.trim()) return setError('Merci d\'indiquer ton prénom.');
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/create-checkout-tirage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          prenom,
          telephone,
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
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '2rem', color: 'var(--vd)' }}>5€</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>paiement unique · réponse rapide</div>
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

            {error && <p className="form-error" style={{ marginBottom: '1rem' }}>{error}</p>}

            <button
              onClick={handlePayer}
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px', fontSize: '15px' }}
            >
              {loading ? 'Redirection…' : '🔮 Payer 5€ & Tirer ma carte →'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

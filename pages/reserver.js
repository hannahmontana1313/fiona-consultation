import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../components/AuthContext';
import Stars from '../components/Stars';
import Navbar from '../components/Navbar';
import { getTarifActuel, calculerPrix } from '../lib/stripe';
import { loadStripe } from '@stripe/stripe-js';

const DUREES = [
  { minutes: 5, label: '5 min' },
  { minutes: 10, label: '10 min' },
  { minutes: 15, label: '15 min' },
  { minutes: 20, label: '20 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 45, label: '45 min' },
];

const DOMAINES = ['Sentimental', 'Professionnel', 'Familial', 'Guidance générale', 'Autre'];

export default function Reserver() {
  const { user, userData } = useAuth();
  const router = useRouter();
  const tarif = getTarifActuel();
  const isWeekend = tarif === 5;

  const [form, setForm] = useState({
    prenom: '',
    telephone: '',
    domaine: 'Sentimental',
    sujet: '',
    message: '',
  });
  const [dureeIdx, setDureeIdx] = useState(1);
  const [paiement, setPaiement] = useState('stripe');
  const [prioritaire, setPrioritaire] = useState(false);
  const [loading, setLoading] = useState(false);
  const { ancien } = router.query;
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) { router.push('/inscription'); return; }
  }, [user]);

  useEffect(() => {
    if (!userData) return;
    setForm(f => ({
      ...f,
      prenom: userData.prenom || f.prenom,
      telephone: userData.telephone || f.telephone,
    }));
  }, [userData]);


  const handleField = (name, val) => setForm(f => ({ ...f, [name]: val }));

  const dureeChoisie = DUREES[dureeIdx];
  const prixStripe = calculerPrix(dureeChoisie.minutes, true);
  const prixWero = calculerPrix(dureeChoisie.minutes, false);
  const prix = paiement === 'stripe' ? prixStripe : prixWero;

  const handlePayer = async () => {
    if (!form.sujet.trim()) return setError('Merci d\'indiquer ton sujet.');
    setLoading(true);
    setError('');
// Sauvegarder le téléphone dans le profil utilisateur
    if (form.telephone && user) {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      await updateDoc(doc(db, 'users', user.uid), {
        telephone: form.telephone,
        prenom: form.prenom,
      }).catch(() => {});
    }
    if (paiement === 'wero') {
      // Wero : redirection avec instructions
      router.push({
        pathname: '/attente-wero',
        query: {
          prenom: form.prenom,
          telephone: form.telephone,
          domaine: form.domaine,
          sujet: form.sujet,
          message: form.message,
          minutes: String(dureeChoisie.minutes),
          montant: String(prixWero),
          userId: user.uid,
          tarif: String(tarif),
        },
      });
      return;
    }

    // Stripe Checkout
    try {
      const res = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minutes: dureeChoisie.minutes,
          tarif,
          userId: user.uid,
          prenom: form.prenom,
          telephone: form.telephone,
          domaine: form.domaine,
          sujet: form.sujet,
          message: form.message,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
      await stripe.redirectToCheckout({ sessionId: data.sessionId });
    } catch (err) {
      setError('Erreur lors du paiement : ' + err.message);
      setLoading(false);
    }
  };

  return (
    <>
      <Stars />
      <Navbar />
      <div className="container-sm" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
        <div className="card fade-up" style={{ overflow: 'hidden' }}>
          <div style={{
            padding: '1.75rem 2rem',
            background: 'linear-gradient(135deg, var(--v), var(--pd))',
            color: '#fff',
          }}>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', fontWeight: 400 }}>
              ✦ Prépare ta consultation
            </h1>
            <p style={{ fontSize: '13px', opacity: 0.85, marginTop: '6px' }}>
              Pour optimiser ton temps, explique brièvement ta situation avant d'accéder au chat.
            </p>
          </div>

          <div style={{ padding: '2rem' }}>
            {/* Tarif affiché */}
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--r)',
              background: isWeekend ? 'rgba(232,160,200,0.15)' : 'rgba(123,94,167,0.08)',
              border: '1px solid var(--border)', marginBottom: '1.5rem',
              fontSize: '13px', color: 'var(--vd)', textAlign: 'center',
            }}>
              {isWeekend ? '🌙 Tarif week-end : 5€/min' : '⭐ Tarif semaine : 2€/min'}
            </div>

            <div className="form-group">
              <label className="form-label">Ton prénom</label>
              <input className="input" name="prenom" value={form.prenom}
                onChange={e => handleField('prenom', e.target.value)} placeholder="Prénom..." required />
            </div>

            <div className="form-group">
              <label className="form-label">Ton numéro de téléphone</label>
              <input className="input" name="telephone" type="tel" value={form.telephone}
                onChange={e => handleField('telephone', e.target.value)}
                placeholder="06, 07 ou numéro international..." required />
            </div>
            <div className="form-group">
              <label className="form-label">Domaine de ta consultation</label>
              <select className="input" name="domaine" value={form.domaine}
                onChange={e => handleField('domaine', e.target.value)}>
                {DOMAINES.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Sujet principal</label>
              <input className="input" name="sujet" value={form.sujet}
                onChange={e => handleField('sujet', e.target.value)}
                placeholder="En quelques mots..." required />
            </div>

            <div className="form-group">
              <label className="form-label">Ta situation</label>
              <textarea className="input" name="message" value={form.message}
                onChange={e => handleField('message', e.target.value)}
                placeholder="Explique brièvement ta situation pour que je puisse me préparer..."
                rows={4} />
            </div>

            {/* Durée */}
            <div className="form-group">
              <label className="form-label">Durée souhaitée</label>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '6px',
              }}>
                {DUREES.map((d, i) => {
                  const p = calculerPrix(d.minutes, paiement === 'stripe');
                  const sel = i === dureeIdx;
                  return (
                    <div key={d.minutes} onClick={() => setDureeIdx(i)} style={{
                      padding: '12px 8px', borderRadius: 'var(--r)',
                      border: `1.5px solid ${sel ? 'var(--v)' : 'var(--border)'}`,
                      background: sel ? 'rgba(123,94,167,0.08)' : 'rgba(255,255,255,0.7)',
                      cursor: 'pointer', textAlign: 'center', transition: 'all 0.18s',
                    }}>
                      <div style={{ fontWeight: 600, color: 'var(--vd)', fontSize: '15px' }}>{d.label}</div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '3px' }}>
                        {p.toFixed(2).replace('.', ',')}€
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Moyen de paiement */}
            <div className="form-group">
              <label className="form-label">Moyen de paiement</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px' }}>
                {[
                  { id: 'stripe', icon: '💳', label: 'Carte bancaire', sub: 'Via Stripe (frais inclus)' },
                  { id: 'wero', icon: '📱', label: 'Wero', sub: '06 86 09 44 38 · Sans frais' },
                ].map(p => (
                  <div key={p.id} onClick={() => setPaiement(p.id)} style={{
                    padding: '14px', borderRadius: 'var(--r)',
                    border: `1.5px solid ${paiement === p.id ? 'var(--v)' : 'var(--border)'}`,
                    background: paiement === p.id ? 'rgba(123,94,167,0.06)' : 'rgba(255,255,255,0.7)',
                    cursor: 'pointer', display: 'flex', gap: '10px', transition: 'all 0.18s',
                  }}>
                    <span style={{ fontSize: '1.5rem' }}>{p.icon}</span>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: '14px', color: 'var(--vd)' }}>{p.label}</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{p.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {error && <p className="form-error" style={{ marginBottom: '1rem' }}>{error}</p>}
          </div>

          {/* Footer prix */}
          <div style={{
            padding: '1.25rem 2rem',
            background: 'rgba(123,94,167,0.04)', borderTop: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Total à payer</div>
              <div style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '1.8rem', color: 'var(--vd)',
              }}>
                {prix.toFixed(2).replace('.', ',')}€
              </div>
            </div>
            <button
              onClick={handlePayer}
              disabled={loading}
              className="btn btn-primary"
              style={{ padding: '12px 28px', fontSize: '15px' }}
            >
              {loading ? 'Redirection…' : 'Payer & Accéder au Chat →'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

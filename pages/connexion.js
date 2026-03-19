import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Stars from '../components/Stars';
import Navbar from '../components/Navbar';
import { useAuth } from '../components/AuthContext';

export default function Connexion() {
  const { connexion } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = e => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await connexion(form.email, form.password);
      router.push('/reserver');
    } catch (err) {
      const msgs = {
        'auth/user-not-found': 'Aucun compte avec cet email.',
        'auth/wrong-password': 'Mot de passe incorrect.',
        'auth/invalid-credential': 'Email ou mot de passe incorrect.',
        'auth/too-many-requests': 'Trop de tentatives. Réessaie dans quelques minutes.',
      };
      setError(msgs[err.code] || 'Une erreur est survenue.');
      setLoading(false);
    }
  };

  return (
    <>
      <Stars />
      <Navbar />
      <div className="container-sm" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
        <div className="card fade-up" style={{ overflow: 'hidden' }}>
          <div style={{
            padding: '2rem 2rem 1.5rem',
            background: 'linear-gradient(135deg, var(--v), var(--pd))',
            color: '#fff', textAlign: 'center',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>✦</div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', fontWeight: 400 }}>
              Bon retour ✨
            </h1>
            <p style={{ fontSize: '13px', opacity: 0.85, marginTop: '6px' }}>
              Connecte-toi pour accéder à ta consultation
            </p>
          </div>

          <form onSubmit={submit} style={{ padding: '2rem' }}>
            <div className="form-group">
              <label className="form-label">Adresse email</label>
              <input className="input" name="email" type="email" value={form.email}
                onChange={handle} placeholder="ton@email.com" required />
            </div>
            <div className="form-group">
              <label className="form-label">Mot de passe</label>
              <input className="input" name="password" type="password" value={form.password}
                onChange={handle} placeholder="Ton mot de passe" required />
            </div>

            {error && <p className="form-error" style={{ marginBottom: '1rem' }}>{error}</p>}

            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
              {loading ? 'Connexion…' : 'Se connecter ✦'}
            </button>

            <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--muted)', marginTop: '1rem' }}>
              Pas encore de compte ?{' '}
              <Link href="/inscription" style={{ color: 'var(--v)', fontWeight: 500 }}>
                Créer un compte
              </Link>
            </p>
          </form>
        </div>
      </div>
    </>
  );
}

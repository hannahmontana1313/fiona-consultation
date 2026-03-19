import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Stars from '../components/Stars';
import Navbar from '../components/Navbar';
import { useAuth } from '../components/AuthContext';

export default function Inscription() {
  const { inscription } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ prenom: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = e => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async e => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError('Les mots de passe ne correspondent pas.');
    if (form.password.length < 6) return setError('Mot de passe trop court (6 caractères min).');
    setLoading(true);
    try {
      await inscription(form.email, form.password, form.prenom);
      router.push('/reserver');
    } catch (err) {
      const msgs = {
        'auth/email-already-in-use': 'Cet email est déjà utilisé.',
        'auth/invalid-email': 'Email invalide.',
        'auth/weak-password': 'Mot de passe trop faible.',
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
              Créer mon compte
            </h1>
            <p style={{ fontSize: '13px', opacity: 0.85, marginTop: '6px' }}>
              Gratuit · Accès immédiat à la consultation
            </p>
          </div>

          <form onSubmit={submit} style={{ padding: '2rem' }}>
            <div className="form-group">
              <label className="form-label">Ton prénom</label>
              <input className="input" name="prenom" value={form.prenom}
                onChange={handle} placeholder="Prénom..." required />
            </div>
            <div className="form-group">
              <label className="form-label">Adresse email</label>
              <input className="input" name="email" type="email" value={form.email}
                onChange={handle} placeholder="ton@email.com" required />
            </div>
            <div className="form-group">
              <label className="form-label">Mot de passe</label>
              <input className="input" name="password" type="password" value={form.password}
                onChange={handle} placeholder="6 caractères minimum" required />
            </div>
            <div className="form-group">
              <label className="form-label">Confirmer le mot de passe</label>
              <input className="input" name="confirm" type="password" value={form.confirm}
                onChange={handle} placeholder="Répète ton mot de passe" required />
            </div>

            {error && <p className="form-error" style={{ marginBottom: '1rem' }}>{error}</p>}

            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
              {loading ? 'Création en cours…' : 'Créer mon compte ✦'}
            </button>

            <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--muted)', marginTop: '1rem' }}>
              Déjà un compte ?{' '}
              <Link href="/connexion" style={{ color: 'var(--v)', fontWeight: 500 }}>
                Se connecter
              </Link>
            </p>
          </form>
        </div>
      </div>
    </>
  );
}

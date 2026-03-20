import Link from 'next/link';
import { useAuth } from './AuthContext';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Navbar() {
  const { user, deconnexion, isAdmin } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [fidelite, setFidelite] = useState(null);

  useEffect(() => {
    if (!user) return;
    const fetchFidelite = async () => {
      const snap = await getDoc(doc(db, 'fidelite', user.uid));
      if (snap.exists()) setFidelite(snap.data());
    };
    fetchFidelite();
  }, [user]);

  const handleLogout = async () => {
    await deconnexion();
    router.push('/');
  };

  const STATUT_EMOJI = {
    bronze: '🥉',
    silver: '🥈',
    gold: '🥇',
    vip: '👑',
  };

  return (
    <nav className="nav">
      <Link href="/" className="logo">
        <span>✦</span> Fiona
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {user ? (
          <>
            {/* Badge points fidélité */}
            {fidelite && (
              <Link href="/fidelite" style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '6px 12px', borderRadius: '99px',
                background: 'linear-gradient(135deg, rgba(123,94,167,0.1), rgba(232,160,200,0.1))',
                border: '1px solid rgba(123,94,167,0.2)',
                fontSize: '12px', fontWeight: 600, color: 'var(--vd)',
                textDecoration: 'none', whiteSpace: 'nowrap',
              }}>
                {STATUT_EMOJI[fidelite.statut || 'bronze']} {fidelite.points || 0} pts
              </Link>
            )}
            {isAdmin && (
              <Link href="/admin" className="btn btn-outline" style={{ padding: '8px 16px', fontSize: '13px' }}>
                Dashboard admin
              </Link>
            )}
            <Link href="/historique" className="btn btn-outline" style={{ padding: '8px 16px', fontSize: '13px' }}>
              Mes consultations
            </Link>
            <button onClick={handleLogout} className="btn btn-outline" style={{ padding: '8px 16px', fontSize: '13px' }}>
              Déconnexion
            </button>
          </>
        ) : (
          <>
            <Link href="/connexion" className="btn btn-outline" style={{ padding: '8px 16px', fontSize: '13px' }}>
              Connexion
            </Link>
            <Link href="/inscription" className="btn btn-primary" style={{ padding: '8px 18px', fontSize: '13px' }}>
              Commencer
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}

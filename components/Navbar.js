import Link from 'next/link';
import { useAuth } from './AuthContext';
import { useRouter } from 'next/router';
import { useState } from 'react';

export default function Navbar() {
  const { user, deconnexion, isAdmin } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await deconnexion();
    router.push('/');
  };

  return (
    <nav className="nav">
      <Link href="/" className="logo">
        <span>✦</span> Fiona
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {user ? (
          <>
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

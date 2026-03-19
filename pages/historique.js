import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../components/AuthContext';
import Stars from '../components/Stars';
import Navbar from '../components/Navbar';
import Link from 'next/link';

export default function Historique() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [consultations, setConsultations] = useState([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/connexion');
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const q = query(
        collection(db, 'consultations'),
        where('userId', '==', user.uid)
      );
      const snap = await getDocs(collection(db, 'consultations'));
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(c => c.userId === user.uid)
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setConsultations(data);
      setFetching(false);
    };
    load();
  }, [user]);

  const formatDate = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatMontant = (centimes) => {
    if (!centimes) return '—';
    return (centimes / 100).toFixed(2).replace('.', ',') + '€';
  };

  const statutLabel = (s) => ({
    active: { label: 'En cours', color: '#1A7040', bg: 'rgba(60,160,100,0.1)' },
    terminee: { label: 'Terminée', color: 'var(--muted)', bg: 'rgba(123,94,167,0.06)' },
    pending: { label: 'En attente', color: '#B07800', bg: 'rgba(239,159,39,0.12)' },
  }[s] || { label: s, color: 'var(--muted)', bg: 'transparent' });

  return (
    <>
      <Stars />
      <Navbar />
      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: '2rem', color: 'var(--vd)' }}>
            ✦ Mes consultations
          </h1>
          <p style={{ color: 'var(--muted)', marginTop: '6px' }}>Retrouve toutes tes consultations passées et en cours.</p>
        </div>

        {fetching ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '3rem' }}>Chargement…</div>
        ) : consultations.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.3 }}>✦</div>
            <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>Tu n'as pas encore de consultation.</p>
            <Link href="/reserver" className="btn btn-primary">Commencer une consultation</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {consultations.map(c => {
              const s = statutLabel(c.statut);
              return (
                <div key={c.id} className="card" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <span style={{
                          padding: '3px 12px', borderRadius: '50px', fontSize: '12px', fontWeight: 500,
                          color: s.color, background: s.bg,
                        }}>
                          {s.label}
                        </span>
                        <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{formatDate(c.createdAt)}</span>
                      </div>
                      <div style={{ fontWeight: 500, color: 'var(--vd)', fontSize: '1.05rem' }}>
                        {c.domaine} · {c.sujet}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.4rem', color: 'var(--vd)' }}>
                        {formatMontant(c.montantPaye)}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{c.minutes} min</div>
                    </div>
                  </div>

                  {c.message && (
                    <div style={{
                      padding: '10px 14px', borderRadius: 'var(--r)',
                      background: 'rgba(123,94,167,0.05)', border: '1px solid var(--border)',
                      fontSize: '13px', color: 'var(--muted)', marginBottom: '1rem',
                      lineHeight: 1.6,
                    }}>
                      {c.message}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px' }}>
                    {c.statut === 'active' && (
                      <Link href={`/chat?consultation=${c.id}`} className="btn btn-primary" style={{ padding: '8px 20px', fontSize: '13px' }}>
                        Reprendre le chat →
                      </Link>
                    )}
                    {c.statut === 'terminee' && (
                      <Link href="/reserver" className="btn btn-outline" style={{ padding: '8px 20px', fontSize: '13px' }}>
                        Nouvelle consultation
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

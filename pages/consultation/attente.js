import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Navbar from '../../components/Navbar';
import { db } from '../../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export default function Attente() {
  const router = useRouter();
  const { id } = router.query;

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'consultations', id), (snap) => {
      if (snap.exists() && snap.data().statut === 'prix_envoyes') {
        router.push(`/consultation/choix?id=${id}`);
      }
    });
    return () => unsub();
  }, [id]);

  return (
    <>
      <Head><title>En attente — Fiona</title></Head>
      <Navbar />
      <div style={s.wrap}>
        <div style={s.inner}>
          <div style={s.icon}>🔮</div>
          <h1 style={s.h1}>Votre demande est bien reçue</h1>
          <div style={s.divider} />
          <p style={s.text}>
            Fiona analyse votre situation avec soin et revient vers vous très prochainement avec les tirages et tarifs adaptés.
          </p>
          <p style={s.hint}>
            Cette page se met à jour automatiquement — pas besoin de la rafraîchir.
          </p>
          <div style={s.loader}>
            <div style={s.dot1} />
            <div style={s.dot2} />
            <div style={s.dot3} />
          </div>
        </div>
      </div>
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}</style>
    </>
  );
}

const s = {
  wrap: { minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.25rem' },
  inner: { textAlign: 'center', maxWidth: 480 },
  icon: { fontSize: '3rem', marginBottom: '1.5rem' },
  h1: { fontFamily: "'Playfair Display', serif", fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 400, fontStyle: 'italic', color: 'var(--vd)', margin: '0 0 0.5rem' },
  divider: { width: 40, height: 1, background: 'var(--border)', margin: '1rem auto' },
  text: { fontSize: 14, color: 'var(--muted)', lineHeight: 1.7, marginBottom: '1rem', fontFamily: "'DM Sans', sans-serif" },
  hint: { fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', marginBottom: '2rem', fontFamily: "'DM Sans', sans-serif" },
  loader: { display: 'flex', gap: 8, justifyContent: 'center' },
  dot1: { width: 8, height: 8, borderRadius: '50%', background: 'var(--v)', animation: 'bounce 1.4s infinite ease-in-out', animationDelay: '0s' },
  dot2: { width: 8, height: 8, borderRadius: '50%', background: 'var(--v)', animation: 'bounce 1.4s infinite ease-in-out', animationDelay: '0.16s' },
  dot3: { width: 8, height: 8, borderRadius: '50%', background: 'var(--v)', animation: 'bounce 1.4s infinite ease-in-out', animationDelay: '0.32s' },
};

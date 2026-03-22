import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Navbar from '../../components/Navbar';
import Stars from '../../components/Stars';
import { db } from '../../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export default function Confirmation() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'consultations', id), (snap) => {
      if (snap.exists()) setData({ id: snap.id, ...snap.data() });
    });
    return () => unsub();
  }, [id]);

  if (!data) return (
    <>
      <Navbar />
      <div style={s.center}><p style={s.muted}>Chargement...</p></div>
    </>
  );

  const tiragesChoisis = data.tiragesChoisis || [];
  const tirages = tiragesChoisis.map(i => data.tirages[i]).filter(Boolean);

  return (
    <>
      <Head><title>Confirmation — Fiona</title></Head>
      <Stars />
      <Navbar />
      <div style={s.wrap}>
        <div style={s.iconWrap}>✦</div>
        <h1 style={s.h1}>Paiement confirmé</h1>
        <div style={s.divider} />
        <p style={s.text}>Merci {data.prenom}, votre réservation est bien enregistrée.</p>

        <div style={s.recapBox}>
          <p style={s.recapLabel}>Votre commande</p>
          {tirages.map((t, i) => (
            <div key={i} style={s.recapRow}>
              <span>{t.emoji} {t.nom}</span>
              <span>{t.prix} €</span>
            </div>
          ))}
          {data.isWeekend && (
            <div style={{ ...s.recapRow, color: '#b45309' }}>
              <span>Supplément week-end</span>
              <span>+14 €</span>
            </div>
          )}
          {data.remise > 0 && (
            <div style={{ ...s.recapRow, color: '#166534' }}>
              <span>Remise</span>
              <span>−{data.remise} €</span>
            </div>
          )}
          <div style={s.recapDivider} />
          <div style={s.recapTotal}>
            <span>Total payé</span>
            <span>{data.totalAvecFrais ? data.totalAvecFrais.toFixed(2) : data.total} €</span>
          </div>
        </div>

        <div style={s.smsBox}>
          <div style={s.smsIcon}>📱</div>
          <div>
            <p style={s.smsTitle}>Votre tirage arrive par SMS</p>
            <p style={s.smsTel}>Au {data.telephone}</p>
            <p style={s.smsHeure}>Entre 21h et 2h cette nuit</p>
          </div>
        </div>

        <p style={s.note}>
          Pour toute question, contactez Fiona sur Instagram.
        </p>
      </div>
    </>
  );
}

const s = {
  wrap: { fontFamily: "'DM Sans', sans-serif", maxWidth: 520, margin: '0 auto', padding: '3rem 1.25rem 4rem', textAlign: 'center' },
  center: { display: 'flex', justifyContent: 'center', padding: '4rem 1rem' },
  muted: { color: 'var(--muted)', fontSize: 14 },
  iconWrap: { fontSize: '2.5rem', marginBottom: '1rem', color: 'var(--v)' },
  h1: { fontFamily: "'Playfair Display', serif", fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 400, fontStyle: 'italic', color: 'var(--vd)', margin: '0 0 0.5rem' },
  divider: { width: 40, height: 1, background: 'var(--border)', margin: '1rem auto 1.5rem' },
  text: { fontSize: 14, color: 'var(--muted)', marginBottom: '2rem', lineHeight: 1.7 },
  recapBox: { border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '1.25rem', marginBottom: '1.5rem', textAlign: 'left', background: 'rgba(123,94,167,0.04)' },
  recapLabel: { fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.75rem' },
  recapRow: { display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)', padding: '4px 0' },
  recapDivider: { height: 1, background: 'var(--border)', margin: '8px 0' },
  recapTotal: { display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 600, color: 'var(--vd)' },
  smsBox: { display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(123,94,167,0.06)', border: '1px solid var(--vl)', borderRadius: 'var(--r)', padding: '1.25rem', marginBottom: '1.5rem', textAlign: 'left' },
  smsIcon: { fontSize: '2rem', flexShrink: 0 },
  smsTitle: { fontWeight: 600, color: 'var(--vd)', fontSize: 14, marginBottom: 4 },
  smsTel: { fontSize: 13, color: 'var(--muted)', marginBottom: 2 },
  smsHeure: { fontSize: 13, color: 'var(--v)', fontWeight: 500 },
  note: { fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 },
};

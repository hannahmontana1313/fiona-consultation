import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Navbar from '../../components/Navbar';
import { db } from '../../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export default function Choix() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'consultations', id), (snap) => {
      if (snap.exists()) {
        setData({ id: snap.id, ...snap.data() });
        setLoading(false);
      }
    });
    return () => unsub();
  }, [id]);

  function toggleTirage(i) {
    setSelected(prev =>
      prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
    );
  }

  function calcTotal() {
    if (!data) return 0;
    const base = selected.reduce((s, i) => s + (data.tirages[i]?.prix || 0), 0);
    const weekend = data.isWeekend && selected.length > 0 ? 14 : 0;
    const remise = selected.length >= 2 ? (data.remise || 0) : 0;
    return base + weekend - remise;
  }

  async function handlePayer() {
    if (selected.length === 0) return;
    setPaying(true);
    try {
      const res = await fetch('/api/consultation/paiement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consultationId: id,
          tiragesChoisis: selected,
          total: calcTotal(),
        }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (e) {
      setPaying(false);
    }
  }

  if (loading) return (
    <>
      <Navbar />
      <div style={s.center}><p style={s.muted}>Chargement...</p></div>
    </>
  );

  const total = calcTotal();
  const remiseActive = selected.length >= 2 && data.remise > 0;

  return (
    <>
      <Head><title>Vos tirages — Fiona</title></Head>
      <Navbar />
      <div style={s.wrap}>
        <div style={s.header}>
          <p style={s.eyebrow}>Consultation Fiona</p>
          <h1 style={s.h1}>Vos tirages personnalisés</h1>
          <div style={s.divider} />
        </div>

        <div style={s.introBox}>
          <p>Bonjour {data.prenom},</p>
          <p style={{ marginTop: 6 }}>J'ai analysé votre situation avec soin. Voici les tirages que je vous propose — vous pouvez en choisir un ou plusieurs.</p>
        </div>

        {data.isWeekend && (
          <div style={s.weekendBanner}>
            ☽ Consultation du week-end : supplément unique de 14 €
          </div>
        )}

        <p style={s.sectionLabel}>Sélectionnez vos tirages</p>

        {data.tirages.map((t, i) => (
          <div
            key={i}
            style={{ ...s.tirageCard, ...(selected.includes(i) ? s.tirageCardOn : {}) }}
            onClick={() => toggleTirage(i)}
          >
            <div style={s.tirageHead}>
              <div style={s.tirageHeadLeft}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ ...s.checkbox, ...(selected.includes(i) ? s.checkboxOn : {}) }}>
                    {selected.includes(i) && '✓'}
                  </div>
                  <div>
                    <p style={s.tirageNum}>Tirage {i + 1}</p>
                    <p style={s.tirageName}>{t.emoji} {t.nom}</p>
                  </div>
                </div>
              </div>
              <p style={s.prixBadge}>{t.prix} €</p>
            </div>
            <p style={s.tirageIntro}>{t.intro}</p>
            <p style={s.regardLabel}>Ce que l'on regarde</p>
            <ul style={s.regardList}>
              {t.regards.map((r, j) => <li key={j} style={s.regardItem}>{r}</li>)}
            </ul>
            <p style={s.ideal}>👉 {t.ideal}</p>
          </div>
        ))}

        {remiseActive && (
          <div style={s.remiseBanner}>
            ✦ Remise de {data.remise} € appliquée pour 2 tirages ou plus
          </div>
        )}

        {selected.length > 0 && (
          <div style={s.recapBox}>
            {selected.map(i => (
              <div key={i} style={s.recapRow}>
                <span>{data.tirages[i].emoji} {data.tirages[i].nom}</span>
                <span>{data.tirages[i].prix} €</span>
              </div>
            ))}
            {data.isWeekend && selected.length > 0 && (
              <div style={{ ...s.recapRow, color: '#b45309' }}>
                <span>Supplément week-end (forfait unique)</span>
                <span>+14 €</span>
              </div>
            )}
            {remiseActive && (
              <div style={{ ...s.recapRow, color: '#166534' }}>
                <span>Remise multi-tirages</span>
                <span>−{data.remise} €</span>
              </div>
            )}
            <div style={s.recapDivider} />
            <div style={s.recapTotal}>
              <span>Total</span>
              <span>{total} €</span>
            </div>
          </div>
        )}

        <div style={s.smsInfo}>
          📱 Votre tirage vous sera envoyé <strong>par SMS entre 21h et 2h</strong> suivant votre paiement.
        </div>

        <button
          style={{ ...s.btn, ...(selected.length === 0 || paying ? s.btnOff : {}) }}
          onClick={handlePayer}
          disabled={selected.length === 0 || paying}
        >
          {paying ? 'Redirection...' : `Payer ${selected.length > 0 ? total + ' €' : ''}`}
        </button>
      </div>
    </>
  );
}

const s = {
  wrap: { fontFamily: "'DM Sans', sans-serif", maxWidth: 620, margin: '0 auto', padding: '2rem 1.25rem 4rem' },
  center: { display: 'flex', justifyContent: 'center', padding: '4rem 1rem' },
  muted: { color: 'var(--muted)', fontSize: 14 },
  header: { textAlign: 'center', marginBottom: '2rem' },
  eyebrow: { fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.75rem' },
  h1: { fontFamily: "'Playfair Display', serif", fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 400, fontStyle: 'italic', color: 'var(--vd)', lineHeight: 1.2, margin: 0 },
  divider: { width: 40, height: 1, background: 'var(--border)', margin: '1rem auto' },
  introBox: { background: 'rgba(123,94,167,0.06)', borderRadius: 'var(--r)', padding: '1rem 1.25rem', marginBottom: '1.5rem', fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 },
  weekendBanner: { background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--r)', padding: '0.7rem 1rem', marginBottom: '1.25rem', fontSize: 12, color: '#92400e' },
  sectionLabel: { fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '1rem' },
  tirageCard: { border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '1.1rem 1.25rem', marginBottom: '1rem', cursor: 'pointer', transition: 'border-color 0.15s' },
  tirageCardOn: { border: '2px solid var(--v)', background: 'rgba(123,94,167,0.04)' },
  tirageHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: '0.5rem' },
  tirageHeadLeft: { flex: 1, minWidth: 0 },
  checkbox: { width: 18, height: 18, border: '1px solid var(--border)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0, marginTop: 2 },
  checkboxOn: { background: 'var(--v)', color: '#fff', border: '1px solid var(--v)' },
  tirageNum: { fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 2, margin: 0 },
  tirageName: { fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 400, color: 'var(--vd)', lineHeight: 1.2, margin: 0 },
  prixBadge: { fontSize: 18, fontWeight: 600, color: 'var(--vd)', flexShrink: 0, margin: 0 },
  tirageIntro: { fontSize: 13, color: 'var(--muted)', lineHeight: 1.65, marginBottom: '0.75rem' },
  regardLabel: { fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.4rem' },
  regardList: { listStyle: 'none', padding: 0, margin: '0 0 0.75rem' },
  regardItem: { fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, paddingLeft: 12, position: 'relative' },
  ideal: { fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' },
  remiseBanner: { background: 'rgba(22,101,52,0.08)', border: '1px solid rgba(22,101,52,0.2)', borderRadius: 'var(--r)', padding: '0.7rem 1rem', marginBottom: '1rem', fontSize: 12, color: '#166534' },
  recapBox: { border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '1rem 1.25rem', marginBottom: '1.25rem', background: 'rgba(123,94,167,0.04)' },
  recapRow: { display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)', padding: '4px 0' },
  recapDivider: { height: 1, background: 'var(--border)', margin: '8px 0' },
  recapTotal: { display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 600, color: 'var(--vd)' },
  smsInfo: { fontSize: 13, color: 'var(--muted)', background: 'rgba(123,94,167,0.06)', borderRadius: 'var(--r)', padding: '0.85rem 1rem', marginBottom: '1.25rem', lineHeight: 1.6 },
  btn: { width: '100%', padding: '0.9rem', background: 'linear-gradient(135deg, var(--v), var(--vd))', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 14, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.05em' },
  btnOff: { opacity: 0.4, cursor: 'not-allowed' },
};

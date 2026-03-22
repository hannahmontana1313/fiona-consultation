import { useState } from ‘react’;
import { useRouter } from ‘next/router’;
import Head from ‘next/head’;
import Navbar from ‘../components/Navbar’;

const TYPES = [
{ val: ‘sentimentale’, label: ‘♡ Sentimentale’ },
{ val: ‘professionnelle’, label: ‘◇ Professionnelle’ },
{ val: ‘personnelle’, label: ‘◯ Personnelle’ },
{ val: ‘générale’, label: ‘☽ Générale’ },
];

export default function Consultation() {
const router = useRouter();
const [type, setType] = useState(’’);
const [situation, setSituation] = useState(’’);
const [questions, setQuestions] = useState(’’);
const [prenom, setPrenom] = useState(’’);
const [telephone, setTelephone] = useState(’’);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(’’);

async function handleSubmit() {
if (!type || !situation.trim() || !questions.trim() || !prenom.trim() || !telephone.trim()) {
setError(‘Merci de remplir tous les champs.’);
return;
}
setError(’’);
setLoading(true);
try {
const res = await fetch(’/api/consultation/creer’, {
method: ‘POST’,
headers: { ‘Content-Type’: ‘application/json’ },
body: JSON.stringify({ type, situation, questions, prenom, telephone }),
});
const data = await res.json();
if (!res.ok) throw new Error(data.error || ‘Erreur serveur’);
router.push(`/consultation/attente?id=${data.id}`);
} catch (e) {
setError(“Une erreur est survenue. Merci de réessayer.”);
setLoading(false);
}
}

return (
<>
<Head><title>Consultation — Fiona</title></Head>
<Navbar />
<div style={s.wrap}>
<div style={s.header}>
<p style={s.eyebrow}>Consultation Fiona</p>
<h1 style={s.h1}>Votre espace de consultation</h1>
<div style={s.divider} />
<p style={s.subtitle}>Décrivez votre situation et je vous propose les tirages les plus adaptés</p>
</div>

```
    <div style={s.field}>
      <label style={s.label}>Type de consultation</label>
      <div style={s.typeGrid}>
        {TYPES.map(t => (
          <button key={t.val} style={{ ...s.typeBtn, ...(type === t.val ? s.typeBtnOn : {}) }} onClick={() => setType(t.val)}>
            {t.label}
          </button>
        ))}
      </div>
    </div>

    <div style={s.field}>
      <label style={s.label}>Votre prénom</label>
      <input style={s.input} type="text" placeholder="Votre prénom" value={prenom} onChange={e => setPrenom(e.target.value)} />
    </div>

    <div style={s.field}>
      <label style={s.label}>Numéro de téléphone</label>
      <input style={s.input} type="tel" placeholder="+33 6 00 00 00 00" value={telephone} onChange={e => setTelephone(e.target.value)} />
      <p style={s.hint}>📱 Votre tirage sera envoyé par SMS entre 21h et 2h.</p>
    </div>

    <div style={s.field}>
      <label style={s.label}>Votre situation en bref</label>
      <textarea style={s.textarea} placeholder="Décrivez votre situation actuelle..." value={situation} onChange={e => setSituation(e.target.value)} />
    </div>

    <div style={s.field}>
      <label style={s.label}>Vos questions</label>
      <textarea style={s.textarea} placeholder="Quelles sont les questions qui vous tiennent à cœur ?" value={questions} onChange={e => setQuestions(e.target.value)} />
    </div>

    {error && <p style={s.error}>{error}</p>}

    <button style={{ ...s.btn, ...(loading ? s.btnOff : {}) }} onClick={handleSubmit} disabled={loading}>
      {loading ? 'Analyse en cours...' : 'Voir mes tirages suggérés'}
    </button>
  </div>
</>
```

);
}

const s = {
wrap: { fontFamily: “‘Playfair Display’, serif”, maxWidth: 620, margin: ‘0 auto’, padding: ‘2rem 1.25rem 4rem’ },
header: { textAlign: ‘center’, marginBottom: ‘2.5rem’ },
eyebrow: { fontSize: 11, letterSpacing: ‘0.2em’, textTransform: ‘uppercase’, color: ‘var(–muted)’, marginBottom: ‘0.75rem’ },
h1: { fontSize: ‘clamp(1.8rem, 4vw, 2.5rem)’, fontWeight: 400, fontStyle: ‘italic’, color: ‘var(–vd)’, lineHeight: 1.2, margin: 0 },
divider: { width: 40, height: 1, background: ‘var(–border)’, margin: ‘1.25rem auto’ },
subtitle: { fontSize: 14, color: ‘var(–muted)’, lineHeight: 1.6 },
field: { marginBottom: ‘1.5rem’ },
label: { display: ‘block’, fontSize: 12, letterSpacing: ‘0.12em’, textTransform: ‘uppercase’, color: ‘var(–muted)’, marginBottom: ‘0.5rem’, fontFamily: “‘DM Sans’, sans-serif” },
typeGrid: { display: ‘grid’, gridTemplateColumns: ‘1fr 1fr’, gap: 8 },
typeBtn: { border: ‘1px solid var(–border)’, borderRadius: ‘var(–r)’, padding: ‘0.65rem 0.75rem’, fontFamily: “‘DM Sans’, sans-serif”, fontSize: 13, color: ‘var(–muted)’, background: ‘transparent’, cursor: ‘pointer’, textAlign: ‘left’ },
typeBtnOn: { border: ‘1px solid var(–v)’, background: ‘rgba(123,94,167,0.08)’, color: ‘var(–vd)’ },
input: { width: ‘100%’, border: ‘1px solid var(–border)’, borderRadius: ‘var(–r)’, padding: ‘0.7rem 1rem’, fontFamily: “‘DM Sans’, sans-serif”, fontSize: 14, color: ‘var(–txt)’, background: ‘transparent’, boxSizing: ‘border-box’ },
hint: { fontSize: 12, color: ‘var(–muted)’, marginTop: ‘0.4rem’, fontStyle: ‘italic’, fontFamily: “‘DM Sans’, sans-serif” },
textarea: { width: ‘100%’, border: ‘1px solid var(–border)’, borderRadius: ‘var(–r)’, padding: ‘0.75rem 1rem’, fontFamily: “‘DM Sans’, sans-serif”, fontSize: 14, color: ‘var(–txt)’, background: ‘transparent’, resize: ‘vertical’, lineHeight: 1.6, minHeight: 100, boxSizing: ‘border-box’ },
error: { color: ‘#e24b4a’, fontSize: 13, marginBottom: ‘0.75rem’, fontFamily: “‘DM Sans’, sans-serif” },
btn: { width: ‘100%’, padding: ‘0.9rem’, background: ‘linear-gradient(135deg, var(–v), var(–vd))’, color: ‘#fff’, border: ‘none’, borderRadius: ‘var(–r)’, fontFamily: “‘DM Sans’, sans-serif”, fontSize: 14, fontWeight: 600, cursor: ‘pointer’, letterSpacing: ‘0.05em’ },
btnOff: { opacity: 0.5, cursor: ‘not-allowed’ },
};

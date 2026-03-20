import { useRouter } from 'next/router';
import Stars from '../components/Stars';
import Navbar from '../components/Navbar';
import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../components/AuthContext';

function Morpion() {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [winner, setWinner] = useState(null);
  const [scores, setScores] = useState({ joueur: 0, robot: 0 });
  const [robotTurn, setRobotTurn] = useState(false);

  const checkWinner = (b) => {
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const [a,b1,c] of lines) {
      if (b[a] && b[a] === b[b1] && b[a] === b[c]) return b[a];
    }
    return b.every(Boolean) ? 'draw' : null;
  };

  const meilleurCoup = (b) => {
    for (let i = 0; i < 9; i++) {
      if (!b[i]) { const test = [...b]; test[i] = '🔮'; if (checkWinner(test) === '🔮') return i; }
    }
    for (let i = 0; i < 9; i++) {
      if (!b[i]) { const test = [...b]; test[i] = '✦'; if (checkWinner(test) === '✦') return i; }
    }
    if (!b[4]) return 4;
    const coins = [0,2,6,8].filter(i => !b[i]);
    if (coins.length > 0) return coins[Math.floor(Math.random() * coins.length)];
    const libres = b.map((v,i) => v ? null : i).filter(i => i !== null);
    return libres[Math.floor(Math.random() * libres.length)];
  };

  const handleClick = (i) => {
    if (board[i] || winner || robotTurn) return;
    const newBoard = [...board];
    newBoard[i] = '✦';
    const w = checkWinner(newBoard);
    setBoard(newBoard);
    if (w) {
      setWinner(w);
      if (w === '✦') setScores(s => ({ ...s, joueur: s.joueur + 1 }));
      return;
    }
    setRobotTurn(true);
    setTimeout(() => {
      const coup = meilleurCoup(newBoard);
      if (coup === null || coup === undefined) { setRobotTurn(false); return; }
      const boardRobot = [...newBoard];
      boardRobot[coup] = '🔮';
      const w2 = checkWinner(boardRobot);
      setBoard(boardRobot);
      setRobotTurn(false);
      if (w2) {
        setWinner(w2);
        if (w2 === '🔮') setScores(s => ({ ...s, robot: s.robot + 1 }));
      }
    }, 500);
  };

  const reset = () => { setBoard(Array(9).fill(null)); setWinner(null); setRobotTurn(false); };

  const status = winner
    ? winner === 'draw' ? '🤝 Égalité !' : winner === '✦' ? '🎉 Tu as gagné !' : '🤖 Le robot a gagné !'
    : robotTurn ? '🔮 Le robot réfléchit…' : '✦ À ton tour !';

  return (
    <div style={{ marginTop: '1.5rem', padding: '1.5rem', borderRadius: 'var(--r)', background: 'rgba(123,94,167,0.06)', border: '1px solid var(--vl)' }}>
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--vd)', marginBottom: '8px' }}>🎮 Morpion — Patiente en jouant !</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>
          <span>✦ Toi : {scores.joueur}</span>
          <span>🔮 Robot : {scores.robot}</span>
        </div>
        <div style={{ fontSize: '13px', color: winner ? 'var(--v)' : 'var(--muted)', fontWeight: winner ? 600 : 400 }}>{status}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', maxWidth: 200, margin: '0 auto' }}>
        {board.map((cell, i) => (
          <button key={i} onClick={() => handleClick(i)} style={{
            height: 60, borderRadius: 'var(--r)',
            border: `1.5px solid ${cell ? 'var(--vl)' : 'var(--border)'}`,
            background: cell ? 'rgba(123,94,167,0.08)' : 'rgba(255,255,255,0.7)',
            fontSize: '1.4rem', cursor: board[i] || winner || robotTurn ? 'default' : 'pointer',
            transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{cell}</button>
        ))}
      </div>
      {winner && (
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button onClick={reset} style={{ padding: '8px 20px', borderRadius: '50px', background: 'linear-gradient(135deg, var(--v), var(--pd))', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>Rejouer ✨</button>
        </div>
      )}
    </div>
  );
}

export default function AttenteWero() {
  const router = useRouter();
  const { user } = useAuth();
  const { prenom, domaine, sujet, message, minutes, montant, userId, tarif, telephone, tirage, cadeauUtilise, statutVIP } = router.query;
  const [enregistre, setEnregistre] = useState(false);
  const [tirageId, setTirageId] = useState(null);

  useEffect(() => {
    if (!router.isReady || !user || enregistre) return;
    const id = `wero_${user.uid}_${Date.now()}`;
    if (tirage === 'true') {
      setDoc(doc(db, 'tirages', id), {
        sessionId: id,
        userId: user.uid,
        prenom,
        telephone: telephone || '',
        statut: 'en_attente',
        paiement: 'wero',
        createdAt: serverTimestamp(),
        messagesNonLus: 0,
        cadeauUtilise: cadeauUtilise || null,
        statutVIP: statutVIP || 'bronze',
      }).then(() => {
        setEnregistre(true);
        setTirageId(id);
      });
    } else {
      if (!minutes) return;
      setDoc(doc(db, 'consultations', id), {
        consultationId: id,
        userId: user.uid,
        prenom, domaine, sujet, message,
        minutes: parseInt(minutes),
        montant: parseFloat(montant),
        statut: 'en_attente',
        paiement: 'wero',
        createdAt: serverTimestamp(),
        secondesRestantes: parseInt(minutes) * 60,
        telephone: telephone || '',
        messagesNonLus: 0,
        lastMessage: `Paiement Wero en attente de confirmation`,
        cadeauUtilise: cadeauUtilise || null,
        statutVIP: statutVIP || 'bronze',
      });
      setEnregistre(true);
    }
  }, [user, router.isReady]);

  return (
    <>
      <Stars />
      <Navbar />
      <div className="container-sm" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
        <div className="card fade-up" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '2rem', background: 'linear-gradient(135deg, var(--v), var(--pd))', color: '#fff', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📱</div>
            <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.5rem', fontWeight: 400 }}>Paiement Wero</h1>
          </div>
          <div style={{ padding: '2rem' }}>
            <div style={{ padding: '1.5rem', borderRadius: 'var(--r)', background: 'rgba(123,94,167,0.06)', border: '2px solid var(--vl)', textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>Montant à envoyer</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '2.5rem', color: 'var(--vd)' }}>
                {parseFloat(montant || 0).toFixed(2).replace('.', ',')}€
              </div>
              <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
                {tirage === 'true' ? 'Tirage Lenormand express' : `${minutes} minutes · Sans frais`}
              </div>
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                Comment payer via Wero
              </div>
              {[
                { n: '1', txt: 'Ouvre ton application bancaire (BNP, Société Générale, CIC, La Banque Postale…)' },
                { n: '2', txt: 'Va dans l\'onglet "Wero" ou "Virement instantané"' },
                { n: '3', txt: `Envoie ${parseFloat(montant || 0).toFixed(2)}€ au numéro` },
                { n: '4', txt: 'Indique ton prénom en commentaire pour que je t\'identifie' },
              ].map(step => (
                <div key={step.n} style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'flex-start' }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, var(--v), var(--pd))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600 }}>{step.n}</div>
                  <div style={{ fontSize: '14px', color: 'var(--txt)', lineHeight: 1.6, paddingTop: '3px' }}>{step.txt}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: '1.25rem', borderRadius: 'var(--r)', background: 'rgba(255,255,255,0.9)', border: '1.5px solid var(--border)', textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>Numéro Wero</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 600, color: 'var(--vd)', letterSpacing: '2px' }}>06 86 09 44 38</div>
              <button onClick={() => navigator.clipboard?.writeText('0686094438')} style={{ marginTop: '8px', padding: '4px 14px', borderRadius: '50px', border: '1px solid var(--border)', background: 'transparent', fontSize: '12px', color: 'var(--muted)', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                Copier le numéro
              </button>
            </div>
            <div style={{ padding: '12px', borderRadius: 'var(--r)', background: 'rgba(239,159,39,0.1)', border: '1px solid rgba(239,159,39,0.3)', fontSize: '13px', color: '#7A4A00', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              ⚠️ {tirage === 'true' ? 'Tu seras redirigée vers le tirage automatiquement.' : 'Ton accès au chat sera activé manuellement dès réception du paiement. Cela prend généralement 2 à 5 minutes.'}
            </div>
            <button onClick={() => {
              if (tirage === 'true' && tirageId) router.push('/tirage?tirage_id=' + tirageId);
              else router.push('/historique');
            }} className="btn btn-primary btn-full">
              ✓ J'ai effectué le paiement
            </button>
            <Morpion />
          </div>
        </div>
      </div>
    </>
  );
}

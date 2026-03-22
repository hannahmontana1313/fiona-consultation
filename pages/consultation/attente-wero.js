import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Navbar from '../../components/Navbar';
import Stars from '../../components/Stars';
import { db } from '../../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

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
    ? winner === 'draw' ? '🤝 Egalite !' : winner === '✦' ? '🎉 Tu as gagne !' : '🔮 Le robot a gagne !'
    : robotTurn ? '🔮 Le robot reflechit...' : '✦ A ton tour !';

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

export default function AttenteWeroConsultation() {
  const router = useRouter();
  const { id, montant } = router.query;
  const [statut, setStatut] = useState(null);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'consultations', id), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setStatut(d.statut);
        if (d.statut === 'paye') {
          router.push(`/consultation/confirmation?id=${id}`);
        }
      }
    });
    return () => unsub();
  }, [id]);

  const montantNum = parseFloat(montant || 0);

  return (
    <>
      <Head><title>Paiement Wero — Fiona</title></Head>
      <Stars />
      <Navbar />
      <div className="container-sm" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
        <div className="card fade-up" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '2rem', background: 'linear-gradient(135deg, var(--v), var(--pd))', color: '#fff', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📱</div>
            <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.5rem', fontWeight: 400 }}>Paiement Wero</h1>
          </div>

          <div style={{ padding: '2rem' }}>
            {/* Montant */}
            <div style={{ padding: '1.5rem', borderRadius: 'var(--r)', background: 'rgba(123,94,167,0.06)', border: '2px solid var(--vl)', textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>Montant a envoyer</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '2.5rem', color: 'var(--vd)' }}>
                {montantNum.toFixed(2).replace('.', ',')}€
              </div>
              <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>Sans frais</div>
            </div>

            {/* Instructions */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                Comment payer via Wero
              </div>
              {[
                { n: '1', txt: 'Ouvre ton application bancaire (BNP, Societe Generale, CIC, La Banque Postale...)' },
                { n: '2', txt: 'Va dans l\'onglet "Wero" ou "Virement instantane"' },
                { n: '3', txt: `Envoie ${montantNum.toFixed(2)}€ au numero ci-dessous` },
                { n: '4', txt: 'Indique ton prenom en commentaire pour que je t\'identifie' },
              ].map(step => (
                <div key={step.n} style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'flex-start' }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, var(--v), var(--pd))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600 }}>{step.n}</div>
                  <div style={{ fontSize: '14px', color: 'var(--txt)', lineHeight: 1.6, paddingTop: '3px' }}>{step.txt}</div>
                </div>
              ))}
            </div>

            {/* Numero Wero */}
            <div style={{ padding: '1.25rem', borderRadius: 'var(--r)', background: 'rgba(255,255,255,0.9)', border: '1.5px solid var(--border)', textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>Numero Wero</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 600, color: 'var(--vd)', letterSpacing: '2px' }}>06 86 09 44 38</div>
              <button
                onClick={() => navigator.clipboard?.writeText('0686094438')}
                style={{ marginTop: '8px', padding: '4px 14px', borderRadius: '50px', border: '1px solid var(--border)', background: 'transparent', fontSize: '12px', color: 'var(--muted)', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}
              >
                Copier le numero
              </button>
            </div>

            {/* Avertissement */}
            <div style={{ padding: '12px', borderRadius: 'var(--r)', background: 'rgba(239,159,39,0.1)', border: '1px solid rgba(239,159,39,0.3)', fontSize: '13px', color: '#7A4A00', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              ⚠️ Votre tirage sera envoye par SMS entre 21h et 2h des confirmation du paiement par Fiona. Cela prend generalement 2 a 5 minutes.
            </div>

            {/* Bouton confirmation */}
            <button
              onClick={() => router.push('/historique')}
              className="btn btn-primary btn-full"
            >
              ✓ J'ai effectue le paiement
            </button>

            {/* Morpion pour patienter */}
            <Morpion />
          </div>
        </div>
      </div>
    </>
  );
}

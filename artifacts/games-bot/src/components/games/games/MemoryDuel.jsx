import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../../lib/telegram';
import { getAudioContext } from '../../../lib/audioPool';

const RULES = 'MEMORY DUEL ONLINE — Cards are revealed briefly, then flipped face-down. Flip two matching cards to collect a pair! Speed bonus: the faster you match, the more points you earn. Your total pairs × speed score competes against your opponent!';

const GLYPHS = ['★','◆','▲','●','■','✦','⬟','⬡','✿','◉','◈','✪','✶','✷','♥','♣'];
const GRID = 16; // 4×4
const PEEK_TIME = 2200; // ms to show all cards at start

function flipSound() {
  try {
    const ac = getAudioContext();
    const o = ac.createOscillator(); const g = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    o.frequency.value = 420; o.type = 'sine';
    g.gain.setValueAtTime(0.18, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.09);
    o.start(); o.stop(ac.currentTime + 0.09);
  } catch {}
}

function matchSound() {
  try {
    const ac = getAudioContext();
    [523, 659, 784, 1047].forEach((f, i) => {
      const o = ac.createOscillator(); const g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.frequency.value = f; o.type = 'sine';
      g.gain.setValueAtTime(0.22, ac.currentTime + i * 0.06);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.06 + 0.08);
      o.start(ac.currentTime + i * 0.06); o.stop(ac.currentTime + i * 0.06 + 0.08);
    });
  } catch {}
}

export default function MemoryDuel({ phase, setPhase, onScoreUpdate }) {
  const [cards,   setCards]   = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState(new Set());
  const [score,   setScore]   = useState(0);
  const [locked,  setLocked]  = useState(false);
  const [peeking, setPeeking] = useState(false);
  const [moves,   setMoves]   = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [bestTime,setBestTime]= useState(null);

  const scoreRef  = useRef(0);
  const movesRef  = useRef(0);
  const startRef  = useRef(0);
  const timerRef  = useRef();
  const peekRef   = useRef();
  const tapTimersRef = useRef([]);
  const gameOverRef = useRef(false);

  const endGame = useCallback(() => {
    clearInterval(timerRef.current);
    gameOverRef.current = true;
    const timeSeconds = (Date.now() - startRef.current) / 1000;
    // Pairs score: 8 pairs × 500 = 4000. Time bonus: max 800 at 10s, 0 at 120s+
    const timeBonus = Math.max(0, Math.round(800 * Math.max(0, 1 - timeSeconds / 120)));
    const finalScore = scoreRef.current * 500 + timeBonus;
    if (onScoreUpdate) onScoreUpdate(finalScore);
    triggerHaptic('success');
    // Bot completes the same puzzle in a random time range (slower than a good player)
    const botTime = 35 + Math.random() * 50; // 35-85s
    const botBonus = Math.max(0, Math.round(800 * Math.max(0, 1 - botTime / 120)));
    const botFinalScore = GRID / 2 * 500 + botBonus;
    const playerWon = finalScore >= botFinalScore;
    setTimeout(() => setPhase(playerWon ? 'won' : 'lost'), 800);
  }, [setPhase, onScoreUpdate]);

  const init = useCallback(() => {
    clearInterval(timerRef.current);
    gameOverRef.current = false;
    const pairs = GLYPHS.slice(0, GRID / 2);
    const arr = [...pairs, ...pairs].map((g, i) => ({ id: i, glyph: g }));
    // Fisher-Yates proper shuffle
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const deck = arr;
    scoreRef.current = 0; movesRef.current = 0;
    setCards(deck); setFlipped([]); setMatched(new Set()); setScore(0); setLocked(false); setMoves(0); setElapsed(0); setBestTime(null);
    // Peek phase
    setPeeking(true);
    if (peekRef.current) clearTimeout(peekRef.current);
    peekRef.current = setTimeout(() => { setPeeking(false); startRef.current = Date.now(); timerRef.current = setInterval(() => setElapsed(Math.round((Date.now() - startRef.current) / 1000)), 1000); }, PEEK_TIME);
  }, []);

  useEffect(() => {
    if (phase !== 'playing') { clearInterval(timerRef.current); clearTimeout(peekRef.current); tapTimersRef.current.forEach(clearTimeout); tapTimersRef.current = []; return; }
    init();
    return () => { clearInterval(timerRef.current); clearTimeout(peekRef.current); tapTimersRef.current.forEach(clearTimeout); tapTimersRef.current = []; };
  }, [phase]);

  const tap = useCallback((id) => {
    if (gameOverRef.current || locked || peeking) return;
    if (flipped.includes(id) || matched.has(id)) return;
    flipSound(); triggerHaptic('light');
    const nf = [...flipped, id];
    setFlipped(nf);

    if (nf.length === 2) {
      setLocked(true);
      movesRef.current++;
      setMoves(movesRef.current);
      const [a, b] = nf.map(i => cards[i]);

      if (a.glyph === b.glyph) {
        matchSound(); triggerHaptic('success');
        const nm = new Set(matched);
        nm.add(nf[0]); nm.add(nf[1]);
        setMatched(nm);
        scoreRef.current++;
        setScore(scoreRef.current);
        if (onScoreUpdate) onScoreUpdate(scoreRef.current * 100);
        const t1 = setTimeout(() => { tapTimersRef.current = tapTimersRef.current.filter(id => id !== t1); setFlipped([]); setLocked(false); if (nm.size >= GRID) endGame(); }, 350);
        tapTimersRef.current.push(t1);
      } else {
        const t2 = setTimeout(() => { tapTimersRef.current = tapTimersRef.current.filter(id => id !== t2); setFlipped([]); setLocked(false); }, 800);
        tapTimersRef.current.push(t2);
      }
    }
  }, [flipped, matched, cards, locked, peeking, endGame, onScoreUpdate]);

  if (phase === 'rules') return <p style={{ color: 'rgba(203,213,225,0.85)', fontSize: 14, lineHeight: 1.7 }}>{RULES}</p>;

  const progress = matched.size / GRID;
  const pairsLeft = (GRID - matched.size) / 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <HudCard label="Pairs" value={`${matched.size / 2}/${GRID / 2}`} color="#f59e0b" />
        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '8px 0' }}>
          <p style={{ fontSize: 8, color: 'rgba(148,163,184,0.4)', margin: 0, textTransform: 'uppercase' }}>Time</p>
          <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 22, color: '#fff', margin: 0 }}>{elapsed}s</p>
        </div>
        <HudCard label="Moves" value={moves} color="#00d4ff" />
      </div>

      {/* Progress bar */}
      <div style={{ height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden' }}>
        <motion.div animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.4, type: 'spring' }}
          style={{ height: '100%', background: 'linear-gradient(90deg, #f59e0b, #ffd700)', borderRadius: 99, boxShadow: '0 0 10px rgba(255,215,0,0.5)' }} />
      </div>

      {peeking && (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          style={{ textAlign: 'center', padding: '8px 0', borderRadius: 12, background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.3)' }}>
          <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 14, color: '#ffd700', margin: 0 }}>MEMORIZE!</p>
          <p style={{ fontSize: 10, color: 'rgba(255,215,0,0.5)', margin: '3px 0 0' }}>Cards hide in a moment...</p>
        </motion.div>
      )}

      {/* Card grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, touchAction: 'none' }}>
        {cards.map((card, i) => {
          const isFlipped = flipped.includes(i) || matched.has(i) || peeking;
          const isMatched = matched.has(i);
          return (
            <div key={i} onClick={() => tap(i)}
              style={{ aspectRatio: '1', perspective: 400, cursor: !isFlipped ? 'pointer' : 'default' }}>
              <motion.div
                animate={{ rotateY: isFlipped ? 0 : 180 }}
                transition={{ duration: 0.35, type: 'spring', stiffness: 240, damping: 22 }}
                style={{
                  width: '100%', height: '100%', position: 'relative',
                  transformStyle: 'preserve-3d',
                }}>
                {/* Front face (glyph) */}
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: 14,
                  background: isMatched
                    ? 'linear-gradient(135deg, rgba(255,215,0,0.25), rgba(255,215,0,0.08))'
                    : 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))',
                  border: `1px solid ${isMatched ? 'rgba(255,215,0,0.5)' : 'rgba(255,255,255,0.14)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 26,
                  boxShadow: isMatched ? '0 0 20px rgba(255,215,0,0.25), inset 0 1px 0 rgba(255,255,255,0.1)' : 'inset 0 1px 0 rgba(255,255,255,0.05)',
                  WebkitBackfaceVisibility: 'hidden',
                  backfaceVisibility: 'hidden',
                }}>
                  {card.glyph}
                </div>
                {/* Back face (hidden) */}
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: 14,
                  background: 'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(0,100,140,0.06))',
                  border: '1px solid rgba(0,212,255,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transform: 'rotateY(180deg)',
                  WebkitBackfaceVisibility: 'hidden',
                  backfaceVisibility: 'hidden',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                }}>
                  <span style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 18, color: 'rgba(0,212,255,0.2)' }}>?</span>
                </div>
              </motion.div>
            </div>
          );
        })}
      </div>

      {pairsLeft > 0 && !peeking && (
        <motion.p animate={{ opacity: [0.35, 0.7, 0.35] }} transition={{ duration: 2, repeat: Infinity }}
          style={{ textAlign: 'center', fontSize: 10, color: 'rgba(148,163,184,0.35)', margin: 0, letterSpacing: '0.08em' }}>
          {pairsLeft} PAIRS REMAINING  •  FIND THEM ALL!
        </motion.p>
      )}
    </div>
  );
}

function HudCard({ label, value, color }) {
  return (
    <div style={{ background: `${color}07`, border: `1px solid ${color}20`, borderRadius: 12, padding: '8px 0', textAlign: 'center' }}>
      <p style={{ fontSize: 8, color: `${color}60`, margin: 0, textTransform: 'uppercase' }}>{label}</p>
      <motion.p key={String(value)} initial={{ scale: 1.2, opacity: 0.8 }} animate={{ scale: 1, opacity: 1 }}
        style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 18, color, margin: 0 }}>{value}</motion.p>
    </div>
  );
}

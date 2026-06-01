import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';
import { Square } from 'lucide-react';

const RULES = 'Tap hexagons to fill them with your color. Fill more than 60% to win the board = +100. Opponent auto-fills adjacent hexes every 1.5s. Wrong tap (already filled) = -150. Board resets after win. Reach 1000 in 180s!';
const DEFAULT_GAME_TIME = 180;
const TARGET = 1000;

const ROWS = [4, 5, 4, 5, 4];

function buildHexGrid() {
  const cells = [];
  let id = 0;
  ROWS.forEach((count, row) => {
    for (let col = 0; col < count; col++) {
      cells.push({ id: id++, row, col, owner: null });
    }
  });
  return cells;
}

function getNeighbors(cells, cell) {
  const offsets = [
    [-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]
  ];
  const neighbors = [];
  for (const [dr, dc] of offsets) {
    const nr = cell.row + dr;
    const nc = cell.col + dc;
    if (nr < 0 || nr >= ROWS.length) continue;
    const found = cells.find(c => c.row === nr && c.col === nc);
    if (found) neighbors.push(found);
  }
  return neighbors;
}

export default function HexFill({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [cells, setCells] = useState([]);
  const [flash, setFlash] = useState(null);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const cellsRef = useRef([]);
  const botTimerRef = useRef(null);

  const TARGET_SCORE = game.targetScore || TARGET;
  const TOTAL = ROWS.reduce((a, b) => a + b, 0);

  const endGame = useCallback(() => {
    activeRef.current = false;
    clearInterval(botTimerRef.current);
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const checkBoard = useCallback((current) => {
    const playerCount = current.filter(c => c.owner === 'player').length;
    if (playerCount / TOTAL >= 0.6) {
      scoreRef.current = Math.max(0, scoreRef.current + 100);
      setScore(scoreRef.current);
      triggerHaptic('medium');
      chord([660, 880, 1100], 0.06, 0.1, 'triangle');
      setFlash({ type: 'good', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      setTimeout(() => {
        if (!activeRef.current) return;
        const fresh = buildHexGrid();
        cellsRef.current = fresh;
        setCells(fresh);
      }, 700);
    }
  }, [endGame, onScoreUpdate, TARGET_SCORE]);

  const tapCell = useCallback((id) => {
    if (!activeRef.current) return;
    setCells(prev => {
      const cell = prev.find(c => c.id === id);
      if (!cell) return prev;
      if (cell.owner === 'player') {
        scoreRef.current = Math.max(0, scoreRef.current - 150);
        setScore(scoreRef.current);
        triggerHaptic('error');
        noise({ dur: 0.08, vol: 0.07 });
        setFlash({ type: 'bad', id: Date.now() });
        onScoreUpdate?.(scoreRef.current);
        return prev;
      }
      const next = prev.map(c => c.id === id ? { ...c, owner: 'player' } : c);
      cellsRef.current = next;
      beep({ freq: 440, dur: 0.06, vol: 0.07 });
      checkBoard(next);
      return next;
    });
  }, [checkBoard, onScoreUpdate]);

  const botMove = useCallback(() => {
    if (!activeRef.current) return;
    setCells(prev => {
      const empty = prev.filter(c => !c.owner);
      if (empty.length === 0) return prev;
      const botOwned = prev.filter(c => c.owner === 'bot');
      let candidates = [];
      if (botOwned.length > 0) {
        const adj = new Set();
        botOwned.forEach(b => getNeighbors(prev, b).forEach(n => { if (!n.owner) adj.add(n.id); }));
        candidates = [...adj];
      }
      if (candidates.length === 0) candidates = empty.map(c => c.id);
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      const next = prev.map(c => c.id === pick ? { ...c, owner: 'bot' } : c);
      cellsRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0;
    setScore(0); setTimeLeft(GAME_TIME);
    activeRef.current = true;
    const fresh = buildHexGrid();
    cellsRef.current = fresh;
    setCells(fresh);

    botTimerRef.current = setInterval(botMove, 1500);

    const iv = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(iv); clearInterval(botTimerRef.current); endGame(); return 0; }
        return t - 1;
      });
    }, 1000);

    return () => { activeRef.current = false; clearInterval(iv); clearInterval(botTimerRef.current); };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + Math.floor(scoreRef.current / 10)} setPhase={setPhase} />;

  const HEX_R = 26;
  const W = HEX_R * Math.sqrt(3);
  const H = HEX_R * 2;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#10b981" />
        <Hud label="FILLED" v={`${cells.filter(c => c.owner === 'player').length}/${TOTAL}`} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 20 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 8 }}>
        <MomentumFlash msg={flash?.type === 'good' ? 'BOARD FILLED!' : 'ALREADY TAKEN!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        <svg
          width={280} height={240}
          viewBox="0 0 280 240"
          style={{ overflow: 'visible' }}
        >
          {cells.map(cell => {
            const offsetX = cell.row % 2 === 1 ? W / 2 : 0;
            const cx = 40 + cell.col * W + offsetX + cell.row * 2;
            const cy = 30 + cell.row * H * 0.75;
            const points = Array.from({ length: 6 }, (_, i) => {
              const angle = (Math.PI / 180) * (60 * i - 30);
              return `${cx + HEX_R * Math.cos(angle)},${cy + HEX_R * Math.sin(angle)}`;
            }).join(' ');
            const fill = cell.owner === 'player' ? '#10b981' : cell.owner === 'bot' ? '#ef4444' : 'rgba(255,255,255,0.04)';
            return (
              <motion.polygon
                key={cell.id}
                points={points}
                fill={fill}
                stroke={cell.owner ? fill : 'rgba(255,255,255,0.1)'}
                strokeWidth={1.5}
                whileTap={{ scale: 0.9 }}
                style={{ cursor: cell.owner ? 'default' : 'pointer', filter: cell.owner === 'player' ? 'drop-shadow(0 0 6px #10b98166)' : 'none' }}
                onPointerDown={() => tapCell(cell.id)}
              />
            );
          })}
        </svg>

        <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'rgba(148,163,184,0.5)' }}>
          <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 3 }}><Square size={10} fill="#10b981" /> YOU</span>
          <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 3 }}><Square size={10} fill="#ef4444" /> BOT</span>
          <span>FILL 60% TO WIN</span>
        </div>
      </div>
    </div>
  );
}

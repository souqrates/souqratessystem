import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Draw a curve that passes through all target dots. Hit all dots = +100. Miss a dot = -20. Hit a red zone = -150. More dots and zones after 400 pts. Reach 1000 in 90 seconds!';
const DEFAULT_GAME_TIME = 90;
const TARGET = 1000;

const W = 280;
const H = 200;
const DOT_R = 10;

function genLevel(level) {
  const dotCount = 3 + level;
  const zoneCount = 1 + level;
  const dots = Array.from({ length: dotCount }, (_, i) => ({
    x: 20 + (i / (dotCount - 1)) * (W - 40) + (Math.random() - 0.5) * 20,
    y: 30 + Math.random() * (H - 60),
    id: i,
  }));
  const zones = Array.from({ length: zoneCount }, () => ({
    x: 40 + Math.random() * (W - 80),
    y: 30 + Math.random() * (H - 60),
    r: 18 + Math.random() * 10,
  }));
  return { dots, zones };
}

export default function CurveDraw({ phase, setPhase, game, onScoreUpdate }) {
  const GAME_TIME = game?.durationSeconds || DEFAULT_GAME_TIME;
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [level, setLevel] = useState(null);
  const [path, setPath] = useState([]);
  const [drawing, setDrawing] = useState(false);
  const [flash, setFlash] = useState(null);
  const svgRef = useRef(null);

  const scoreRef = useRef(0);
  const activeRef = useRef(false);
  const pathRef = useRef([]);

  const TARGET_SCORE = game.targetScore || TARGET;

  const endGame = useCallback(() => {
    activeRef.current = false;
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const newLevel = useCallback(() => {
    if (!activeRef.current) return;
    setLevel(genLevel(Math.floor(scoreRef.current / 200)));
    setPath([]); pathRef.current = []; setDrawing(false);
  }, []);

  const getSVGPoint = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
  }, []);

  const startDraw = useCallback((e) => {
    if (!activeRef.current) return;
    const pt = getSVGPoint(e);
    if (!pt) return;
    setDrawing(true);
    pathRef.current = [pt];
    setPath([pt]);
  }, [getSVGPoint]);

  const moveDraw = useCallback((e) => {
    if (!drawing) return;
    const pt = getSVGPoint(e);
    if (!pt) return;
    pathRef.current = [...pathRef.current, pt];
    setPath([...pathRef.current]);
  }, [drawing, getSVGPoint]);

  const endDraw = useCallback(() => {
    if (!drawing || !level) return;
    setDrawing(false);
    const p = pathRef.current;
    if (p.length < 4) { setPath([]); pathRef.current = []; return; }

    // Check zones
    let hitZone = false;
    for (const pt of p) {
      for (const z of level.zones) {
        if (Math.sqrt((pt.x - z.x) ** 2 + (pt.y - z.y) ** 2) < z.r) { hitZone = true; break; }
      }
      if (hitZone) break;
    }
    if (hitZone) {
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      triggerHaptic('error');
      noise({ dur: 0.1, vol: 0.09 });
      setFlash({ type: 'bad', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      setPath([]); pathRef.current = [];
      return;
    }

    // Count dots hit
    let hit = 0;
    for (const dot of level.dots) {
      if (p.some(pt => Math.sqrt((pt.x - dot.x) ** 2 + (pt.y - dot.y) ** 2) < DOT_R + 4)) hit++;
    }
    const missed = level.dots.length - hit;
    const pts = Math.max(0, 100 - missed * 20);
    if (pts > 0) {
      scoreRef.current = Math.max(0, scoreRef.current + pts);
      setScore(scoreRef.current);
      triggerHaptic('medium');
      chord([660, 880], 0.05, 0.09, 'triangle');
      setFlash({ type: 'good', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      setTimeout(newLevel, 600);
    } else {
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      triggerHaptic('error');
      noise({ dur: 0.09, vol: 0.08 });
      setFlash({ type: 'bad', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      setPath([]); pathRef.current = [];
    }
  }, [drawing, level, endGame, onScoreUpdate, newLevel, TARGET_SCORE]);

  useEffect(() => {
    if (phase !== 'playing') return;
    scoreRef.current = 0;
    setScore(0); setTimeLeft(GAME_TIME);
    activeRef.current = true;
    newLevel();

    const iv = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(iv); endGame(); return 0; }
        return t - 1;
      });
    }, 1000);

    return () => { activeRef.current = false; clearInterval(iv); };
  }, [phase]);

  if (phase === 'rules') return <Rules text={RULES} />;
  if (phase === 'won' || phase === 'lost') return <ResultOverlay won={phase === 'won'} earnings={phase === 'won' ? game.prize || 0 : 0} xpEarned={20 + Math.floor(scoreRef.current / 10)} setPhase={setPhase} />;

  const pathD = path.length > 1 ? `M ${path.map(p => `${p.x},${p.y}`).join(' L ')}` : '';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HudRow>
        <Hud label="SCORE" v={score} c="#06b6d4" />
        <Hud label="DOTS" v={level?.dots.length || 0} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 15 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 8 }}>
        <MomentumFlash msg={flash?.type === 'good' ? 'NICE CURVE!' : 'MISSED!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

        <svg
          ref={svgRef}
          width={W} height={H}
          viewBox={`0 0 ${W} ${H}`}
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, touchAction: 'none', cursor: 'crosshair' }}
          onPointerDown={startDraw}
          onPointerMove={moveDraw}
          onPointerUp={endDraw}
          onPointerLeave={endDraw}
        >
          {level && (
            <>
              {level.zones.map((z, i) => (
                <circle key={i} cx={z.x} cy={z.y} r={z.r} fill="rgba(239,68,68,0.2)" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 3" />
              ))}
              {level.dots.map(d => (
                <circle key={d.id} cx={d.x} cy={d.y} r={DOT_R} fill="rgba(6,182,212,0.3)" stroke="#06b6d4" strokeWidth={2} />
              ))}
              {pathD && <path d={pathD} stroke="#06b6d4" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
            </>
          )}
        </svg>

        <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'rgba(148,163,184,0.5)' }}>
          <span style={{ color: '#06b6d4' }}>● HIT DOTS</span>
          <span style={{ color: '#ef4444' }}>◎ AVOID ZONES</span>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rules, Hud, HudRow, TimeBar, TargetBar, MomentumFlash } from './_shell';
import ResultOverlay from './ResultOverlay';
import { beep, chord, noise } from './_gameKit';
import { triggerHaptic } from '../../../lib/telegram';

const RULES = 'Draw a path from START to END avoiding obstacles. Smooth curve = +100. Hit obstacle = -150. More obstacles appear after 400 pts. Reach 1000 in 120 seconds!';
const DEFAULT_GAME_TIME = 120;
const TARGET = 1000;

const W = 280;
const H = 200;

function genLevel(level) {
  const obsCount = 3 + level * 2;
  const obstacles = [];
  for (let i = 0; i < obsCount; i++) {
    obstacles.push({
      x: 30 + Math.random() * (W - 60),
      y: 30 + Math.random() * (H - 60),
      r: 12 + Math.random() * 8,
    });
  }
  return { obstacles, start: { x: 20, y: H / 2 }, end: { x: W - 20, y: H / 2 } };
}

function dist(ax, ay, bx, by) { return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2); }

function pathHitsObstacle(path, obstacles) {
  for (let i = 0; i < path.length; i++) {
    for (const obs of obstacles) {
      if (dist(path[i].x, path[i].y, obs.x, obs.y) < obs.r + 6) return true;
    }
  }
  return false;
}

export default function LineRiderPro({ phase, setPhase, game, onScoreUpdate }) {
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
  const levelNum = Math.floor(scoreRef.current / 200);

  const endGame = useCallback(() => {
    activeRef.current = false;
    onScoreUpdate?.(scoreRef.current);
    setTimeout(() => setPhase(scoreRef.current >= TARGET_SCORE ? 'won' : 'lost'), 300);
  }, [setPhase, onScoreUpdate, TARGET_SCORE]);

  const newLevel = useCallback(() => {
    if (!activeRef.current) return;
    const lv = genLevel(Math.floor(scoreRef.current / 200));
    setLevel(lv);
    setPath([]);
    pathRef.current = [];
    setDrawing(false);
  }, []);

  const getSVGPoint = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }, []);

  const startDraw = useCallback((e) => {
    if (!activeRef.current || !level) return;
    const pt = getSVGPoint(e);
    if (!pt) return;
    if (dist(pt.x, pt.y, level.start.x, level.start.y) > 20) return;
    setDrawing(true);
    pathRef.current = [pt];
    setPath([pt]);
  }, [level, getSVGPoint]);

  const moveDraw = useCallback((e) => {
    if (!drawing || !activeRef.current) return;
    const pt = getSVGPoint(e);
    if (!pt) return;
    pathRef.current = [...pathRef.current, pt];
    setPath([...pathRef.current]);
  }, [drawing, getSVGPoint]);

  const endDraw = useCallback(() => {
    if (!drawing || !activeRef.current || !level) return;
    setDrawing(false);
    const p = pathRef.current;
    if (p.length < 3) { setPath([]); pathRef.current = []; return; }

    const last = p[p.length - 1];
    const reachedEnd = dist(last.x, last.y, level.end.x, level.end.y) < 25;

    if (!reachedEnd) {
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      triggerHaptic('error');
      noise({ dur: 0.1, vol: 0.09 });
      setFlash({ type: 'bad', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      setPath([]); pathRef.current = [];
      return;
    }

    if (pathHitsObstacle(p, level.obstacles)) {
      scoreRef.current = Math.max(0, scoreRef.current - 150);
      setScore(scoreRef.current);
      triggerHaptic('error');
      noise({ dur: 0.1, vol: 0.09 });
      setFlash({ type: 'bad', id: Date.now() });
      onScoreUpdate?.(scoreRef.current);
      setPath([]); pathRef.current = [];
      return;
    }

    scoreRef.current = Math.max(0, scoreRef.current + 100);
    setScore(scoreRef.current);
    triggerHaptic('medium');
    chord([660, 880, 1100], 0.06, 0.1, 'triangle');
    setFlash({ type: 'good', id: Date.now() });
    onScoreUpdate?.(scoreRef.current);
    setTimeout(newLevel, 600);
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
        <Hud label="LEVEL" v={levelNum + 1} c="#94a3b8" />
        <Hud label="TIME" v={timeLeft} c={timeLeft <= 20 ? '#ef4444' : '#94a3b8'} />
      </HudRow>
      <TargetBar score={score} target={TARGET_SCORE} label="TARGET TO WIN" />
      <TimeBar totalTime={GAME_TIME} timeLeft={timeLeft} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 8 }}>
        <MomentumFlash msg={flash?.type === 'good' ? 'CLEAR!' : 'HIT!'} color={flash?.type === 'good' ? '#10b981' : '#ef4444'} trigger={flash?.id} />

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
              {/* Obstacles */}
              {level.obstacles.map((obs, i) => (
                <circle key={i} cx={obs.x} cy={obs.y} r={obs.r} fill="rgba(239,68,68,0.3)" stroke="#ef4444" strokeWidth={1.5} />
              ))}

              {/* Start */}
              <circle cx={level.start.x} cy={level.start.y} r={10} fill="rgba(16,185,129,0.4)" stroke="#10b981" strokeWidth={2} />
              <text x={level.start.x} y={level.start.y + 4} textAnchor="middle" fill="#10b981" fontSize={8} fontWeight="bold">S</text>

              {/* End */}
              <circle cx={level.end.x} cy={level.end.y} r={10} fill="rgba(249,115,22,0.4)" stroke="#f97316" strokeWidth={2} />
              <text x={level.end.x} y={level.end.y + 4} textAnchor="middle" fill="#f97316" fontSize={8} fontWeight="bold">E</text>

              {/* Drawn path */}
              {pathD && <path d={pathD} stroke="#06b6d4" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
            </>
          )}
        </svg>

        <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: 11, letterSpacing: '0.15em' }}>DRAW PATH FROM S TO E</p>
      </div>
    </div>
  );
}

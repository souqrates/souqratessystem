import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { triggerHaptic } from '../../../lib/telegram'
import { getFrameInterval } from '../../../lib/canvasQuality';
import { TimeBar } from './_shell';

const W = 340
const H = 440
const DEFAULT_GAME_DURATION = 60
const ACCENT = '#00d4ff'
const CX = W / 2
const CY = 210
const RADIUS = 130
const TARGET_HALF_ARC = 0.18
const CENTER_HALF_ARC = 0.06

const SECTOR_COLORS = [
  '#00d4ff', '#7c3aed', '#ff6b35', '#00ff88',
  '#ff2d78', '#ffd700', '#00bcd4', '#e91e63',
]

function HudCard({ label, value, accent }) {
  return (
    <div style={{
      background: 'rgba(0,212,255,0.07)',
      border: `1px solid ${accent || ACCENT}44`,
      borderRadius: 10,
      padding: '6px 14px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minWidth: 64,
    }}>
      <span style={{ color: '#7eaacc', fontSize: 10, fontFamily: 'Orbitron, sans-serif', letterSpacing: 1 }}>{label}</span>
      <span style={{ color: accent || ACCENT, fontSize: 20, fontFamily: 'Orbitron, sans-serif', fontWeight: 700 }}>{value}</span>
    </div>
  )
}

function polarToXY(cx, cy, r, angle) {
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  }
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToXY(cx, cy, r, startAngle)
  const end = polarToXY(cx, cy, r, endAngle)
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`
}

export default function SpinMaster({ phase, setPhase, onScoreUpdate, game}) {
  const GAME_DURATION = game?.durationSeconds || DEFAULT_GAME_DURATION;
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [spinAngle, setSpinAngle] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [frozen, setFrozen] = useState(false)
  const [roundResult, setRoundResult] = useState(null)
  const [speedMult, setSpeedMult] = useState(1)
  const [roundCount, setRoundCount] = useState(0)
  const scoreRef = useRef(0)
  const spinRef = useRef(null)
  const timerRef = useRef(null)
  const angleRef = useRef(0)
  const speedRef = useRef(1)
  const frozenRef = useRef(false)
  const timeRef = useRef(GAME_DURATION)
  const resultTimerRef = useRef(null)

  const TARGET_ANGLE = -Math.PI / 2
  const BASE_SPEED = 2.2

  const startSpin = useCallback((mult) => {
    frozenRef.current = false
    setFrozen(false)
    setRoundResult(null)
    speedRef.current = mult
    setSpinning(true)
    if (spinRef.current) cancelAnimationFrame(spinRef.current)
    let _skzLastT = 0;
    const _skzFI = getFrameInterval();
    let _skzRaf;
    const tick = (now = performance.now()) => {
      if (now - _skzLastT < _skzFI) { _skzRaf = requestAnimationFrame(tick); return; }
      _skzLastT = now;
      if (frozenRef.current) return
      const radPerFrame = (BASE_SPEED * speedRef.current * Math.PI) / 180
      angleRef.current = (angleRef.current + radPerFrame) % (Math.PI * 2)
      setSpinAngle(angleRef.current)
      spinRef.current = requestAnimationFrame(tick)
    }
    spinRef.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => {
    if (phase !== 'playing') {
      cancelAnimationFrame(spinRef.current)
      clearInterval(timerRef.current)
      clearTimeout(resultTimerRef.current)
      return
    }
    scoreRef.current = 0
    setScore(0)
    setTimeLeft(GAME_DURATION)
    timeRef.current = GAME_DURATION
    setRoundCount(0)
    setSpeedMult(1)
    angleRef.current = 0
    startSpin(1)

    timerRef.current = setInterval(() => {
      timeRef.current -= 1
      setTimeLeft(timeRef.current)
      const elapsed = GAME_DURATION - timeRef.current
      const newMult = 1 + elapsed * 0.025
      speedRef.current = newMult
      setSpeedMult(newMult)
      if (timeRef.current <= 0) {
        clearInterval(timerRef.current)
        cancelAnimationFrame(spinRef.current)
        frozenRef.current = true
        setFrozen(true)
        setSpinning(false)
        setPhase('won')
      }
    }, 1000)

    return () => {
      cancelAnimationFrame(spinRef.current)
      clearInterval(timerRef.current)
      clearTimeout(resultTimerRef.current)
    }
  }, [phase, setPhase, startSpin])

  const handleStop = useCallback(() => {
    if (!spinning || frozen || phase !== 'playing') return
    frozenRef.current = true
    setFrozen(true)
    setSpinning(false)
    cancelAnimationFrame(spinRef.current)

    const angle = angleRef.current
    const normalized = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
    const target = ((TARGET_ANGLE % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
    let diff = Math.abs(normalized - target)
    if (diff > Math.PI) diff = Math.PI * 2 - diff

    let pts = 0
    let label = 'MISS'
    let color = '#ff4466'
    if (diff <= CENTER_HALF_ARC) {
      pts = 100; label = 'PERFECT!'; color = '#ffd700'; triggerHaptic('heavy')
    } else if (diff <= TARGET_HALF_ARC) {
      pts = 50; label = 'GREAT!'; color = '#00ff88'; triggerHaptic('medium')
    } else {
      pts = 0; label = 'MISS'; color = '#ff4466'; triggerHaptic('light')
    }

    scoreRef.current += pts
    setScore(scoreRef.current)
    onScoreUpdate(scoreRef.current)
    setRoundResult({ pts, label, color })
    setRoundCount(c => c + 1)

    resultTimerRef.current = setTimeout(() => {
      if (timeRef.current > 0) {
        startSpin(speedRef.current)
      }
    }, 900)
  }, [spinning, frozen, phase, onScoreUpdate, startSpin])

  const SECTORS = 8
  const sectorAngle = (Math.PI * 2) / SECTORS

  if (phase === 'rules') {
    return (
      <div style={{ padding: 24, fontFamily: 'Orbitron, sans-serif', color: '#cde' }}>
        <p style={{ lineHeight: 1.7, fontSize: 14 }}>
          SPIN MASTER — Stop the spinner in the green zone! Press STOP to freeze the spinning wheel. Landing in the zone = 50-100 pts! The wheel spins faster each round. 60 seconds — rack up as many perfect stops as you can. Outspin 3 opponents!
        </p>
      </div>
    )
  }

  const needleAngle = spinning || frozen ? angleRef.current : spinAngle
  const needleX = CX + (RADIUS + 14) * Math.cos(TARGET_ANGLE)
  const needleY = CY + (RADIUS + 14) * Math.sin(TARGET_ANGLE)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      background: '#030912',
      paddingBottom: 24,
      fontFamily: 'Orbitron, sans-serif',
    }}>
      <div style={{ display: 'flex', gap: 12, margin: '16px 0 4px' }}>
        <HudCard label="SCORE" value={score} />
        <HudCard label="TIME" value={timeLeft} accent={timeLeft <= 10 ? '#ff4466' : ACCENT} />
        <HudCard label="ROUND" value={roundCount} accent="#7c3aed" />
      </div>

      <TimeBar totalTime={GAME_DURATION} timeLeft={timeLeft} />

      <svg width={W} height={H} style={{ display: 'block' }}>
        <defs>
          <filter id="spinGlow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="strongGlow">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id="wheelCenter" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1a3060" />
            <stop offset="100%" stopColor="#050e1f" />
          </radialGradient>
        </defs>

        <circle cx={CX} cy={CY} r={RADIUS + 20} fill="#050e1f" />
        <circle cx={CX} cy={CY} r={RADIUS + 20} fill="none" stroke="#1a3050" strokeWidth={2} />

        <g transform={`rotate(${(spinAngle * 180) / Math.PI} ${CX} ${CY})`}>
          {Array.from({ length: SECTORS }, (_, i) => {
            const startA = i * sectorAngle - sectorAngle / 2
            const endA = startA + sectorAngle
            return (
              <path
                key={i}
                d={describeArc(CX, CY, RADIUS, startA, endA)}
                fill={SECTOR_COLORS[i % SECTOR_COLORS.length]}
                opacity={0.85}
                stroke="#030912"
                strokeWidth={2}
              />
            )
          })}
          <circle cx={CX} cy={CY} r={28} fill="url(#wheelCenter)" stroke="#00d4ff" strokeWidth={2} filter="url(#spinGlow)" />
          <circle cx={CX} cy={CY} r={8} fill="#00d4ff" filter="url(#strongGlow)" />
        </g>

        <path
          d={describeArc(CX, CY, RADIUS + 2, TARGET_ANGLE - TARGET_HALF_ARC, TARGET_ANGLE + TARGET_HALF_ARC)}
          fill="none"
          stroke="#00ff88"
          strokeWidth={10}
          opacity={0.7}
          filter="url(#spinGlow)"
        />
        <path
          d={describeArc(CX, CY, RADIUS + 2, TARGET_ANGLE - CENTER_HALF_ARC, TARGET_ANGLE + CENTER_HALF_ARC)}
          fill="none"
          stroke="#ffd700"
          strokeWidth={10}
          opacity={0.9}
          filter="url(#strongGlow)"
        />

        <polygon
          points={`${needleX},${needleY - 14} ${needleX - 8},${needleY + 8} ${needleX + 8},${needleY + 8}`}
          fill="#ffffff"
          filter="url(#spinGlow)"
          opacity={0.9}
        />

        {roundResult && (
          <text
            x={CX}
            y={CY - RADIUS - 28}
            textAnchor="middle"
            fontSize={22}
            fontWeight={700}
            fontFamily="Orbitron, sans-serif"
            fill={roundResult.color}
            filter="url(#strongGlow)"
          >
            {roundResult.label}
          </text>
        )}
        {roundResult && roundResult.pts > 0 && (
          <text
            x={CX}
            y={CY - RADIUS - 6}
            textAnchor="middle"
            fontSize={15}
            fontFamily="Orbitron, sans-serif"
            fill={roundResult.color}
          >
            +{roundResult.pts} pts
          </text>
        )}

        <text x={CX - 60} y={CY + RADIUS + 32} textAnchor="middle" fontSize={10} fill="#3a5070" fontFamily="Orbitron, sans-serif">ZONE</text>
        <rect x={CX - 85} y={CY + RADIUS + 18} width={52} height={8} rx={4} fill="#00ff88" opacity={0.5} />
        <text x={CX + 60} y={CY + RADIUS + 32} textAnchor="middle" fontSize={10} fill="#3a5070" fontFamily="Orbitron, sans-serif">PERFECT</text>
        <rect x={CX + 34} y={CY + RADIUS + 18} width={52} height={8} rx={4} fill="#ffd700" opacity={0.7} />
      </svg>

      <motion.button
        onTap={handleStop}
        whileTap={{ scale: 0.93 }}
        style={{
          marginTop: -20,
          width: 160,
          height: 56,
          borderRadius: 28,
          border: `2px solid ${spinning && !frozen ? '#00ff88' : '#1a3050'}`,
          background: spinning && !frozen
            ? 'linear-gradient(135deg, #00ff8833 0%, #00d4ff22 100%)'
            : '#0a162888',
          color: spinning && !frozen ? '#00ff88' : '#3a5070',
          fontSize: 20,
          fontFamily: 'Orbitron, sans-serif',
          fontWeight: 700,
          letterSpacing: 3,
          cursor: spinning && !frozen ? 'pointer' : 'default',
          boxShadow: spinning && !frozen ? '0 0 24px #00ff8844' : 'none',
          transition: 'all 0.2s',
        }}
      >
        STOP
      </motion.button>
    </div>
  )
}

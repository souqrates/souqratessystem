import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { triggerHaptic } from '../../../lib/telegram'
import PremiumStage from './_premiumStage'
import { TimeBar, TargetBar } from './_shell'

const W = 340
const H = 440
const DEFAULT_GAME_DURATION = 90
const ACCENT = '#00d4ff'

const HEX_COLS = 7
const HEX_ROWS = 7
const HEX_R = 24
const HEX_W = HEX_R * 2
const HEX_H = Math.sqrt(3) * HEX_R
const OFFSET_X = (W - HEX_COLS * HEX_W * 0.75 - HEX_R * 0.25) / 2
const OFFSET_Y = (H - HEX_ROWS * HEX_H - HEX_H / 2) / 2

const HEX_COLORS = ['#00d4ff', '#7c3aed', '#ff6b35', '#00ff88', '#ffd700', '#ff2d78']
const HEX_GLOW = ['#00d4ff', '#9d5cff', '#ff8c55', '#00ff88', '#ffd700', '#ff5599']

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

function hexCorners(cx, cy, r) {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 6
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`
  }).join(' ')
}

function hexCenter(col, row) {
  const x = OFFSET_X + col * HEX_W * 0.75 + HEX_R
  const y = OFFSET_Y + row * HEX_H + (col % 2 === 1 ? HEX_H / 2 : 0) + HEX_H / 2
  return { x, y }
}

function getHexNeighbors(col, row) {
  const isOdd = col % 2 === 1
  const dirs = isOdd
    ? [[-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [0, -1]]
    : [[-1, -1], [-1, 0], [0, 1], [1, 0], [1, -1], [0, -1]]
  return dirs.map(([dc, dr]) => [col + dc, row + dr])
    .filter(([c, r]) => c >= 0 && c < HEX_COLS && r >= 0 && r < HEX_ROWS)
}

function findGroup(grid, col, row) {
  const colorIdx = grid[col][row]
  if (colorIdx < 0) return []
  const visited = new Set()
  const stack = [[col, row]]
  const group = []
  while (stack.length > 0) {
    const [c, r] = stack.pop()
    const key = `${c},${r}`
    if (visited.has(key)) continue
    visited.add(key)
    if (grid[c] && grid[c][r] === colorIdx) {
      group.push([c, r])
      getHexNeighbors(c, r).forEach(([nc, nr]) => {
        if (!visited.has(`${nc},${nr}`)) stack.push([nc, nr])
      })
    }
  }
  return group
}

function makeGrid() {
  return Array.from({ length: HEX_COLS }, () =>
    Array.from({ length: HEX_ROWS }, () => Math.floor(Math.random() * HEX_COLORS.length))
  )
}

function applyGravity(grid) {
  return grid.map(col => {
    const filled = col.filter(v => v >= 0)
    const empties = col.length - filled.length
    return [...Array(empties).fill(-1), ...filled]
  })
}

function fillEmpty(grid) {
  return grid.map(col =>
    col.map(v => v < 0 ? Math.floor(Math.random() * HEX_COLORS.length) : v)
  )
}

export default function HexBlast({ phase, setPhase, onScoreUpdate, game}) {
  const GAME_DURATION = game?.durationSeconds || DEFAULT_GAME_DURATION;
  const [grid, setGrid] = useState(makeGrid)
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [highlighted, setHighlighted] = useState([])
  const [popEffects, setPopEffects] = useState([])
  const [shaking, setShaking] = useState([])
  const scoreRef = useRef(0)
  const popIdRef = useRef(0)
  const timerRef = useRef(null)

  useEffect(() => {
    if (phase !== 'playing') {
      clearInterval(timerRef.current)
      return
    }
    scoreRef.current = 0
    setScore(0)
    setTimeLeft(GAME_DURATION)
    setGrid(makeGrid())
    setHighlighted([])
    setPopEffects([])
    setShaking([])

    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current)
          const target = game?.targetScore || 500
          setPhase(scoreRef.current >= target ? 'won' : 'lost')
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [phase, setPhase])

  useEffect(() => {
    if (phase === 'playing') onScoreUpdate(score)
  }, [score, phase, onScoreUpdate])

  const handleHexTap = useCallback((col, row) => {
    if (phase !== 'playing') return
    const group = findGroup(grid, col, row)
    if (group.length < 3) {
      setShaking(group.map(([c, r]) => `${c},${r}`))
      setTimeout(() => setShaking([]), 400)
      triggerHaptic('light')
      return
    }

    const pts = group.length >= 5 ? 100 : group.length === 4 ? 50 : 30
    scoreRef.current += pts
    setScore(scoreRef.current)
    onScoreUpdate(scoreRef.current)
    triggerHaptic('medium')

    const { x, y } = hexCenter(col, row)
    const popId = popIdRef.current++
    setPopEffects(prev => [...prev, { id: popId, pts, x, y }])
    setTimeout(() => setPopEffects(prev => prev.filter(e => e.id !== popId)), 900)

    setGrid(prev => {
      let next = prev.map(c => [...c])
      group.forEach(([gc, gr]) => { next[gc][gr] = -1 })
      next = applyGravity(next)
      next = fillEmpty(next)
      return next
    })
    setHighlighted([])
  }, [phase, grid, onScoreUpdate])

  const handleHexHover = useCallback((col, row) => {
    if (phase !== 'playing') return
    const group = findGroup(grid, col, row)
    if (group.length >= 3) setHighlighted(group.map(([c, r]) => `${c},${r}`))
    else setHighlighted([])
  }, [phase, grid])

  if (phase === 'rules') {
    return (
      <div style={{ padding: 24, fontFamily: 'Orbitron, sans-serif', color: '#cde' }}>
        <p style={{ lineHeight: 1.7, fontSize: 14 }}>
          HEX BLAST — Pop groups of matching hexagons! Tap any hexagon in a group of 3 or more same-color hexes to blast them. 3 hex=30 pts, 4=50 pts, 5+=100 pts! 90 seconds to score bigger combos than 3 opponents!
        </p>
      </div>
    )
  }

  return (
    <PremiumStage accent="#10b981" accent2="#06b6d4">
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingBottom: 24,
      fontFamily: 'Orbitron, sans-serif',
    }}>
      <div style={{ display: 'flex', gap: 12, margin: '16px 0 4px' }}>
        <HudCard label="SCORE" value={score} />
        <HudCard label="TIME" value={timeLeft} accent={timeLeft <= 15 ? '#ff4466' : ACCENT} />
      </div>

      <TimeBar totalTime={GAME_DURATION} timeLeft={timeLeft} />
      <div style={{ width: '100%', maxWidth: W, margin: '6px 0 2px' }}>
        <TargetBar score={score} target={game?.targetScore || 500} label="TARGET TO WIN" />
      </div>

      <svg
        width={W}
        height={H}
        style={{ display: 'block', cursor: 'pointer' }}
        onMouseLeave={() => setHighlighted([])}
      >
        <defs>
          {HEX_COLORS.map((color, i) => (
            <radialGradient key={i} id={`hexGrad${i}`} cx="40%" cy="35%" r="70%">
              <stop offset="0%" stopColor={color} stopOpacity="0.9" />
              <stop offset="100%" stopColor={color} stopOpacity="0.55" />
            </radialGradient>
          ))}
          <filter id="hexGlow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="hexGlowStrong">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <rect width={W} height={H} fill="#030912" />

        {Array.from({ length: HEX_COLS }, (_, col) =>
          Array.from({ length: HEX_ROWS }, (_, row) => {
            const colorIdx = grid[col][row]
            if (colorIdx < 0) return null
            const { x, y } = hexCenter(col, row)
            const key = `${col},${row}`
            const isHighlighted = highlighted.includes(key)
            const isShaking = shaking.includes(key)
            const color = HEX_COLORS[colorIdx]
            const glow = HEX_GLOW[colorIdx]
            const r = isHighlighted ? HEX_R - 1 : HEX_R - 2

            return (
              <g
                key={key}
                onClick={() => handleHexTap(col, row)}
                onMouseEnter={() => handleHexHover(col, row)}
                transform={isShaking ? `translate(${(col % 2 === 0 ? 2 : -2)}, 0)` : undefined}
              >
                {isHighlighted && (
                  <polygon
                    points={hexCorners(x, y, HEX_R + 4)}
                    fill={glow}
                    opacity={0.25}
                    filter="url(#hexGlowStrong)"
                  />
                )}
                <polygon
                  points={hexCorners(x, y, r)}
                  fill={`url(#hexGrad${colorIdx})`}
                  stroke={isHighlighted ? glow : '#030912'}
                  strokeWidth={isHighlighted ? 2.5 : 1}
                  filter={isHighlighted ? 'url(#hexGlow)' : undefined}
                  opacity={1}
                />
                <polygon
                  points={hexCorners(x, y, r - 5)}
                  fill="none"
                  stroke="white"
                  strokeWidth={0.5}
                  opacity={0.18}
                />
                <ellipse
                  cx={x - HEX_R * 0.22}
                  cy={y - HEX_R * 0.3}
                  rx={HEX_R * 0.28}
                  ry={HEX_R * 0.18}
                  fill="white"
                  opacity={0.22}
                />
              </g>
            )
          })
        )}

        {popEffects.map(e => (
          <text
            key={e.id}
            x={e.x}
            y={e.y - 10}
            textAnchor="middle"
            fontSize={18}
            fontWeight={700}
            fontFamily="Orbitron, sans-serif"
            fill={e.pts === 100 ? '#ffd700' : e.pts === 50 ? '#00ff88' : ACCENT}
            filter="url(#hexGlowStrong)"
            style={{ pointerEvents: 'none', animation: 'none' }}
          >
            +{e.pts}
          </text>
        ))}
      </svg>

      <div style={{ marginTop: 4, color: '#3a5070', fontSize: 11, letterSpacing: 1 }}>
        TAP GROUPS OF 3+ SAME COLOR
      </div>
    </div>
    </PremiumStage>
  )
}

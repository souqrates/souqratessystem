import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { triggerHaptic } from '../../../lib/telegram'
import PremiumStage from './_premiumStage'
import { TimeBar } from './_shell'

const GRID_SIZE = 6
const CELL_SIZE = 52
const PADDING = 8
const DEFAULT_GAME_DURATION = 45
const PLAYER_COLOR = '#00d4ff'

function getMaxAtoms(row, col) {
  const isCornerRow = row === 0 || row === GRID_SIZE - 1
  const isCornerCol = col === 0 || col === GRID_SIZE - 1
  if (isCornerRow && isCornerCol) return 1
  if (isCornerRow || isCornerCol) return 2
  return 3
}

function getNeighbors(row, col) {
  const neighbors = []
  if (row > 0) neighbors.push([row - 1, col])
  if (row < GRID_SIZE - 1) neighbors.push([row + 1, col])
  if (col > 0) neighbors.push([row, col - 1])
  if (col < GRID_SIZE - 1) neighbors.push([row, col + 1])
  return neighbors
}

function HudCard({ label, value, accent }) {
  return (
    <div style={{
      background: 'rgba(0,212,255,0.07)',
      border: `1px solid ${accent || PLAYER_COLOR}44`,
      borderRadius: 10,
      padding: '6px 14px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minWidth: 64,
    }}>
      <span style={{ color: '#7eaacc', fontSize: 10, fontFamily: 'Orbitron, sans-serif', letterSpacing: 1 }}>{label}</span>
      <span style={{ color: accent || PLAYER_COLOR, fontSize: 20, fontFamily: 'Orbitron, sans-serif', fontWeight: 700 }}>{value}</span>
    </div>
  )
}

function initGrid() {
  return Array.from({ length: GRID_SIZE }, (_, r) =>
    Array.from({ length: GRID_SIZE }, (_, c) => ({ owner: null, atoms: 0 }))
  )
}

function applyExplosions(grid) {
  let changed = true
  let newGrid = grid.map(row => row.map(cell => ({ ...cell })))
  let iterations = 0
  while (changed && iterations < 200) {
    changed = false
    iterations++
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cell = newGrid[r][c]
        const maxAtoms = getMaxAtoms(r, c)
        if (cell.atoms > maxAtoms) {
          changed = true
          const excess = cell.atoms - maxAtoms
          newGrid[r][c] = { owner: cell.owner, atoms: cell.atoms - (maxAtoms + 1) }
          if (newGrid[r][c].atoms <= 0) newGrid[r][c] = { owner: null, atoms: 0 }
          const neighbors = getNeighbors(r, c)
          neighbors.forEach(([nr, nc]) => {
            newGrid[nr][nc] = {
              owner: cell.owner,
              atoms: newGrid[nr][nc].atoms + 1,
            }
          })
        }
      }
    }
  }
  return newGrid
}

export default function ChainReaction({ phase, setPhase, onScoreUpdate, game}) {
  const GAME_DURATION = game?.durationSeconds || DEFAULT_GAME_DURATION;
  const [grid, setGrid] = useState(initGrid)
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [particles, setParticles] = useState([])
  const [exploding, setExploding] = useState({})
  const timerRef = useRef(null)
  const particleIdRef = useRef(0)

  const computeScore = useCallback((g) => {
    let owned = 0
    for (let r = 0; r < GRID_SIZE; r++)
      for (let c = 0; c < GRID_SIZE; c++)
        if (g[r][c].owner === 'player') owned++
    return owned * 10
  }, [])

  useEffect(() => {
    if (phase !== 'playing') return
    setGrid(initGrid())
    setScore(0)
    setTimeLeft(GAME_DURATION)
    setParticles([])
    setExploding({})
  }, [phase])

  useEffect(() => {
    if (phase !== 'playing') return
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current)
          setPhase('won')
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

  const spawnParticles = useCallback((r, c) => {
    const cx = PADDING + c * CELL_SIZE + CELL_SIZE / 2
    const cy = PADDING + r * CELL_SIZE + CELL_SIZE / 2
    const newParticles = Array.from({ length: 8 }, (_, i) => {
      const angle = (i / 8) * Math.PI * 2
      return {
        id: particleIdRef.current++,
        x: cx,
        y: cy,
        vx: Math.cos(angle) * (30 + Math.random() * 30),
        vy: Math.sin(angle) * (30 + Math.random() * 30),
        life: 1,
      }
    })
    setParticles(prev => [...prev, ...newParticles])
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)))
    }, 700)
  }, [])

  const handleCellTap = useCallback((r, c) => {
    if (phase !== 'playing') return
    setGrid(prev => {
      const cell = prev[r][c]
      if (cell.owner !== null && cell.owner !== 'player') return prev
      const newGrid = prev.map(row => row.map(cell => ({ ...cell })))
      newGrid[r][c] = {
        owner: 'player',
        atoms: newGrid[r][c].atoms + 1,
      }
      const exploded = applyExplosions(newGrid)
      const s = computeScore(exploded)
      setScore(s)
      onScoreUpdate(s)
      triggerHaptic('light')
      const maxA = getMaxAtoms(r, c)
      if (newGrid[r][c].atoms >= maxA) {
        spawnParticles(r, c)
        setExploding(ex => ({ ...ex, [`${r}-${c}`]: true }))
        setTimeout(() => setExploding(ex => { const n = { ...ex }; delete n[`${r}-${c}`]; return n }), 400)
      }
      return exploded
    })
  }, [phase, computeScore, onScoreUpdate, spawnParticles])

  if (phase === 'rules') {
    return (
      <div style={{ padding: 24, fontFamily: 'Orbitron, sans-serif', color: '#cde' }}>
        <p style={{ lineHeight: 1.7, fontSize: 14 }}>
          CHAIN REACTION — Place atoms on the grid! Tap cells to add your atoms. When cells overflow they explode, converting neighbors to YOUR color. Chain explosions score big! Score = owned cells × 10. 45 seconds of explosive strategy!
        </p>
      </div>
    )
  }

  const gridW = GRID_SIZE * CELL_SIZE + PADDING * 2
  const gridH = GRID_SIZE * CELL_SIZE + PADDING * 2

  return (
    <PremiumStage accent="#00d4ff" accent2="#3b82f6">
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minHeight: '100%',
      paddingBottom: 24,
      fontFamily: 'Orbitron, sans-serif',
    }}>
      <div style={{ display: 'flex', gap: 12, margin: '16px 0 12px' }}>
        <HudCard label="SCORE" value={score} />
        <HudCard label="TIME" value={timeLeft} accent={timeLeft <= 10 ? '#ff4466' : PLAYER_COLOR} />
      </div>

      <TimeBar totalTime={GAME_DURATION} timeLeft={timeLeft} />

      <div style={{ position: 'relative', width: gridW, height: gridH }}>
        <svg width={gridW} height={gridH} style={{ position: 'absolute', top: 0, left: 0 }}>
          <defs>
            <radialGradient id="cellGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={PLAYER_COLOR} stopOpacity="0.3" />
              <stop offset="100%" stopColor={PLAYER_COLOR} stopOpacity="0" />
            </radialGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {Array.from({ length: GRID_SIZE }, (_, r) =>
            Array.from({ length: GRID_SIZE }, (_, c) => {
              const cell = grid[r][c]
              const x = PADDING + c * CELL_SIZE
              const y = PADDING + r * CELL_SIZE
              const cx = x + CELL_SIZE / 2
              const cy = y + CELL_SIZE / 2
              const isPlayer = cell.owner === 'player'
              const isEnemy = cell.owner === 'enemy'
              const isExploding = exploding[`${r}-${c}`]
              const maxA = getMaxAtoms(r, c)
              const fillColor = isPlayer ? PLAYER_COLOR : isEnemy ? '#ff4466' : '#0a1628'
              const borderColor = isPlayer ? PLAYER_COLOR : isEnemy ? '#ff4466' : '#1a3050'

              return (
                <g key={`${r}-${c}`} onClick={() => handleCellTap(r, c)} style={{ cursor: 'pointer' }}>
                  <rect
                    x={x + 2} y={y + 2}
                    width={CELL_SIZE - 4} height={CELL_SIZE - 4}
                    rx={8}
                    fill={isExploding ? '#ffffff22' : (isPlayer ? '#00d4ff11' : isEnemy ? '#ff446611' : '#0a162888')}
                    stroke={borderColor}
                    strokeWidth={isExploding ? 2 : 1}
                    filter={isExploding ? 'url(#glow)' : undefined}
                  />
                  {cell.atoms > 0 && Array.from({ length: Math.min(cell.atoms, maxA + 1) }, (_, i) => {
                    const angle = (i / (maxA + 1)) * Math.PI * 2 - Math.PI / 2
                    const radius = cell.atoms === 1 ? 0 : 12
                    const ax = cx + (cell.atoms === 1 ? 0 : Math.cos(angle) * radius)
                    const ay = cy + (cell.atoms === 1 ? 0 : Math.sin(angle) * radius)
                    return (
                      <g key={i} filter="url(#glow)">
                        <circle cx={ax} cy={ay} r={7} fill={fillColor} opacity={0.9} />
                        <circle cx={ax - 2} cy={ay - 2} r={2.5} fill="white" opacity={0.6} />
                        {isPlayer && (
                          <circle cx={ax} cy={ay} r={10} fill="none" stroke={PLAYER_COLOR} strokeWidth={0.5} opacity={0.4} />
                        )}
                      </g>
                    )
                  })}
                  <text
                    x={x + CELL_SIZE - 8} y={y + 14}
                    fontSize={9} fill="#3a5070" textAnchor="middle"
                    fontFamily="Orbitron, sans-serif"
                  >{maxA}</text>
                </g>
              )
            })
          )}
          {particles.map(p => (
            <circle
              key={p.id}
              cx={p.x} cy={p.y}
              r={3}
              fill={PLAYER_COLOR}
              opacity={0.8}
              filter="url(#glow)"
            />
          ))}
        </svg>
      </div>

      <div style={{ marginTop: 16, color: '#3a5070', fontSize: 11, letterSpacing: 1 }}>
        TAP CELLS TO PLACE ATOMS
      </div>
    </div>
    </PremiumStage>
  )
}

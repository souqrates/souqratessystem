/**
 * Deterministic Lucide icon resolver for game catalog entries.
 * Maps game.id → a consistent Lucide icon component — no emoji in UI.
 *
 * Usage:
 *   import { GameIcon } from '../lib/game-icons';
 *   <GameIcon id={game.id} size={32} color={game.accent} />
 */
import {
  Zap, Target, Star, Cpu, Flame, Shield, Crosshair, Rocket,
  Triangle, Layers, Award, Activity, Anchor, Circle,
  Hexagon, Maximize2, Move, Octagon, Radio, RefreshCw,
  Shuffle, Terminal, Wifi, Wind, Clock, Globe, Waves,
  LayoutGrid,
} from 'lucide-react';

const POOL = [
  Zap, Target, Star, Cpu, Flame, Shield, Crosshair, Rocket,
  Triangle, Layers, Award, Activity, Anchor, Circle,
  Hexagon, Maximize2, Move, Octagon, Radio, RefreshCw,
  Shuffle, Terminal, Wifi, Wind, Clock, Globe, Waves,
  LayoutGrid,
];

/**
 * Returns a deterministic Lucide icon element for the given game ID.
 * The same ID always maps to the same icon (id % pool size).
 */
export function GameIcon({ id, size = 24, color = 'currentColor', strokeWidth = 1.8 }) {
  const Icon = POOL[Math.abs(Number(id) || 0) % POOL.length];
  return <Icon size={size} color={color} strokeWidth={strokeWidth} />;
}

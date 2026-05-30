import {
  Crown, Gem, Star, Swords, Sparkles, Waves, Snowflake, Flame, Moon, Zap,
  Shield, Leaf, Eye, Target, Layers, Lock, Pickaxe, RotateCcw, Hexagon,
  LayoutGrid, Coins, CloudLightning, Scissors, Scan, Map, TrendingUp,
  Cpu, EyeOff, Clock, Mountain, type LucideIcon,
} from 'lucide-react';
import type { GameDef } from '../lib/games-data';

const ICON_MAP: Record<string, LucideIcon> = {
  Crown, Gem, Star, Swords, Sparkles, Waves, Snowflake, Flame, Moon, Zap,
  Shield, Leaf, Eye, Target, Layers, Lock, Pickaxe, RotateCcw, Hexagon,
  LayoutGrid, Coins, CloudLightning, Scissors, Scan, Map, TrendingUp,
  Cpu, EyeOff, Clock, Mountain,
};

interface Props {
  game: GameDef;
  size?: number;
  style?: React.CSSProperties;
}

export default function GameIcon({ game, size = 22, style }: Props) {
  const Icon = ICON_MAP[game.iconKey] ?? Crown;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size + 6, height: size + 6,
      ...style,
    }}>
      <Icon size={size} color={game.accent} strokeWidth={1.8} />
    </span>
  );
}

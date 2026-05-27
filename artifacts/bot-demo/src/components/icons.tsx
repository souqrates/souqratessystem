import {
  Gamepad2, Film, Mic2, Bot, ShoppingBag, Trophy,
  DollarSign, Star, Gem, Download, Upload, Users,
  Calendar, Crown, Shield, Compass, LineChart,
  Sparkles, Zap, Flame, Rocket, Target, Ghost,
  BookOpen,
  type LucideProps,
} from "lucide-react";
import type { ComponentType } from "react";

// ── Icon key → Lucide component map ───────────────────────
const ICON_MAP: Record<string, ComponentType<LucideProps>> = {
  gamepad:  Gamepad2,
  film:     Film,
  mic:      Mic2,
  bot:      Bot,
  store:    ShoppingBag,
  book:     BookOpen,
  trophy:   Trophy,
  dollar:   DollarSign,
  star:     Star,
  gem:      Gem,
  download: Download,
  upload:   Upload,
  users:    Users,
  calendar: Calendar,
  crown:    Crown,
  shield:   Shield,
  compass:  Compass,
  chart:    LineChart,
  sparkles: Sparkles,
  zap:      Zap,
  flame:    Flame,
  rocket:   Rocket,
  target:   Target,
  ghost:    Ghost,
};

interface IconBoxProps {
  iconKey: string;
  size?: number;
  color?: string;
  bg?: string;
  border?: string;
  glow?: string;
  className?: string;
  boxSize?: number;
  radius?: number;
}

/** Renders a gradient-bg icon box with a Lucide icon inside — replaces all emoji */
export function IconBox({
  iconKey,
  size = 20,
  color = "white",
  bg = "rgba(168,85,247,0.18)",
  border = "rgba(168,85,247,0.25)",
  glow,
  className = "",
  boxSize = 40,
  radius = 12,
}: IconBoxProps) {
  const Icon = ICON_MAP[iconKey] ?? Zap;
  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 ${className}`}
      style={{
        width: boxSize,
        height: boxSize,
        borderRadius: radius,
        background: bg,
        border: `1px solid ${border}`,
        boxShadow: glow ? `0 4px 16px ${glow}` : undefined,
      }}
    >
      <Icon size={size} style={{ color }} strokeWidth={2} />
    </div>
  );
}

// ── Pre-configured bot icon boxes (canonical SOUQRATES taxonomy) ──────────
export const BOT_ICONS: Record<string, { iconKey: string; color: string; glow: string; bg: string }> = {
  Skillz: { iconKey: "gamepad", color: "#a855f7", glow: "rgba(168,85,247,0.3)", bg: "linear-gradient(135deg,rgba(168,85,247,0.2),rgba(168,85,247,0.08))" },
  Souq:   { iconKey: "book",    color: "#c9a24b", glow: "rgba(201,162,75,0.3)", bg: "linear-gradient(135deg,rgba(201,162,75,0.2),rgba(184,137,58,0.08))"  },
  Scene:  { iconKey: "film",    color: "#60a5fa", glow: "rgba(96,165,250,0.3)", bg: "linear-gradient(135deg,rgba(59,130,246,0.2),rgba(59,130,246,0.08))"  },
  Stream: { iconKey: "mic",     color: "#22d3ee", glow: "rgba(34,211,238,0.3)", bg: "linear-gradient(135deg,rgba(6,182,212,0.2),rgba(6,182,212,0.08))"   },
  SubAgents: { iconKey: "crown", color: "#D4AF37", glow: "rgba(212,175,55,0.35)", bg: "linear-gradient(135deg,rgba(212,175,55,0.22),rgba(184,148,31,0.08))" },
  Stage:  { iconKey: "trophy",  color: "#f59e0b", glow: "rgba(245,158,11,0.3)", bg: "linear-gradient(135deg,rgba(245,158,11,0.2),rgba(245,158,11,0.08))" },
};

export const ACTION_ICONS: Record<string, { iconKey: string; color: string }> = {
  deposit:       { iconKey: "download", color: "#a855f7" },
  withdraw:      { iconKey: "upload",   color: "#f87171" },
  referral:      { iconKey: "users",    color: "#c084fc" },
  games_win:     { iconKey: "gamepad",  color: "#a855f7" },
  games_play:    { iconKey: "gamepad",  color: "#a855f7" },
  video_watch:   { iconKey: "film",     color: "#60a5fa" },
  store_buy:     { iconKey: "store",    color: "#10b981" },
  voice_join:    { iconKey: "mic",      color: "#22d3ee" },
  ai_use:        { iconKey: "bot",      color: "#8b5cf6" },
  contest_entry: { iconKey: "trophy",   color: "#f59e0b" },
  contest_win:   { iconKey: "crown",    color: "#f59e0b" },
  daily_login:   { iconKey: "calendar", color: "#34d399" },
};

export const ACHIEVEMENT_ICONS: Record<string, { iconKey: string; color: string; bg: string }> = {
  a1: { iconKey: "download", color: "#a855f7", bg: "linear-gradient(135deg,rgba(168,85,247,0.25),rgba(34,211,238,0.12))" },
  a2: { iconKey: "target",   color: "#f59e0b", bg: "linear-gradient(135deg,rgba(245,158,11,0.25),rgba(234,179,8,0.1))" },
  a3: { iconKey: "users",    color: "#22d3ee", bg: "linear-gradient(135deg,rgba(34,211,238,0.25),rgba(6,182,212,0.1))" },
  a4: { iconKey: "gem",      color: "#60a5fa", bg: "linear-gradient(135deg,rgba(96,165,250,0.25),rgba(59,130,246,0.1))" },
  a5: { iconKey: "flame",    color: "#ef4444", bg: "linear-gradient(135deg,rgba(239,68,68,0.25),rgba(220,38,38,0.1))" },
  a6: { iconKey: "crown",    color: "#f59e0b", bg: "linear-gradient(135deg,rgba(245,158,11,0.25),rgba(234,179,8,0.1))" },
};

export const RANK_ICONS: Record<string, { iconKey: string }> = {
  Ghost:   { iconKey: "ghost"    },
  Scout:   { iconKey: "compass"  },
  Trader:  { iconKey: "chart"    },
  Shark:   { iconKey: "zap"      },
  Veteran: { iconKey: "shield"   },
  Elite:   { iconKey: "gem"      },
  Legend:  { iconKey: "crown"    },
  Mythic:  { iconKey: "sparkles" },
};

export const CURRENCY_ICONS: Record<string, { iconKey: string; color: string; bg: string; glow: string }> = {
  USDT:  { iconKey: "dollar", color: "#26d0a0", bg: "linear-gradient(135deg,rgba(38,208,160,0.25),rgba(16,185,129,0.1))",  glow: "rgba(38,208,160,0.3)"  },
  Stars: { iconKey: "star",   color: "#f59e0b", bg: "linear-gradient(135deg,rgba(245,158,11,0.25),rgba(234,179,8,0.1))",   glow: "rgba(245,158,11,0.3)"  },
  TON:   { iconKey: "gem",    color: "#0098ea", bg: "linear-gradient(135deg,rgba(0,152,234,0.25),rgba(2,132,199,0.1))",     glow: "rgba(0,152,234,0.3)"   },
};

export const TX_ICONS: Record<string, { iconKey: string; color: string }> = {
  Skillz:   { iconKey: "gamepad",  color: "#a855f7" },
  Souq:     { iconKey: "book",     color: "#c9a24b" },
  Scene:    { iconKey: "film",     color: "#60a5fa" },
  Stream:   { iconKey: "mic",      color: "#22d3ee" },
  SubAgents: { iconKey: "crown",   color: "#D4AF37" },
  Stage:    { iconKey: "trophy",   color: "#f59e0b" },
  Withdraw: { iconKey: "upload",   color: "#f87171" },
  Deposit:  { iconKey: "download", color: "#a855f7" },
};

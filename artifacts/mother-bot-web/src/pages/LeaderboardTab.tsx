import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLeaderboard, type LeaderboardScope } from "@/lib/api";
import { fmtInt, fmtSkz } from "@/lib/format";
import Avatar from "@/components/Avatar";
import { haptic } from "@/lib/telegram";

const SCOPES: { id: LeaderboardScope; label: string; icon: string; unit: string; fmt: (v: string) => string }[] = [
  { id: "xp",    label: "الخبرة",    icon: "✨", unit: "XP",  fmt: (v) => fmtInt(Number(v)) },
  { id: "spend", label: "الإنفاق",   icon: "💰", unit: "SKZ", fmt: (v) => fmtSkz(v) },
  { id: "votes", label: "التصويت",   icon: "🗳️", unit: "صوت", fmt: (v) => fmtInt(Number(v)) },
  { id: "games", label: "الألعاب",   icon: "🎮", unit: "لعبة", fmt: (v) => fmtInt(Number(v)) },
];

function medalFor(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return "";
}

export default function LeaderboardTab() {
  const [scope, setScope] = useState<LeaderboardScope>("xp");
  const meta = SCOPES.find((s) => s.id === scope)!;
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", scope],
    queryFn: () => getLeaderboard(scope, 50),
  });

  return (
    <div className="space-y-4">
      {/* Scope tabs */}
      <div className="panel p-2 grid grid-cols-4 gap-1">
        {SCOPES.map((s) => {
          const active = s.id === scope;
          return (
            <button
              key={s.id}
              onClick={() => {
                haptic("tap");
                setScope(s.id);
              }}
              className={`py-2.5 rounded-xl font-bold text-xs transition-all ${
                active
                  ? "bg-gold text-black shadow-lg"
                  : "text-mute hover:text-fg"
              }`}
            >
              <div className="text-base mb-0.5">{s.icon}</div>
              {s.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-16" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="panel p-6 text-center text-mute">
          <div className="text-3xl mb-2">🏜️</div>
          <div>لا توجد بيانات بعد في هذا التصنيف</div>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((entry, idx) => {
            const rank = idx + 1;
            const isTop3 = rank <= 3;
            const name = entry.displayName || entry.firstName;
            return (
              <div
                key={entry.telegramId}
                className={`panel p-3 flex items-center gap-3 ${
                  isTop3 ? "border-gold/40 panel-gold" : ""
                }`}
              >
                <div className="w-9 text-center">
                  <div className={`text-lg font-black ${isTop3 ? "text-gold" : "text-mute"}`}>
                    {medalFor(rank) || `#${rank}`}
                  </div>
                </div>
                <Avatar src={entry.avatarUrl} name={name} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{name}</div>
                  <div className="text-[11px] text-mute flex items-center gap-2">
                    <span className="chip !py-0 !px-1.5 !text-[10px]">
                      Lv {entry.level}
                    </span>
                    {entry.username && <span className="truncate">@{entry.username}</span>}
                  </div>
                </div>
                <div className="text-end">
                  <div className="text-lg font-black text-glow-gold">{meta.fmt(entry.metric)}</div>
                  <div className="text-[10px] text-mute">{meta.unit}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

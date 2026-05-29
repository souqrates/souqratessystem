import { useState, useEffect, useCallback } from "react";
import { GAMES, GameConfig } from "../lib/games";
import { TicketResult } from "../lib/provablyFair";
import FairVerifier from "../components/FairVerifier";
import { getMyTickets, ApiError, type SweepTicketRow } from "../lib/api";

interface Props {
  initData: string;
  onSelectGame: (game: GameConfig) => void;
}

interface HistoryTicket {
  id: number;
  game: GameConfig;
  result: TicketResult;
  timestamp: string;
}

const FALLBACK_GAME: GameConfig = {
  id: "unknown",
  emoji: "🎰",
  nameAr: "لعبة",
  theme: "—",
  mechanic: "—",
  price: 0,
  maxPrize: 0,
  gradientFrom: "#1e1b4b",
  gradientTo: "#3730a3",
  accentColor: "#8b5cf6",
  gridSize: 6,
  symbols: ["🎰"],
};

function mapRow(row: SweepTicketRow): HistoryTicket {
  const game = GAMES.find((g) => g.id === row.gameSlug) ?? {
    ...FALLBACK_GAME,
    id: row.gameSlug ?? "unknown",
    emoji: row.gameEmoji ?? "🎰",
    nameAr: row.gameNameAr ?? row.gameName ?? "لعبة",
  };

  const resultJson = row.ticket.result ?? {};
  const outcome: string[] = Array.isArray(resultJson.outcome)
    ? (resultJson.outcome as string[])
    : [];

  const ticketResult: TicketResult = {
    serverSeedHash: row.ticket.serverSeedHash,
    serverSeed: row.ticket.serverSeed,
    clientSeed: row.ticket.clientSeed,
    nonce: 0,
    outcome,
    isWinner: row.ticket.isWin,
    prize: parseFloat(row.ticket.prizeSkz),
  };

  return {
    id: row.ticket.id,
    game,
    result: ticketResult,
    timestamp: new Date(row.ticket.createdAt).toLocaleString("ar-EG"),
  };
}

export default function MyTickets({ initData, onSelectGame }: Props) {
  const [filter, setFilter] = useState<string>("all");
  const [tickets, setTickets] = useState<HistoryTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fairTicket, setFairTicket] = useState<{ result: TicketResult; game: GameConfig } | null>(null);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await getMyTickets(initData, 30);
      setTickets(resp.data.map(mapRow));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطأ في تحميل التذاكر");
    } finally {
      setLoading(false);
    }
  }, [initData]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const filtered = filter === "all" ? tickets : tickets.filter((t) => t.game.id === filter);
  const wins = tickets.filter((t) => t.result.isWinner).length;
  const totalPrize = tickets.filter((t) => t.result.isWinner).reduce((s, t) => s + t.result.prize, 0);

  const uniqueGameIds = Array.from(new Set(tickets.map((t) => t.game.id)));

  return (
    <div className="px-4 pt-6 fade-up">
      {/* Header */}
      <div className="mb-5">
        <div className="section-label mb-1">SOUQRATES SWEEP</div>
        <h2 className="font-orbitron font-black text-xl text-white">🎫 تذاكري</h2>
        <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>سجل ألعابك والجوائز</p>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center py-16 gap-3">
          <div className="text-4xl trophy-float">🎫</div>
          <div className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>جاري تحميل تذاكرك…</div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-2xl px-4 py-3 mb-4 text-center"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }}>
          <div className="font-bold text-sm mb-1">⚠️ {error}</div>
          <button onClick={loadTickets} className="text-xs underline" style={{ color: "#ef4444" }}>
            أعد المحاولة
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            <StatCard label="إجمالي التذاكر" value={String(tickets.length)} color="#8b5cf6" />
            <StatCard label="الفائزة" value={String(wins)} color="#10b981" />
            <StatCard label="مجموع الجوائز" value={`${totalPrize.toLocaleString()}`} color="#f59e0b" unit="SKZ" />
          </div>

          {/* Filter chips */}
          {tickets.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4" style={{ scrollbarWidth: "none" }}>
              <FilterChip id="all" label="الكل" active={filter === "all"} onClick={() => setFilter("all")} />
              {uniqueGameIds.map((id) => {
                const g = GAMES.find((g) => g.id === id);
                return (
                  <FilterChip key={id} id={id}
                    label={g ? `${g.emoji} ${g.nameAr}` : id}
                    active={filter === id}
                    onClick={() => setFilter(id)} />
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {filtered.length === 0 && tickets.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-3">🎫</div>
              <div className="font-bold text-sm text-white mb-1">لا توجد تذاكر بعد</div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>العب لعبة لتظهر هنا</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">🔍</div>
              <div className="text-sm text-white">لا توجد تذاكر بهذا الفلتر</div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map((t) => (
                <TicketRow
                  key={t.id}
                  ticket={t}
                  onPlayAgain={() => onSelectGame(t.game)}
                  onVerify={() => setFairTicket({ result: t.result, game: t.game })}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Fair verifier modal */}
      {fairTicket && (
        <FairVerifier
          ticket={fairTicket.result}
          symbols={fairTicket.game.symbols}
          gridSize={fairTicket.game.gridSize}
          onClose={() => setFairTicket(null)}
        />
      )}
    </div>
  );
}

function StatCard({
  label, value, color, unit,
}: {
  label: string; value: string; color: string; unit?: string;
}) {
  return (
    <div className="rounded-2xl p-3 text-center"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="font-orbitron font-black text-base mb-0.5 leading-tight" style={{ color }}>
        {value}
      </div>
      {unit && <div className="text-xs font-bold" style={{ color, opacity: 0.6, fontSize: 9 }}>{unit}</div>}
      <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>{label}</div>
    </div>
  );
}

function FilterChip({
  id: _id, label, active, onClick,
}: {
  id: string; label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-bold transition-all"
      style={{
        background: active ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.05)",
        border: active ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(255,255,255,0.08)",
        color: active ? "#f59e0b" : "rgba(255,255,255,0.5)",
        cursor: "pointer",
        whiteSpace: "nowrap",
        fontSize: 11,
      }}
    >
      {label}
    </button>
  );
}

function TicketRow({
  ticket,
  onPlayAgain,
  onVerify,
}: {
  ticket: HistoryTicket;
  onPlayAgain: () => void;
  onVerify: () => void;
}) {
  const { game, result, timestamp } = ticket;
  return (
    <div className="ticket-card p-4">
      {/* Top row */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl"
          style={{ background: `linear-gradient(135deg, ${game.gradientFrom}, ${game.gradientTo})` }}>
          {game.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm text-white">{game.nameAr}</div>
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{timestamp}</div>
        </div>
        {result.isWinner ? (
          <div className="px-2 py-1 rounded-lg text-xs font-bold flex-shrink-0"
            style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}>
            ✅ فائز
          </div>
        ) : (
          <div className="px-2 py-1 rounded-lg text-xs font-bold flex-shrink-0"
            style={{ background: "rgba(239,68,68,0.08)", color: "rgba(239,68,68,0.7)", border: "1px solid rgba(239,68,68,0.2)" }}>
            ❌ خسارة
          </div>
        )}
      </div>

      {/* Symbols */}
      {result.outcome.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {result.outcome.slice(0, 6).map((sym, i) => (
            <span key={i} className="text-lg w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {sym}
            </span>
          ))}
          {result.outcome.length > 6 && (
            <span className="text-xs px-2 py-1 rounded-lg"
              style={{ color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.03)" }}>
              +{result.outcome.length - 6}
            </span>
          )}
        </div>
      )}

      {/* Prize */}
      {result.isWinner && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl"
          style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)" }}>
          <span className="text-sm">🏆</span>
          <span className="font-orbitron font-black text-sm" style={{ color: "#f59e0b" }}>
            +{result.prize.toLocaleString()} SKZ
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={onVerify} className="flex-1 btn-ghost py-2 text-xs font-bold">
          🔐 تحقق
        </button>
        <button onClick={onPlayAgain} className="flex-1 btn-purple py-2 text-xs font-bold">
          🎰 العب مجدداً
        </button>
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";

interface PastDraw {
  id: number;
  drawNumber: number;
  winningNumbers: number[] | null;
  jackpotAmountSkz: number;
  totalEntries: number;
  totalPaidOutSkz: number;
  drawnAt: string | null;
  serverSeedHash: string;
  serverSeed: string | null;
  winnerCount: number;
}

interface MyEntry {
  numbers: number[];
  drawNumber: number;
}

const NUM_COLORS = [
  "#f59e0b", "#8b5cf6", "#10b981", "#3b82f6", "#ec4899",
  "#f97316", "#06b6d4", "#84cc16", "#a855f7", "#14b8a6",
];

function ballColor(n: number) {
  return NUM_COLORS[n % NUM_COLORS.length];
}

function Ball({ n, highlight }: { n: number; highlight?: boolean }) {
  return (
    <span
      className="inline-flex items-center justify-center font-orbitron font-black text-xs rounded-full"
      style={{
        width: 28,
        height: 28,
        background: highlight
          ? `radial-gradient(circle at 35% 35%, ${ballColor(n)}dd, ${ballColor(n)}66)`
          : "rgba(255,255,255,0.07)",
        border: highlight
          ? `1.5px solid ${ballColor(n)}`
          : "1.5px solid rgba(255,255,255,0.12)",
        color: highlight ? "#fff" : "rgba(255,255,255,0.45)",
        boxShadow: highlight ? `0 0 8px ${ballColor(n)}66` : "none",
        flexShrink: 0,
        fontSize: 11,
      }}
    >
      {n}
    </span>
  );
}

function MatchBadge({ count }: { count: number }) {
  if (count === 6) return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
      style={{ background: "rgba(245,158,11,0.2)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.4)" }}>
      🏆 جاكبوت!
    </span>
  );
  if (count >= 4) return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
      style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}>
      ✅ {count}/6 أرقام
    </span>
  );
  if (count >= 2) return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
      style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.3)" }}>
      🎯 {count}/6 أرقام
    </span>
  );
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
      style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}>
      {count}/6 أرقام
    </span>
  );
}

function DrawCard({ draw, myEntries }: { draw: PastDraw; myEntries: MyEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const winning = (draw.winningNumbers ?? []).map(Number);
  const winningSet = new Set(winning);

  const myEntriesForDraw = myEntries.filter((e) => e.drawNumber === draw.drawNumber);
  const bestMatch = myEntriesForDraw.reduce((best, e) => {
    const m = e.numbers.filter((n) => winningSet.has(n)).length;
    return m > best ? m : best;
  }, -1);

  const hasMyEntries = myEntriesForDraw.length > 0;

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
      {/* Header row */}
      <button
        className="w-full text-right"
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 p-4">
          {/* Draw number badge */}
          <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-orbitron font-black text-sm"
            style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)", color: "#f59e0b" }}>
            #{draw.drawNumber}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-white">سحب رقم {draw.drawNumber}</span>
              {hasMyEntries && bestMatch >= 0 && (
                <MatchBadge count={bestMatch} />
              )}
            </div>
            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
              {draw.drawnAt
                ? new Date(draw.drawnAt).toLocaleDateString("ar-EG", {
                    year: "numeric", month: "long", day: "numeric",
                  })
                : "—"}
              {" · "}
              {draw.totalEntries.toLocaleString()} مشترك
            </div>
          </div>

          {/* Winning balls preview */}
          <div className="flex gap-1 flex-shrink-0">
            {winning.slice(0, 3).map((n) => (
              <Ball key={n} n={n} highlight />
            ))}
            {winning.length > 3 && (
              <span className="text-xs self-center" style={{ color: "rgba(255,255,255,0.3)" }}>
                +{winning.length - 3}
              </span>
            )}
          </div>

          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 14, flexShrink: 0 }}>
            {expanded ? "▲" : "▼"}
          </span>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          {/* All 6 winning numbers */}
          <div className="mt-3 mb-3">
            <div className="text-xs font-bold mb-2" style={{ color: "rgba(255,255,255,0.45)" }}>الأرقام الفائزة</div>
            <div className="flex gap-2 flex-wrap">
              {winning.length > 0
                ? winning.sort((a, b) => a - b).map((n) => <Ball key={n} n={n} highlight />)
                : <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>لم تُحدَّد</span>}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <MiniStat label="الجاكبوت" value={draw.jackpotAmountSkz.toLocaleString()} unit="SKZ" color="#f59e0b" />
            <MiniStat label="المدفوع" value={draw.totalPaidOutSkz.toLocaleString()} unit="SKZ" color="#10b981" />
            <MiniStat label="الفائزون" value={String(draw.winnerCount)} color="#8b5cf6" />
          </div>

          {/* My tickets comparison */}
          {hasMyEntries && (
            <div className="mt-3">
              <div className="text-xs font-bold mb-2" style={{ color: "rgba(255,255,255,0.45)" }}>تذاكري في هذا السحب</div>
              <div className="flex flex-col gap-2">
                {myEntriesForDraw.map((entry, i) => {
                  const matchCount = entry.numbers.filter((n) => winningSet.has(n)).length;
                  return (
                    <div key={i} className="rounded-xl p-3"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>تذكرة {i + 1}</span>
                        <MatchBadge count={matchCount} />
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {entry.numbers.sort((a, b) => a - b).map((n) => (
                          <Ball key={n} n={n} highlight={winningSet.has(n)} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Provably Fair seed */}
          {draw.serverSeed && (
            <details className="mt-3">
              <summary className="text-xs cursor-pointer" style={{ color: "rgba(255,255,255,0.35)" }}>
                🔐 التحقق المنصف (Provably Fair)
              </summary>
              <div className="mt-2 rounded-xl p-3 text-xs break-all"
                style={{ background: "rgba(0,0,0,0.3)", color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>
                <div className="mb-1"><span style={{ color: "rgba(255,255,255,0.6)" }}>Hash:</span> {draw.serverSeedHash}</div>
                <div><span style={{ color: "rgba(255,255,255,0.6)" }}>Seed:</span> {draw.serverSeed}</div>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, unit, color }: { label: string; value: string; unit?: string; color: string }) {
  return (
    <div className="rounded-xl p-2.5 text-center"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="font-orbitron font-black text-sm leading-tight" style={{ color }}>{value}</div>
      {unit && <div className="text-xs" style={{ color, opacity: 0.55, fontSize: 9 }}>{unit}</div>}
      <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)", fontSize: 10 }}>{label}</div>
    </div>
  );
}

export default function DrawHistory() {
  const [draws, setDraws] = useState<PastDraw[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myEntries] = useState<MyEntry[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/sweep/draws/history?limit=30");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { data: PastDraw[] };
      setDraws(json.data ?? []);
    } catch (e) {
      setError("تعذّر تحميل سجل السحبات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="px-4 pt-6 pb-6 fade-up">
      {/* Header */}
      <div className="mb-5">
        <div className="section-label mb-1">SOUQRATES SWEEP</div>
        <h2 className="font-orbitron font-black text-xl text-white">📋 السحبات السابقة</h2>
        <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
          سجل شفاف لكل السحبات المنتهية والأرقام الفائزة
        </p>
      </div>

      {/* Provably Fair banner */}
      <div className="rounded-2xl px-4 py-3 mb-5 flex items-start gap-3"
        style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}>
        <span className="text-xl flex-shrink-0 mt-0.5">🔐</span>
        <div>
          <div className="font-bold text-sm" style={{ color: "#a78bfa" }}>Provably Fair</div>
          <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
            كل سحب قابل للتحقق — افتح أي سحب لرؤية الـ seed وإعادة التحقق من النتيجة بنفسك.
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center py-16 gap-3">
          <div className="text-4xl trophy-float">🎱</div>
          <div className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>جاري تحميل السجل…</div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="text-center py-10">
          <div className="text-4xl mb-3">⚠️</div>
          <div className="text-sm text-white mb-3">{error}</div>
          <button onClick={load} className="btn-ghost text-sm px-4 py-2">
            🔄 أعد المحاولة
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && draws.length === 0 && (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">📋</div>
          <div className="font-bold text-sm text-white mb-1">لا توجد سحبات منتهية بعد</div>
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>ستظهر هنا بعد أول سحب أسبوعي</div>
        </div>
      )}

      {/* Draw cards */}
      {!loading && !error && draws.length > 0 && (
        <div className="flex flex-col gap-3">
          {draws.map((draw) => (
            <DrawCard key={draw.id} draw={draw} myEntries={myEntries} />
          ))}
        </div>
      )}
    </div>
  );
}

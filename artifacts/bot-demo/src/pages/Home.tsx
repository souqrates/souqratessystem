import { useEffect, useRef, useState } from "react";
import { Page } from "../App";
import JackpotTrophy from "../components/JackpotTrophy";

interface Props {
  onNavigate: (p: Page) => void;
}

interface JackpotData {
  jackpotBalanceSkz: number;
  nextDrawAt: string | null;
  totalEntries: number;
  drawNumber: number | null;
}

const FALLBACK_JACKPOT = 0;
const POLL_INTERVAL_MS = 30_000;

// ── CountUp hook ─────────────────────────────────────────────────────────────
// Smoothly animates a number from its previous value to the new target.
function useCountUp(target: number, durationMs = 1200): number {
  const [displayed, setDisplayed] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;

    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(from + (target - from) * eased));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs]);

  return displayed;
}

// ── Jackpot API fetcher ───────────────────────────────────────────────────────
async function fetchJackpot(): Promise<JackpotData> {
  const res = await fetch("/api/sweep/jackpot");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<JackpotData>;
}

// ── Countdown hook ────────────────────────────────────────────────────────────
function getNextSaturday(): Date {
  const now = new Date();
  const sat = new Date(now);
  const dayOfWeek = now.getDay();
  const daysUntilSat = (6 - dayOfWeek + 7) % 7 || 7;
  sat.setDate(now.getDate() + daysUntilSat);
  sat.setHours(20, 0, 0, 0);
  return sat;
}

function useCountdown(target: Date) {
  const [diff, setDiff] = useState(() => target.getTime() - Date.now());
  useEffect(() => {
    const id = setInterval(() => setDiff(target.getTime() - Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  const d = Math.max(0, diff);
  const days = Math.floor(d / 86400000);
  const hours = Math.floor((d % 86400000) / 3600000);
  const mins = Math.floor((d % 3600000) / 60000);
  const secs = Math.floor((d % 60000) / 1000);
  return { days, hours, mins, secs };
}

function CountdownBox({ val, label }: { val: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="countdown-box font-orbitron text-2xl font-black" style={{ color: "#f59e0b" }}>
        {String(val).padStart(2, "0")}
      </div>
      <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>{label}</span>
    </div>
  );
}

export default function Home({ onNavigate }: Props) {
  const [jackpotData, setJackpotData] = useState<JackpotData | null>(null);
  const [fetchError, setFetchError] = useState(false);

  // Raw target from API (or fallback)
  const rawJackpot = jackpotData?.jackpotBalanceSkz ?? FALLBACK_JACKPOT;
  // Animated display value
  const jackpot = useCountUp(rawJackpot);

  // Draw target: prefer API value, fall back to next Saturday
  const drawTarget = jackpotData?.nextDrawAt
    ? new Date(jackpotData.nextDrawAt)
    : getNextSaturday();

  const { days, hours, mins, secs } = useCountdown(drawTarget);

  // Initial fetch + poll every 30 s
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchJackpot();
        if (!cancelled) {
          setJackpotData(data);
          setFetchError(false);
        }
      } catch {
        if (!cancelled) setFetchError(true);
      }
    }

    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="px-4 pt-6 fade-up">
      {/* Header brand */}
      <div className="text-center mb-6">
        <div className="section-label mb-1">SOUQRATES</div>
        <h1 className="font-orbitron font-black text-2xl gradient-text-gold tracking-wider">SWEEP</h1>
        <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>ألعاب الحك واللوتو الأسبوعي</p>
      </div>

      {/* Jackpot trophy card */}
      <div className="rounded-3xl p-5 mb-5 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(139,92,246,0.06) 100%)",
          border: "1px solid rgba(245,158,11,0.2)",
          boxShadow: "0 0 40px rgba(245,158,11,0.08), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}>
        {/* Background glow orb */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div style={{
            width: 200, height: 200,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)",
          }} />
        </div>

        {/* Trophy */}
        <div className="flex justify-center mb-4">
          <JackpotTrophy jackpot={jackpot} />
        </div>

        {/* Jackpot amount */}
        <div className="text-center mb-2">
          <div className="section-label mb-1">الجائزة الكبرى</div>
          <div className="font-orbitron font-black text-4xl jackpot-glow" style={{ color: "#f59e0b" }}>
            {jackpot.toLocaleString("ar-EG")}
          </div>
          <div className="text-sm font-bold" style={{ color: "rgba(245,158,11,0.7)" }}>SKZ</div>

          {/* Live participant count */}
          {jackpotData && jackpotData.totalEntries > 0 && (
            <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              {jackpotData.totalEntries.toLocaleString("ar-EG")} مشترك في السحب الحالي
            </div>
          )}

          {/* Soft error hint — keeps last known value visible */}
          {fetchError && (
            <div className="mt-1 text-xs" style={{ color: "rgba(245,158,11,0.4)" }}>
              ⚠️ تعذّر تحديث المبلغ
            </div>
          )}
        </div>

        {/* Countdown */}
        <div className="mt-4">
          <div className="section-label text-center mb-2">موعد السحب الأسبوعي</div>
          <div className="flex justify-center items-center gap-2">
            <CountdownBox val={days} label="يوم" />
            <span className="font-orbitron text-xl font-black" style={{ color: "rgba(245,158,11,0.5)", marginBottom: 14 }}>:</span>
            <CountdownBox val={hours} label="ساعة" />
            <span className="font-orbitron text-xl font-black" style={{ color: "rgba(245,158,11,0.5)", marginBottom: 14 }}>:</span>
            <CountdownBox val={mins} label="دقيقة" />
            <span className="font-orbitron text-xl font-black" style={{ color: "rgba(245,158,11,0.5)", marginBottom: 14 }}>:</span>
            <CountdownBox val={secs} label="ثانية" />
          </div>
        </div>

        {/* Subscribe button */}
        <button
          onClick={() => onNavigate("lotto")}
          className="btn-gold w-full py-3.5 mt-4 font-black text-base font-tajawal"
        >
          🎱 اشترك في السحب الأسبوعي
        </button>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <button
          onClick={() => onNavigate("games")}
          className="rounded-2xl p-4 text-right pressable"
          style={{
            background: "linear-gradient(135deg, rgba(139,92,246,0.12), rgba(76,29,149,0.08))",
            border: "1px solid rgba(139,92,246,0.2)",
          }}
        >
          <div className="text-3xl mb-2">🎰</div>
          <div className="font-bold text-sm text-white">العب الآن</div>
          <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>10 ألعاب حك</div>
        </button>
        <button
          onClick={() => onNavigate("tickets")}
          className="rounded-2xl p-4 text-right pressable"
          style={{
            background: "linear-gradient(135deg, rgba(245,158,11,0.10), rgba(180,83,9,0.06))",
            border: "1px solid rgba(245,158,11,0.15)",
          }}
        >
          <div className="text-3xl mb-2">🎫</div>
          <div className="font-bold text-sm text-white">تذاكري</div>
          <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>نتائجك السابقة</div>
        </button>
      </div>

      {/* Provably Fair banner */}
      <div className="rounded-2xl px-4 py-3 flex items-center gap-3 mb-4"
        style={{
          background: "rgba(16,185,129,0.06)",
          border: "1px solid rgba(16,185,129,0.15)",
        }}>
        <span className="text-2xl">🔐</span>
        <div>
          <div className="font-bold text-sm" style={{ color: "#10b981" }}>Provably Fair</div>
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>كل ورقة قابلة للتحقق — نتائج شفافة 100%</div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Page } from "../App";
import JackpotTrophy from "../components/JackpotTrophy";

interface Props {
  onNavigate: (p: Page) => void;
}

const JACKPOT_BASE = 128450;
const DRAW_DAY = 6; // Saturday

function getNextDraw(): Date {
  const now = new Date();
  const next = new Date(now);
  const dayOfWeek = now.getDay();
  const daysUntilSat = (DRAW_DAY - dayOfWeek + 7) % 7 || 7;
  next.setDate(now.getDate() + daysUntilSat);
  next.setHours(20, 0, 0, 0);
  return next;
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
  const [jackpot, setJackpot] = useState(JACKPOT_BASE);
  const target = getNextDraw();
  const { days, hours, mins, secs } = useCountdown(target);

  // Simulate jackpot growing
  useEffect(() => {
    const id = setInterval(() => {
      setJackpot((j) => j + Math.floor(Math.random() * 3));
    }, 4000);
    return () => clearInterval(id);
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

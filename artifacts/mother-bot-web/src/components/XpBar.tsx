import { fmtInt, pct } from "@/lib/format";

type Props = {
  xp: number;
  currentMinXp: number;
  nextMinXp: number | null;
  level: number;
  title: string;
  color: string;
  icon: string;
};

export default function XpBar({ xp, currentMinXp, nextMinXp, level, title, color, icon }: Props) {
  const range = nextMinXp ? nextMinXp - currentMinXp : 0;
  const got = xp - currentMinXp;
  const percent = range > 0 ? (got / range) * 100 : 100;

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl grid place-items-center text-2xl font-black"
            style={{
              background: `linear-gradient(135deg, ${color}, ${color}88)`,
              boxShadow: `0 8px 24px -8px ${color}aa`,
              color: "#0a0a0f",
            }}
          >
            {icon}
          </div>
          <div>
            <div className="text-xs text-mute">المستوى {fmtInt(level)} من 100</div>
            <div className="text-lg font-extrabold" style={{ color }}>
              {title}
            </div>
          </div>
        </div>
        <div className="text-end">
          <div className="text-2xl font-black text-glow-gold">{fmtInt(xp)}</div>
          <div className="text-[10px] text-mute">نقطة خبرة</div>
        </div>
      </div>

      {nextMinXp !== null ? (
        <>
          <div className="h-3 bg-panel-2 rounded-full overflow-hidden border border-line">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.max(2, Math.min(100, percent))}%`,
                background: `linear-gradient(90deg, ${color}, #f5c116)`,
                boxShadow: `0 0 12px ${color}66`,
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-mute">
            <span>{pct(percent)} للمستوى التالي</span>
            <span>
              {fmtInt(got)} / {fmtInt(range)} نقطة
            </span>
          </div>
        </>
      ) : (
        <div className="chip">★ وصلت لأعلى مستوى! ★</div>
      )}
    </div>
  );
}

interface Props {
  selected: number[];
  onChange: (nums: number[]) => void;
  onRandom: () => void;
  maxSelect: number;
}

export default function LottoPicker({ selected, onChange, onRandom, maxSelect }: Props) {
  const nums = Array.from({ length: 49 }, (_, i) => i + 1);

  function toggle(n: number) {
    if (selected.includes(n)) {
      onChange(selected.filter((x) => x !== n));
    } else if (selected.length < maxSelect) {
      onChange([...selected, n]);
    }
  }

  return (
    <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
      {/* Status line */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold" style={{ color: selected.length === maxSelect ? "#10b981" : "rgba(255,255,255,0.6)" }}>
          {selected.length === maxSelect ? "✓ اخترت 6 أرقام!" : `اختر ${maxSelect - selected.length} أرقام`}
        </span>
        <button onClick={onRandom} className="btn-ghost text-xs px-3 py-1.5" style={{ fontSize: 12 }}>
          🎲 رمي عشوائي
        </button>
      </div>

      {/* Number grid 7×7 */}
      <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
        {nums.map((n) => {
          const active = selected.includes(n);
          return (
            <button
              key={n}
              onClick={() => toggle(n)}
              className={`num-btn font-orbitron ${active ? "num-btn-active" : ""}`}
              disabled={!active && selected.length >= maxSelect}
              style={{
                opacity: !active && selected.length >= maxSelect ? 0.35 : 1,
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

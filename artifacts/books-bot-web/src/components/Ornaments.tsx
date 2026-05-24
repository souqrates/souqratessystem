export const L = (s: string) => (
  <span dir="ltr" lang="en">{s}</span>
);

export function Ornament({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`} aria-hidden>
      <span className="h-px w-16 md:w-24" style={{ background: "var(--gold-line)" }} />
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z"
          stroke="var(--gold)"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
      <span className="h-px w-16 md:w-24" style={{ background: "var(--gold-line)" }} />
    </div>
  );
}

export function CornerFlourish({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden>
      <path
        d="M2 2 H22 M2 2 V22 M2 12 Q12 12 12 2"
        stroke="var(--gold)"
        strokeWidth="1"
        fill="none"
        opacity="0.7"
      />
      <circle cx="2" cy="2" r="1.5" fill="var(--gold)" />
    </svg>
  );
}

export function Monogram({ size = 44 }: { size?: number }) {
  return (
    <div
      className="relative flex items-center justify-center"
      style={{
        width: size,
        height: size,
        border: "1px solid var(--gold)",
        background: "var(--ivory)",
      }}
      aria-hidden
    >
      <div
        className="absolute"
        style={{ inset: 4, border: "1px solid var(--gold-line)" }}
      />
      <span className="font-display text-lg leading-none" style={{ color: "var(--emerald)" }}>
        ❖
      </span>
    </div>
  );
}

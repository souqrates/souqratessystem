import { useEffect, useState } from "react";
import logoUrl from "@/assets/souqrates-logo.webp";

interface SplashProps {
  onDone: () => void;
  durationMs?: number;
}

export function Splash({ onDone, durationMs = 2400 }: SplashProps) {
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const effective = reduced ? 500 : durationMs;

    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      const pct = Math.min(100, Math.round((elapsed / effective) * 100));
      setProgress(pct);
      if (pct < 100) {
        raf = requestAnimationFrame(tick);
      } else {
        setLeaving(true);
        window.setTimeout(onDone, reduced ? 150 : 450);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [durationMs, onDone]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-500"
      style={{
        background: '#04030a',
        opacity: leaving ? 0 : 1,
        pointerEvents: leaving ? "none" : "auto",
      }}
      aria-label="جار التحميل..."
    >
      {/* Ambient glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[250px]"
          style={{ background: 'radial-gradient(ellipse, rgba(168,85,247,0.15), transparent 70%)', filter: 'blur(40px)' }} />
        <div className="absolute bottom-0 right-0 w-[350px] h-[200px]"
          style={{ background: 'radial-gradient(ellipse, rgba(34,211,238,0.12), transparent 70%)', filter: 'blur(40px)' }} />
      </div>

      {/* Neon border frame */}
      <div className="absolute pointer-events-none rounded-2xl"
        style={{ inset: 16, border: '1px solid rgba(34,211,238,0.15)' }} />
      <div className="absolute pointer-events-none rounded-2xl"
        style={{ inset: 24, border: '1px solid rgba(168,85,247,0.1)' }} />

      <div className="relative flex flex-col items-center px-8 max-w-sm w-full">
        {/* Logo */}
        <div
          className="relative mb-8"
          style={{
            width: 240,
            filter: 'drop-shadow(0 20px 60px rgba(168,85,247,0.4))',
          }}
        >
          <img
            src={logoUrl}
            alt="SOUQRATES SOUQ"
            className="block w-full h-auto"
            draggable={false}
          />
          {/* Spinning star */}
          <svg
            className="absolute -top-3 left-1/2 -translate-x-1/2"
            width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden
            style={{ animation: "spin 5s linear infinite" }}
          >
            <path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z" fill="#22d3ee" />
          </svg>
        </div>

        {/* Wordmark */}
        <div className="text-center mb-8">
          <div className="font-orbitron tracking-widest text-2xl font-black text-white/90" dir="ltr">
            SOUQRATES <span style={{ color: '#22d3ee' }}>SOUQ</span>
          </div>
          <div className="eyebrow mt-2" dir="ltr" style={{ color: 'rgba(34,211,238,0.55)', letterSpacing: '0.3em', fontSize: 9 }}>
            DIGITAL BOOKS · EST. 2026
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-7">
          <span className="h-px w-10" style={{ background: 'rgba(34,211,238,0.3)' }} />
          <span style={{ color: 'rgba(34,211,238,0.5)' }}>◆</span>
          <span className="h-px w-10" style={{ background: 'rgba(34,211,238,0.3)' }} />
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-xs">
          <div className="relative h-[2px] w-full overflow-hidden rounded-full"
            style={{ background: 'rgba(255,255,255,0.07)' }}>
            <div
              className="absolute inset-y-0 right-0 transition-[width] duration-100 ease-linear rounded-full"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(to left, #7c3aed, #22d3ee, #67e8f9)',
                boxShadow: '0 0 12px rgba(34,211,238,0.5)',
              }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between font-orbitron text-[10px] font-black" dir="ltr"
            style={{ color: 'rgba(148,163,184,0.4)', letterSpacing: '0.15em' }}>
            <span>LOADING</span>
            <span className="tabular-nums">{String(progress).padStart(3, "0")} / 100</span>
          </div>
        </div>
      </div>
    </div>
  );
}

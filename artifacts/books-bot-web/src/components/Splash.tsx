import { useEffect, useState } from "react";
import logoUrl from "@/assets/souq-logo.jpg";

interface SplashProps {
  onDone: () => void;
  durationMs?: number;
}

export function Splash({ onDone, durationMs = 2800 }: SplashProps) {
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const effective = reduced ? 600 : durationMs;

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
        window.setTimeout(onDone, reduced ? 200 : 520);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [durationMs, onDone]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-500"
      style={{
        background: "var(--ink)",
        opacity: leaving ? 0 : 1,
        pointerEvents: leaving ? "none" : "auto",
      }}
      aria-label="Loading SOUQRATES SOUQ"
    >
      {/* gold double frame */}
      <div className="absolute pointer-events-none" style={{ inset: 18, border: "1px solid var(--gold)" }} />
      <div className="absolute pointer-events-none" style={{ inset: 26, border: "1px solid var(--gold-line)" }} />

      <div className="relative flex flex-col items-center px-8 max-w-md w-full">
        {/* Logo with antique gold ring */}
        <div
          className="relative mb-10"
          style={{
            width: 240,
            height: 240,
            borderRadius: "50%",
            padding: 6,
            background:
              "conic-gradient(from 0deg, #b8893a, #f3d68a, #b8893a, #8a651f, #b8893a)",
            boxShadow:
              "0 0 0 1px rgba(184,137,58,0.55), 0 30px 80px -20px rgba(184,137,58,0.45)",
          }}
        >
          <img
            src={logoUrl}
            alt="SOUQRATES SOUQ"
            className="block w-full h-full object-cover"
            style={{
              borderRadius: "50%",
              border: "2px solid rgba(0,0,0,0.9)",
            }}
            draggable={false}
          />
          {/* slow rotating star accent */}
          <svg
            className="absolute -top-3 left-1/2 -translate-x-1/2"
            width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden
            style={{ animation: "spin 6s linear infinite" }}
          >
            <path
              d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z"
              fill="var(--gold)"
            />
          </svg>
        </div>

        {/* Wordmark */}
        <div className="text-center mb-2">
          <div
            className="font-display tracking-[0.18em] text-3xl md:text-4xl"
            dir="ltr"
            lang="en"
            style={{ color: "var(--ivory)" }}
          >
            SOUQRATES <span style={{ color: "var(--gold)" }}>SOUQ</span>
          </div>
          <div
            className="eyebrow mt-3"
            dir="ltr"
            lang="en"
            style={{ color: "rgba(184,137,58,0.7)", letterSpacing: "0.32em" }}
          >
            digital books · est. 2026
          </div>
        </div>

        {/* small ornament */}
        <div className="flex items-center justify-center gap-3 my-7" aria-hidden>
          <span className="h-px w-12" style={{ background: "rgba(184,137,58,0.45)" }} />
          <span className="text-lg" style={{ color: "var(--gold)" }}>❖</span>
          <span className="h-px w-12" style={{ background: "rgba(184,137,58,0.45)" }} />
        </div>

        {/* Progress 0 → 100 */}
        <div
          className="w-full max-w-xs"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Loading progress"
        >
          <div
            className="relative h-[3px] w-full overflow-hidden"
            style={{ background: "rgba(184,137,58,0.18)" }}
          >
            <div
              className="absolute inset-y-0 right-0 transition-[width] duration-100 ease-linear"
              style={{
                width: `${progress}%`,
                background:
                  "linear-gradient(to left, #8a651f, #b8893a, #f3d68a, #b8893a)",
                boxShadow: "0 0 12px rgba(243,214,138,0.55)",
              }}
            />
          </div>
          <div
            className="mt-4 flex items-center justify-between font-serif-en text-xs"
            dir="ltr"
            lang="en"
            style={{ color: "rgba(243,214,138,0.85)", letterSpacing: "0.18em" }}
          >
            <span>LOADING</span>
            <span className="tabular-nums">
              {String(progress).padStart(3, "0")} / 100
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";

interface Props { onDone: () => void; }

export function SplashScreen({ onDone }: Props) {
  const [progress, setProgress] = useState(0);
  const [leaving,  setLeaving]  = useState(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const dur = reduced ? 300 : 1400;
    const start = performance.now();
    let raf = 0;
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      setLeaving(true);
      setTimeout(() => onDoneRef.current?.(), 380);
    };

    const tick = (now: number) => {
      const t     = Math.min(1, (now - start) / dur);
      const eased = Math.round((1 - Math.pow(1 - t, 2)) * 100);
      setProgress(eased);
      if (t < 1) { raf = requestAnimationFrame(tick); }
      else        { setTimeout(finish, 180); }
    };
    raf = requestAnimationFrame(tick);
    const safe = setTimeout(finish, dur + 1500);
    return () => { cancelAnimationFrame(raf); clearTimeout(safe); };
  }, []);

  const skip = () => {
    if (!leaving) { setLeaving(true); setTimeout(() => onDoneRef.current?.(), 350); }
  };

  const logoSrc = (import.meta as any).env.BASE_URL + "souqrates-logo.webp";

  return (
    <div
      onClick={skip}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        background: "radial-gradient(ellipse at 50% 38%, #0d0a1e 0%, #060412 55%, #020208 100%)",
        opacity: leaving ? 0 : 1,
        transition: "opacity 0.38s ease",
        cursor: "pointer", userSelect: "none",
        pointerEvents: leaving ? "none" : "auto",
      }}
    >
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: "-5%", left: "50%", transform: "translateX(-50%)",
          width: 480, height: 260,
          background: "radial-gradient(ellipse, rgba(201,162,39,0.18), transparent 70%)",
          filter: "blur(40px)",
        }} />
        <div style={{
          position: "absolute", bottom: "-10%", right: "-5%",
          width: 320, height: 220,
          background: "radial-gradient(ellipse, rgba(34,211,238,0.12), transparent 70%)",
          filter: "blur(40px)",
        }} />
      </div>

      <div style={{
        marginBottom: 28,
        filter: "drop-shadow(0 8px 32px rgba(201,162,39,0.4)) drop-shadow(0 2px 10px rgba(34,211,238,0.2))",
        animation: "sqLogoIn 0.65s cubic-bezier(0.22,1,0.36,1) both",
      }}>
        <img
          src={logoSrc}
          alt="SOUQRATES STAGE"
          draggable={false}
          style={{ display: "block", width: "min(72vw, 260px)", height: "auto", userSelect: "none" }}
        />
      </div>

      <div style={{ textAlign: "center", marginBottom: 32, animation: "sqNameIn 0.5s ease 0.22s both" }}>
        <div style={{
          fontFamily: "'Orbitron','Space Grotesk',sans-serif",
          fontWeight: 900, fontSize: "clamp(16px,5vw,22px)", letterSpacing: "0.13em",
          background: "linear-gradient(180deg,#fff8d6 0%,#ffd86b 50%,#c9a227 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          SOUQRATES STAGE
        </div>
        <div style={{
          marginTop: 6, fontFamily: "'Space Grotesk','Inter',sans-serif",
          fontWeight: 600, fontSize: 9, letterSpacing: "0.36em",
          color: "rgba(34,211,238,0.55)", textTransform: "uppercase",
        }}>
          مسرح المسابقات
        </div>
      </div>

      <div style={{
        width: "100%", padding: "0 40px", maxWidth: 340,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        animation: "sqFadeIn 0.3s ease 0.38s both",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
          <span style={{
            fontFamily: "'Orbitron','Space Grotesk',sans-serif",
            fontWeight: 900, fontSize: "clamp(44px,12vw,58px)",
            background: "linear-gradient(180deg,#fff8d6 0%,#ffd86b 50%,#c9a227 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 2px 18px rgba(255,191,73,0.5))",
            minWidth: "2.4ch", textAlign: "right", display: "inline-block", lineHeight: 1,
          }}>
            {progress}
          </span>
          <span style={{ fontSize: 20, color: "rgba(255,216,107,0.7)", fontWeight: 700 }}>%</span>
        </div>

        <div style={{
          width: "100%", height: 4, borderRadius: 999,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(34,211,238,0.15)", overflow: "hidden",
        }}>
          <div style={{
            height: "100%", borderRadius: 999, width: `${progress}%`,
            background: "linear-gradient(90deg,#0891b2,#22d3ee 40%,#c9a227 70%,#ffd700 100%)",
            boxShadow: "0 0 10px rgba(34,211,238,0.5)",
            transition: "width 0.05s linear",
          }} />
        </div>
      </div>

      <style>{`
        @keyframes sqLogoIn {
          from { opacity:0; transform:scale(0.72) translateY(20px); }
          to   { opacity:1; transform:scale(1) translateY(0); }
        }
        @keyframes sqNameIn {
          from { opacity:0; transform:translateY(10px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes sqFadeIn { from { opacity:0; } to { opacity:1; } }
      `}</style>
    </div>
  );
}

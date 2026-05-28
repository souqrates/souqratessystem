import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface Props { onDone: () => void; }

export function SplashScreen({ onDone }: Props) {
  const [progress, setProgress] = useState(0);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    const total = 2200;
    const start = Date.now();
    let raf: number;
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      setProgress(100);
      setTimeout(() => onDoneRef.current?.(), 200);
    };

    const tick = () => {
      const pct = Math.min(100, Math.round(((Date.now() - start) / total) * 100));
      setProgress(pct);
      if (pct < 100) raf = requestAnimationFrame(tick);
      else finish();
    };
    raf = requestAnimationFrame(tick);
    const safe = setTimeout(finish, 4000);
    return () => { cancelAnimationFrame(raf); clearTimeout(safe); };
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 50% 38%, #0e0b1e 0%, #060412 55%, #020208 100%)" }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.3, ease: "easeIn" }}
      onClick={() => onDoneRef.current?.()}
    >
      {/* Star particles */}
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          width: i % 3 === 0 ? 2 : 1, height: i % 3 === 0 ? 2 : 1,
          borderRadius: "50%",
          background: i % 4 === 0 ? "#D4AF37" : "rgba(212,175,55,0.4)",
          left: `${(i * 43 + 9) % 100}%`,
          top: `${(i * 61 + 17) % 100}%`,
          opacity: 0.35 + (i % 3) * 0.15,
          animation: `twkl ${1.5 + (i % 4) * 0.5}s ease-in-out ${(i * 0.22) % 1.6}s infinite alternate`,
        }} />
      ))}

      {/* Glow */}
      <div style={{
        position: "absolute",
        width: 400, height: 400, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(212,175,55,0.15) 0%, transparent 70%)",
        filter: "blur(40px)",
        top: "50%", left: "50%",
        transform: "translate(-50%, -58%)",
        pointerEvents: "none",
      }} />

      {/* Logo */}
      <motion.div
        initial={{ scale: 0.72, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        style={{ marginBottom: 28, position: "relative" }}
      >
        <div style={{
          position: "absolute", inset: -14, borderRadius: "50%",
          boxShadow: "0 0 50px 14px rgba(212,175,55,0.25), 0 0 100px 28px rgba(168,85,247,0.1)",
          animation: "pls 2.8s ease-in-out infinite",
          pointerEvents: "none",
        }} />
        <img
          src={`${import.meta.env.BASE_URL}souqrates-logo.webp`}
          alt="SOUQRATES SUB-AGENTS"
          draggable={false}
          style={{
            display: "block",
            width: "min(80vw, 300px)",
            height: "auto",
            objectFit: "contain",
            position: "relative", zIndex: 1, userSelect: "none",
            filter: "drop-shadow(0 8px 28px rgba(212,175,55,0.4))",
          }}
        />
      </motion.div>

      {/* Brand */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.32, duration: 0.5 }}
        style={{ textAlign: "center", marginBottom: 32 }}
      >
        <div style={{
          fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
          fontWeight: 900, fontSize: "clamp(16px, 4.5vw, 20px)",
          letterSpacing: "0.12em",
          background: "linear-gradient(180deg, #fff8d6 0%, #f3d68a 45%, #b8893a 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1.1,
        }}>
          SOUQRATES SUB-AGENTS
        </div>
        <div style={{
          marginTop: 5, fontWeight: 600, fontSize: 9,
          letterSpacing: "0.38em", color: "rgba(212,175,55,0.6)",
          textTransform: "uppercase",
        }}>
          برنامج الشركاء
        </div>
      </motion.div>

      {/* Progress */}
      <div style={{ width: "100%", padding: "0 40px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
          <span style={{
            fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
            fontWeight: 900, fontSize: "clamp(38px, 10vw, 50px)",
            background: "linear-gradient(180deg, #fff8d6 0%, #f3d68a 45%, #c9a227 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 2px 14px rgba(255,191,73,0.5))",
            minWidth: "2.2ch", textAlign: "right", display: "inline-block", lineHeight: 1,
          }}>{progress}</span>
          <span style={{ fontSize: 16, color: "rgba(243,214,138,0.75)", fontWeight: 700 }}>%</span>
        </div>
        <div style={{
          width: "100%", height: 5, borderRadius: 999,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(212,175,55,0.2)", overflow: "hidden",
        }}>
          <div style={{
            height: "100%", borderRadius: 999,
            width: `${progress}%`,
            background: "linear-gradient(90deg, #7c3aed, #a855f7 30%, #D4AF37 65%, #fff3a3 85%, #f3d68a 100%)",
            boxShadow: "0 0 10px rgba(212,175,55,0.55)",
            transition: "width 0.06s linear",
          }} />
        </div>
        <div style={{
          fontWeight: 700, fontSize: 9, letterSpacing: "0.42em",
          color: "rgba(212,175,55,0.45)", textTransform: "uppercase",
        }}>
          {progress < 40 ? "INITIALIZING" : progress < 80 ? "LOADING" : "ALMOST READY"}
        </div>
      </div>

      <style>{`
        @keyframes pls { 0%,100%{opacity:.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.04)} }
        @keyframes spn { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes twkl { 0%{opacity:.1;transform:scale(.7)} 100%{opacity:.9;transform:scale(1.5)} }
      `}</style>
    </motion.div>
  );
}

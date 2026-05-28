import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useT } from "../lib/i18n";

interface Props {
  onDone: () => void;
}

export function SplashScreen({ onDone }: Props) {
  const t = useT();
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"in" | "count" | "out">("in");

  useEffect(() => {
    const inTimer = setTimeout(() => setPhase("count"), 600);
    return () => clearTimeout(inTimer);
  }, []);

  useEffect(() => {
    if (phase !== "count") return;
    const duration = 2000;
    const steps = 100;
    const interval = duration / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += 1;
      const eased = Math.round(100 * (1 - Math.pow(1 - current / steps, 2)));
      setProgress(eased);
      if (current >= steps) {
        clearInterval(timer);
        setTimeout(() => { setPhase("out"); setTimeout(onDone, 600); }, 300);
      }
    }, interval);
    return () => clearInterval(timer);
  }, [phase, onDone]);

  return (
    <AnimatePresence>
      {phase !== "out" && (
        <motion.div
          key="splash"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
          style={{ background: "radial-gradient(ellipse at 50% 38%, #0d0a1e 0%, #060412 55%, #020208 100%)" }}
        >
          {/* Star particles */}
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} style={{
              position: "absolute",
              width: i % 3 === 0 ? 2 : 1,
              height: i % 3 === 0 ? 2 : 1,
              borderRadius: "50%",
              background: i % 4 === 0 ? "#D4AF37" : "rgba(168,85,247,0.6)",
              left: `${(i * 41 + 7) % 100}%`,
              top: `${(i * 67 + 13) % 100}%`,
              opacity: 0.4 + (i % 3) * 0.15,
              animation: `twinkle-s ${1.6 + (i % 5) * 0.5}s ease-in-out ${(i * 0.2) % 1.8}s infinite alternate`,
            }} />
          ))}

          {/* Outer ambient glow */}
          <div style={{
            position: "absolute",
            width: 480,
            height: 480,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(212,175,55,0.12) 0%, rgba(168,85,247,0.08) 50%, transparent 70%)",
            filter: "blur(40px)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -58%)",
            pointerEvents: "none",
          }} />

          {/* Logo — large & prominent */}
          <motion.div
            initial={{ scale: 0.7, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            style={{ marginBottom: 32, position: "relative" }}
          >
            {/* Pulsing ring */}
            <div style={{
              position: "absolute",
              inset: -16,
              borderRadius: "50%",
              boxShadow: "0 0 60px 16px rgba(212,175,55,0.28), 0 0 120px 32px rgba(168,85,247,0.12)",
              animation: "pulseRing-s 2.8s ease-in-out infinite",
              pointerEvents: "none",
            }} />
            {/* Gold conic border */}
            <div style={{
              position: "absolute",
              inset: -4,
              borderRadius: "50%",
              background: "conic-gradient(from 0deg, #b8893a, #f3d68a, #c9a227, #8a651f, #f3d68a, #b8893a)",
              padding: 4,
              animation: "spinSlow-s 8s linear infinite",
            }}>
              <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "#04030a" }} />
            </div>
            {/* Logo image */}
            <img
              src={`${import.meta.env.BASE_URL}souqrates-logo.webp`}
              alt="SOUQRATES SYSTEM"
              draggable={false}
              style={{
                display: "block",
                width: "min(72vw, 300px)",
                height: "min(72vw, 300px)",
                borderRadius: "50%",
                objectFit: "cover",
                position: "relative",
                zIndex: 1,
                userSelect: "none",
              }}
            />
            {/* Inner vignette */}
            <div style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              boxShadow: "inset 0 0 32px rgba(4,3,10,0.4)",
              pointerEvents: "none",
              zIndex: 2,
            }} />
          </motion.div>

          {/* Brand name */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            style={{ textAlign: "center", marginBottom: 28 }}
          >
            <div style={{
              fontFamily: "Orbitron, sans-serif",
              fontWeight: 900,
              fontSize: "clamp(18px, 5.5vw, 24px)",
              letterSpacing: "0.14em",
              background: "linear-gradient(180deg, #fff8d6 0%, #f3d68a 45%, #b8893a 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              lineHeight: 1.1,
            }}>
              SOUQRATES SYSTEM
            </div>
            <div style={{
              marginTop: 6,
              fontFamily: "Inter, sans-serif",
              fontWeight: 600,
              fontSize: 10,
              letterSpacing: "0.38em",
              color: "rgba(168,85,247,0.65)",
              textTransform: "uppercase",
            }}>
              المنصة الموحّدة
            </div>
          </motion.div>

          {/* Counter + progress bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === "count" ? 1 : 0 }}
            transition={{ duration: 0.3 }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: "100%", padding: "0 40px" }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{
                fontFamily: "Orbitron, sans-serif",
                fontWeight: 900,
                fontSize: "clamp(42px, 11vw, 54px)",
                background: "linear-gradient(180deg, #fff8d6 0%, #f3d68a 45%, #c9a227 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                filter: "drop-shadow(0 2px 16px rgba(255,191,73,0.5))",
                minWidth: "2.2ch",
                textAlign: "right",
                display: "inline-block",
                lineHeight: 1,
              }}>
                {progress}
              </span>
              <span style={{ fontSize: 18, color: "rgba(243,214,138,0.75)", fontWeight: 700 }}>%</span>
            </div>

            {/* Bar */}
            <div style={{
              width: "100%",
              height: 5,
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(212,175,55,0.2)",
              overflow: "hidden",
              position: "relative",
            }}>
              <div style={{
                height: "100%",
                borderRadius: 999,
                width: `${progress}%`,
                background: "linear-gradient(90deg, #7c3aed, #a855f7 30%, #D4AF37 65%, #fff3a3 85%, #f3d68a 100%)",
                boxShadow: "0 0 10px rgba(212,175,55,0.55), 0 0 4px rgba(168,85,247,0.5)",
                transition: "width 0.05s linear",
              }} />
            </div>

            <div style={{
              fontFamily: "Orbitron, sans-serif",
              fontWeight: 700,
              fontSize: 9,
              letterSpacing: "0.42em",
              color: "rgba(168,85,247,0.55)",
              textTransform: "uppercase",
            }}>
              {t("splash.loading")}
            </div>
          </motion.div>

          <style>{`
            @keyframes pulseRing-s {
              0%,100% { opacity:.65; transform:scale(1); }
              50%      { opacity:1;   transform:scale(1.04); }
            }
            @keyframes spinSlow-s {
              from { transform:rotate(0deg); }
              to   { transform:rotate(360deg); }
            }
            @keyframes twinkle-s {
              0%   { opacity:.15; transform:scale(.8); }
              100% { opacity:.9;  transform:scale(1.5); }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

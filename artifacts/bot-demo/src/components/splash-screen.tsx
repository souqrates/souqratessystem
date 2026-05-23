import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  onDone: () => void;
}

export function SplashScreen({ onDone }: Props) {
  const [count, setCount] = useState(0);
  const [phase, setPhase] = useState<"in" | "count" | "out">("in");

  useEffect(() => {
    // After logo fades in, start counting
    const inTimer = setTimeout(() => {
      setPhase("count");
    }, 600);
    return () => clearTimeout(inTimer);
  }, []);

  useEffect(() => {
    if (phase !== "count") return;

    // Count from 0 → 100 over ~1.8s with easing
    const duration = 1800;
    const steps = 100;
    const interval = duration / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += 1;
      // Ease-out: slower near 100
      const eased = Math.round(
        100 * (1 - Math.pow(1 - current / steps, 2))
      );
      setCount(eased);

      if (current >= steps) {
        clearInterval(timer);
        // Short pause then exit
        setTimeout(() => {
          setPhase("out");
          setTimeout(onDone, 600);
        }, 300);
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
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
          style={{
            background:
              "radial-gradient(ellipse at 50% 40%, #120820 0%, #060a14 55%, #030610 100%)",
          }}
        >
          {/* Ambient glow behind logo */}
          <div
            className="absolute w-72 h-72 rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(circle, rgba(168,85,247,0.25) 0%, transparent 70%)",
              filter: "blur(40px)",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -62%)",
            }}
          />

          {/* Logo */}
          <motion.div
            initial={{ scale: 0.75, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{
              delay: 0.1,
              duration: 0.65,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="relative mb-10"
          >
            {/* Outer glow ring */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                boxShadow:
                  "0 0 40px rgba(168,85,247,0.45), 0 0 80px rgba(168,85,247,0.18)",
              }}
            />
            <img
              src={`${import.meta.env.BASE_URL}logo.jpg`}
              alt="Logo"
              className="w-44 h-44 rounded-full object-cover relative z-10"
              style={{
                border: "2px solid rgba(168,85,247,0.5)",
              }}
            />
          </motion.div>

          {/* Counter */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: phase === "count" ? 1 : 0, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center gap-3"
          >
            {/* Percentage number */}
            <div className="relative flex items-baseline gap-1">
              <span
                className="text-5xl font-black tabular-nums"
                style={{
                  background:
                    "linear-gradient(135deg, #c084fc 0%, #a855f7 50%, #22d3ee 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  minWidth: "3ch",
                  textAlign: "right",
                }}
              >
                {count}
              </span>
              <span className="text-2xl font-black text-white/30">%</span>
            </div>

            {/* Progress bar */}
            <div className="w-48 h-1 rounded-full overflow-hidden bg-white/[0.07]">
              <motion.div
                className="h-full rounded-full"
                style={{
                  width: `${count}%`,
                  background:
                    "linear-gradient(90deg, #7c3aed, #a855f7, #22d3ee)",
                  boxShadow: "0 0 8px rgba(168,85,247,0.6)",
                  transition: "width 0.04s linear",
                }}
              />
            </div>

            <p className="text-[11px] font-medium text-white/30 tracking-widest uppercase mt-1">
              جارٍ التحميل
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

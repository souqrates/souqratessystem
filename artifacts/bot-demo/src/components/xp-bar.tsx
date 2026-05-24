import { motion } from "framer-motion";
import { Zap } from "lucide-react";

export function XpBar() {
  return (
    <div
      className="rounded-2xl px-4 py-3 relative overflow-hidden flex items-center gap-3"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: "linear-gradient(135deg,rgba(168,85,247,0.2),rgba(34,211,238,0.15))", border: "1px solid rgba(168,85,247,0.2)" }}
      >
        <Zap size={17} className="text-skz-light" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-black text-skz-light">XP System</span>
          <span className="text-[10px] text-white/30 font-medium">Coming Soon</span>
        </div>
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
          <motion.div
            className="h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: "0%" }}
            style={{ background: "linear-gradient(90deg,#9333ea,#22d3ee)" }}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[9px] text-white/25 font-medium">Earn XP by playing and using bots</span>
        </div>
      </div>
    </div>
  );
}

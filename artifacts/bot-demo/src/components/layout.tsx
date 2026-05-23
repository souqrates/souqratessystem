import { Link, useLocation } from "wouter";
import { Home, Wallet, Download, Upload, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";

const NAV_ITEMS = [
  { href: "/referral", icon: Users,    label: "إحالة",   color: "#c084fc", glow: "rgba(168,85,247,0.4)" },
  { href: "/withdraw", icon: Upload,   label: "سحب",     color: "#f87171", glow: "rgba(239,68,68,0.4)"  },
  { href: "/",         icon: Home,     label: "الرئيسية", color: "#22d3ee", glow: "rgba(34,211,238,0.4)" },
  { href: "/deposit",  icon: Download, label: "إيداع",   color: "#34d399", glow: "rgba(16,185,129,0.4)" },
  { href: "/wallet",   icon: Wallet,   label: "محفظة",   color: "#c084fc", glow: "rgba(168,85,247,0.4)" },
];

const pageVariants = {
  initial: { opacity: 0, y: 12, scale: 0.99 },
  animate: { opacity: 1, y: 0,  scale: 1,    transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, y: -8, scale: 0.99, transition: { duration: 0.15 } },
};

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.expand();
      try {
        window.Telegram.WebApp.setHeaderColor("#060a14");
        window.Telegram.WebApp.setBackgroundColor("#060a14");
      } catch {}
    }
  }, []);

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-base text-white relative">

      {/* Main scrollable content */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="min-h-full pb-28"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Premium bottom navigation */}
      <nav className="nav-bar absolute bottom-0 left-0 right-0 safe-bottom z-50">
        <div className="flex justify-around items-center h-[60px] px-2">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            const isCenter = item.href === "/";

            return (
              <Link key={item.href} href={item.href} className="flex-1">
                <motion.div
                  className="flex flex-col items-center justify-center w-full h-full gap-0.5 relative py-1"
                  whileTap={{ scale: 0.88 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  {isCenter ? (
                    /* Center home button — elevated */
                    <div className="relative -mt-5">
                      <motion.div
                        className="w-13 h-13 rounded-2xl flex items-center justify-center relative overflow-hidden"
                        style={{
                          background: isActive
                            ? `linear-gradient(135deg, #9333ea, #06b6d4)`
                            : `linear-gradient(135deg, rgba(147,51,234,0.7), rgba(6,182,212,0.5))`,
                          boxShadow: isActive
                            ? `0 4px 20px rgba(147,51,234,0.5), 0 0 0 2px rgba(147,51,234,0.3)`
                            : `0 4px 16px rgba(0,0,0,0.4)`,
                          width: 52,
                          height: 52,
                          borderRadius: 16,
                        }}
                        animate={{ scale: isActive ? 1.05 : 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      >
                        <Icon size={22} className="text-white" strokeWidth={isActive ? 2.5 : 2} />
                      </motion.div>
                      {isActive && (
                        <div
                          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                          style={{ background: "#22d3ee", boxShadow: "0 0 6px #22d3ee" }}
                        />
                      )}
                    </div>
                  ) : (
                    /* Regular nav items */
                    <>
                      <div className="relative flex items-center justify-center w-10 h-8">
                        {isActive && (
                          <motion.div
                            layoutId="nav-bg"
                            className="absolute inset-0 rounded-xl"
                            style={{ background: `${item.color}18`, border: `1px solid ${item.color}30` }}
                            transition={{ type: "spring", stiffness: 350, damping: 28 }}
                          />
                        )}
                        <motion.div
                          animate={isActive ? { scale: 1.1, y: -1 } : { scale: 1, y: 0 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        >
                          <Icon
                            size={20}
                            strokeWidth={isActive ? 2.5 : 1.75}
                            style={{ color: isActive ? item.color : "rgba(255,255,255,0.38)" }}
                          />
                        </motion.div>
                      </div>
                      <motion.span
                        className="text-[10px] font-bold leading-none"
                        animate={{ color: isActive ? item.color : "rgba(255,255,255,0.35)" }}
                        transition={{ duration: 0.2 }}
                      >
                        {item.label}
                      </motion.span>
                    </>
                  )}
                </motion.div>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

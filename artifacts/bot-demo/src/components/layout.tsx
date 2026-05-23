import { Link, useLocation } from "wouter";
import { Home, Wallet, Download, Upload, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";

const NAV_ITEMS = [
  { href: "/", icon: Home, label: "الرئيسية" },
  { href: "/wallet", icon: Wallet, label: "محفظة" },
  { href: "/deposit", icon: Download, label: "إيداع" },
  { href: "/withdraw", icon: Upload, label: "سحب" },
  { href: "/referral", icon: Users, label: "إحالة" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.expand();
      window.Telegram.WebApp.setHeaderColor("#0a0f1e");
      window.Telegram.WebApp.setBackgroundColor("#0a0f1e");
    }
  }, []);

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-base text-white relative">
      <div className="flex-1 overflow-y-auto pb-24 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="min-h-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>

      <nav className="absolute bottom-0 left-0 right-0 glass-card rounded-t-3xl border-b-0 safe-bottom">
        <div className="flex justify-around items-center h-20 px-2 pb-2">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            
            return (
              <Link key={item.href} href={item.href} className="flex-1">
                <div className="flex flex-col items-center justify-center w-full h-full space-y-1 relative">
                  {isActive && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 bg-accent/10 rounded-2xl z-0"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <Icon 
                    size={24} 
                    className={`z-10 transition-colors duration-300 ${isActive ? 'text-accent' : 'text-white/50'}`}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span className={`text-[10px] font-medium z-10 transition-colors duration-300 ${isActive ? 'text-accent' : 'text-white/50'}`}>
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

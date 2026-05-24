import { motion, AnimatePresence } from 'framer-motion';
import { Globe, ChevronDown } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import useAppStore from '../store/appStore';
import { LANGUAGES } from '../constants';
import { triggerHaptic } from '../lib/telegram';
import { isLowEnd, isMidEnd } from '../lib/deviceProfile';

// NOTE: hamburger / InfoMenu intentionally removed — Terms, Privacy,
// FAQ, contact, etc. now live in the Mother Bot (the central hub).
// Network-ping useNetworkStatus() was also removed: it pinged a possibly-
// unset VITE_SUPABASE_URL every 15-60s, flooding the console with errors
// and causing the app to feel laggy / unresponsive after a short while.

export default function Navbar() {
  const { language, setLanguage, wallet, appConfig } = useAppStore();
  const sym = appConfig?.currency_symbol || 'SKZ';
  const sc  = Number(wallet?.sc_balance) || 0;
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef(null);

  const handleLang = (lang) => { triggerHaptic('light'); setLanguage(lang); setLangOpen(false); };

  useEffect(() => {
    if (!langOpen) return;
    const handler = (e) => {
      if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [langOpen]);

  return (
    <header
      className="flex-shrink-0 z-40"
      style={{ background: 'rgba(4,3,10,0.92)', ...(isLowEnd() ? {} : { backdropFilter: isMidEnd() ? 'blur(8px)' : 'blur(28px) saturate(180%)' }) }}
    >
      <div className="accent-line-top" />
      <div className="max-w-xl mx-auto flex items-center justify-between px-4 py-2.5" style={{ paddingTop: 14 }}>

        {/* Brand / app title — replaces the removed hamburger */}
        <div className="flex items-center gap-2">
          <span className="text-lg">🎮</span>
          <span className="font-orbitron text-[11px] font-black tracking-widest text-white/90">
            SOUQRATES <span style={{ color: '#f59e0b' }}>SKILLZ</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Balance pill */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
            style={{ background: 'rgba(34,211,238,0.10)', border: '1px solid rgba(34,211,238,0.22)' }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="font-orbitron text-xs font-black shimmer-gold">
              {sc.toLocaleString()}
            </span>
            <span className="font-orbitron text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.75)' }}>
              {sym}
            </span>
          </div>

          {/* Language selector */}
          <div className="relative" ref={langRef}>
            <motion.button
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-slate-400"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              whileTap={{ scale: 0.92 }}
            >
              <Globe size={12} />
              <span className="text-[11px] font-bold uppercase">{language}</span>
              <ChevronDown size={9} className={`transition-transform duration-200 ${langOpen ? 'rotate-180' : ''}`} />
            </motion.button>

            <AnimatePresence>
              {langOpen && (
                <motion.div
                  className="absolute right-0 top-10 rounded-2xl overflow-hidden w-36 z-50"
                  style={{
                    background: 'rgba(10,7,22,0.97)',
                    backdropFilter: 'blur(24px)',
                    border: '1px solid rgba(34,211,238,0.15)',
                    boxShadow: '0 24px 60px rgba(0,0,0,0.8)',
                  }}
                  initial={{ opacity: 0, y: -8, scale: 0.93 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.93 }}
                  transition={{ duration: 0.14, ease: 'easeOut' }}
                >
                  {Object.entries(LANGUAGES).map(([code, name]) => (
                    <button
                      key={code}
                      onClick={() => handleLang(code)}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        language === code
                          ? 'font-black'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      style={language === code ? {
                        background: 'rgba(34,211,238,0.12)',
                        color: '#22d3ee',
                      } : {}}
                    >
                      {name}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}

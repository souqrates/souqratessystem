import { motion, AnimatePresence } from 'framer-motion';
import { Globe, ChevronDown } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import useAppStore from '../store/appStore';
import { t } from '../lib/i18n';
import { LANGUAGES } from '../constants';
import { triggerHaptic } from '../lib/telegram';
import { getDeviceTier, isLowEnd, isMidEnd } from '../lib/deviceProfile';
import InfoMenu from './InfoMenu';

function useNetworkStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [latency, setLatency] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => { setOnline(false); setLatency(null); };
    window.addEventListener('online', on);
    window.addEventListener('offline', off);

    const ping = async () => {
      if (!navigator.onLine) { setLatency(null); return; }
      try {
        const t0 = performance.now();
        await fetch(import.meta.env.VITE_SUPABASE_URL + '/rest/v1/', {
          method: 'HEAD',
          headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
          signal: AbortSignal.timeout(5000),
        });
        setLatency(Math.round(performance.now() - t0));
      } catch {
        setLatency(null);
      }
    };
    ping();
    const tier = getDeviceTier();
    const interval = tier === 'low' ? 60000 : tier === 'mid' ? 30000 : 15000;
    intervalRef.current = setInterval(ping, interval);

    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      clearInterval(intervalRef.current);
    };
  }, []);

  const good = online && latency !== null && latency < 500;
  const warn = online && latency !== null && latency >= 500;
  const bad = !online || latency === null;
  return { online, latency, good, warn, bad };
}

export default function Navbar() {
  const { language, setLanguage, wallet, appConfig } = useAppStore();
  const sym = appConfig?.currency_symbol || 'SKZ';
  const sc  = Number(wallet?.sc_balance) || 0;
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef(null);
  const net = useNetworkStatus();

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

        {/* Info Menu */}
        <InfoMenu />

        <div className="flex items-center gap-2">
          {/* Network status */}
          <div title={net.bad ? 'Connection issue' : net.warn ? `Slow (${net.latency}ms)` : `Online (${net.latency}ms)`}
            style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: net.bad ? '#ef4444' : net.warn ? '#f59e0b' : '#10b981',
              boxShadow: `0 0 6px ${net.bad ? '#ef4444' : net.warn ? '#f59e0b' : '#10b981'}`,
            }}
          />
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

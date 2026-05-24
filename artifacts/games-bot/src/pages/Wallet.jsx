import { motion } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import {
  Clock, Coins, Wallet as WalletIcon, RefreshCw, Info, ExternalLink,
} from 'lucide-react';
import useAppStore from '../store/appStore';
import { t } from '../lib/i18n';
import { triggerHaptic } from '../lib/telegram';
import { getBalance, listLedger } from '../lib/payments';

// Deposit/withdraw moved to the Mother Bot (central financial hub).
// Configurable via appConfig.mother_bot_username; safe fallback to current
// Mother Bot handle. Update this constant if the username changes.
const MOTHER_BOT_FALLBACK = 'SouqratesBot';

const container = { animate: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } } };
const item = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } },
};

function num(v, def = 0) { const n = Number(v); return Number.isFinite(n) ? n : def; }

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(dateStr).toLocaleDateString();
}
export default function Wallet() {
  const { language, appConfig } = useAppStore();
  const [balance, setBalance] = useState(null);
  const [ledger, setLedger] = useState([]);

  const motherBotUser = String(appConfig?.mother_bot_username || MOTHER_BOT_FALLBACK).replace(/^@+/, '').trim();
  const motherBotUrl  = `https://t.me/${motherBotUser}`;

  const refresh = useCallback(async () => {
    try {
      const [b, l] = await Promise.all([
        getBalance().catch(() => null),
        listLedger({ limit: 20 }).catch(() => []),
      ]);
      setBalance(b);
      setLedger(l);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const skzBalance = num(balance?.sc_balance, 0);

  function openMotherBot() {
    triggerHaptic('medium');
    try {
      const wa = window.Telegram?.WebApp;
      if (wa?.openTelegramLink) { wa.openTelegramLink(motherBotUrl); return; }
    } catch { /* fallthrough */ }
    window.open(motherBotUrl, '_blank', 'noopener');
  }

  return (
    <motion.div className="px-4 pt-5 pb-6 space-y-4 relative z-10" variants={container} initial="initial" animate="animate">
      <motion.div variants={item} className="flex items-center gap-2.5">
        <WalletIcon size={17} style={{ color: '#10b981', filter: 'drop-shadow(0 0 8px rgba(16,185,129,0.9))' }} />
        <h1 className="font-orbitron text-base font-black text-white tracking-widest">{t(language, 'wallet')}</h1>
        <button onClick={refresh} className="ml-auto p-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <RefreshCw size={12} style={{ color: 'rgba(148,163,184,0.7)' }} />
        </button>
      </motion.div>

      {/* Unified-wallet notice */}
      <motion.div variants={item} className="rounded-2xl px-4 py-3 flex items-center gap-2.5"
        style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
        <Info size={13} style={{ color: '#10b981', flexShrink: 0 }} />
        <p style={{ fontSize: 11, color: 'rgba(16,185,129,0.9)', lineHeight: 1.5 }}>
          رصيدك موحّد عبر جميع بوتات المنصة — أي إيداع في البوت الأم يظهر فوراً هنا.
        </p>
      </motion.div>

      {/* Balance hero */}
      <motion.div variants={item} className="glass-hero rounded-3xl p-5 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'rgba(16,185,129,0.12)' }} />
        <div className="flex items-center gap-1.5 mb-2 relative z-10">
          <Coins size={11} style={{ color: '#10b981' }} />
          <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.78)' }}>
            SKZ Balance · Unified Wallet
          </p>
        </div>
        <div className="flex items-baseline gap-2 mb-1 relative z-10">
          <p className="font-orbitron text-4xl font-black text-white">{skzBalance.toLocaleString()}</p>
          <p className="font-orbitron text-sm font-black" style={{ color: '#10b981' }}>SKZ</p>
        </div>
        {balance?.balanceTon && Number(balance.balanceTon) > 0 && (
          <p className="text-[10px] relative z-10 mt-0.5" style={{ color: 'rgba(34,211,238,0.7)' }}>
            TON: <span className="font-orbitron font-black" style={{ color: '#22d3ee' }}>{Number(balance.balanceTon).toFixed(4)}</span>
          </p>
        )}
        {balance?.totalEarnedSkz && (
          <p className="text-[10px] relative z-10 mt-0.5" style={{ color: 'rgba(148,163,184,0.5)' }}>
            Total earned: <span style={{ color: 'rgba(16,185,129,0.8)' }}>{Number(balance.totalEarnedSkz).toLocaleString()} SKZ</span>
          </p>
        )}
      </motion.div>

      {/* Deposit / Withdraw → Mother Bot CTA */}
      <motion.div variants={item} className="glass-card rounded-2xl p-4 space-y-3"
        style={{ border: '1px solid rgba(34,211,238,0.22)', background: 'rgba(34,211,238,0.04)' }}>
        <div className="flex items-start gap-2">
          <div style={{
            width: 36, height: 36, borderRadius: 12, flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(34,211,238,0.18), rgba(14,165,233,0.18))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>🏦</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-white mb-1">الإيداع والسحب من البوت الأم</p>
            <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(148,163,184,0.85)' }}>
              البوت الأم هو المركز المالي لجميع البوتات. اشحن رصيدك (TON / Stars / USDT) أو اسحب أرباحك من هناك،
              وستظهر التحديثات في هذا البوت فوراً.
            </p>
          </div>
        </div>
        <button onClick={openMotherBot}
          className="w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2"
          style={{
            background: 'linear-gradient(135deg, #0ea5e9, #06b6d4)',
            color: '#fff',
            boxShadow: '0 4px 20px rgba(14,165,233,0.30)',
          }}>
          فتح البوت الأم
          <ExternalLink size={14} />
        </button>
      </motion.div>

      {/* Transaction history */}
      <motion.div variants={item} className="space-y-2">
        <div className="flex items-center gap-2 px-1 mb-1">
          <Clock size={12} style={{ color: 'rgba(148,163,184,0.7)' }} />
          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.7)' }}>
            Transaction History
          </p>
        </div>
        {ledger.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center">
            <p className="text-sm" style={{ color: 'rgba(148,163,184,0.5)' }}>No transactions yet</p>
          </div>
        ) : ledger.map((tx, i) => {
          const isCredit = tx.type === 'credit' || tx.type === 'deposit' || tx.type === 'referral_bonus';
          return (
            <div key={tx.id ?? i} className="glass-card rounded-xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: isCredit ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' }}>
                <span style={{ fontSize: 14, color: isCredit ? '#10b981' : '#ef4444', fontWeight: 900 }}>
                  {isCredit ? '↓' : '↑'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{tx.description || tx.type}</p>
                <p className="text-[9px]" style={{ color: 'rgba(148,163,184,0.55)' }}>
                  {formatRelativeTime(tx.created_at)}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs font-black font-orbitron"
                  style={{ color: isCredit ? '#10b981' : '#ef4444' }}>
                  {(tx.type === 'debit') ? '−' : '+'}{Number(tx.amount_sc).toLocaleString()} SKZ
                </p>
              </div>
            </div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}

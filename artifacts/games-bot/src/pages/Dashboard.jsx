import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUpRight, ArrowDownLeft, ShieldCheck,
  Zap, Share2, Sparkles,
} from 'lucide-react';
import useAppStore from '../store/appStore';
import { t } from '../lib/i18n';
import ShareProfileCard from '../components/ShareProfileCard';
import GameCarousel from '../components/GameCarousel';
import TopPlayers from '../components/TopPlayers';
import GameStats from '../components/GameStats';
import { listLedger } from '../lib/payments';
import { fetchGamification, xpProgressToNext } from '../lib/gamification';
import { rankFor } from '../lib/ranks';
import { displayNameOf, avatarUrlOf, initialOf } from '../lib/profile';

const container = { animate: {} };
const item      = { initial: {}, animate: {} };

export default function Dashboard() {
  const {
    user, wallet, language, appConfig,
    setCurrentPage, refreshBalance,
    pwaInstallPrompt, setPwaInstallPrompt,
  } = useAppStore();

  const [shareOpen,  setShareOpen]  = useState(false);
  const [gami,       setGami]       = useState(null);
  const [xpProgress, setXpProgress] = useState(null);
  const [activity,   setActivity]   = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const g = await fetchGamification();
      if (!cancelled && g) {
        setGami(g);
        setXpProgress(xpProgressToNext(g.xp || 0));
      }
    }
    async function loadActivity() {
      try {
        const rows = await listLedger({ limit: 4 });
        if (!cancelled && rows?.length) {
          setActivity(rows.map(r => {
            const isCredit = r.type === 'credit' || r.type === 'deposit' || r.type === 'referral_bonus';
            const amt = Number(r.amount_sc || 0);
            return {
              desc:   r.description || r.category?.replace(/_/g, ' ') || r.type || 'Transaction',
              amount: `${isCredit ? '+' : '-'}${amt.toLocaleString()}`,
              time:   timeAgo(r.created_at),
              pos:    isCredit,
            };
          }));
        }
      } catch { /* ignore */ }
    }
    load();
    loadActivity();
    return () => { cancelled = true; };
  }, [user?.telegram_id]);

  const sym        = appConfig?.currency_symbol || 'SKZ';
  const scBalance  = Number(wallet?.sc_balance) || 0;
  const trialActive = !!wallet?.trial_active;
  const totalXp    = Number(gami?.xp || 0);
  const totalWins  = Number(gami?.total_wins  || 0);
  const totalGames = Number(gami?.total_games || 0);
  const winRate    = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;

  const rank     = rankFor(xpProgress?.level || 1);
  const initial  = initialOf(user);
  const avatar   = avatarUrlOf(user);
  const dispName = displayNameOf(user);

  function onOpenGame(g, tiers) {
    useAppStore.getState().setCurrentPage('games');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('open-game', { detail: { game: g, tiers } }));
    }, 50);
  }

  return (
    <motion.div
      className="px-4 pt-5 pb-8 space-y-5 relative z-10"
      variants={container}
      initial="initial"
      animate="animate"
    >
      {/* ── HERO CARD ─────────────────────────────────────────── */}
      <motion.div variants={item} className="glass-hero rounded-3xl p-5 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'rgba(34,211,238,0.18)' }} />
        <div className="absolute -bottom-16 -left-12 w-44 h-44 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'rgba(167,139,250,0.12)' }} />

        {/* Profile row */}
        <div className="flex items-center gap-4 relative z-10">
          <div className="avatar-ring-wrap w-16 h-16 flex-shrink-0 relative">
            <div className="avatar-ring-inner overflow-hidden">
              {avatar
                ? <img src={avatar} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
                : <span className="font-orbitron text-xl font-black text-white">{initial}</span>}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="block text-left max-w-full">
              <h2 className="font-orbitron text-base font-black text-white truncate tracking-wide leading-snug">
                {dispName}
              </h2>
            </div>
            <p className="text-xs font-medium mt-0.5" style={{ color: 'rgba(148,163,184,0.85)' }}>
              @{user?.username || 'player'}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5">
              {trialActive ? (
                <><Sparkles size={10} style={{ color: '#fbbf24' }} /><span className="text-[9px] font-black tracking-widest uppercase" style={{ color: '#fbbf24' }}>Free Trial</span></>
              ) : (
                <><ShieldCheck size={10} style={{ color: '#10b981' }} /><span className="text-[9px] font-black tracking-widest uppercase" style={{ color: '#10b981' }}>Pro Member</span></>
              )}
              <span className="w-3 h-px" style={{ background: 'rgba(148,163,184,0.3)' }} />
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#34d399', boxShadow: '0 0 6px rgba(52,211,153,0.8)' }} />
              <span className="text-[9px] font-semibold text-emerald-400">{t(language, 'online')}</span>
            </div>
          </div>

          <div className="flex-shrink-0 text-right">
            <div className="flex items-center justify-end gap-2 mb-1">
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.7)' }}>{t(language, 'balance')}</p>
              <button onClick={() => setShareOpen(true)}
                className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.25)' }}>
                <Share2 size={10} color="#22d3ee" />
              </button>
            </div>
            <p className="font-orbitron text-2xl font-black shimmer-gold leading-none">
              {scBalance.toLocaleString()}
            </p>
            <p className="text-[9px] font-medium mt-1 uppercase tracking-wider" style={{ color: 'rgba(148,163,184,0.6)' }}>
              {sym}
            </p>
          </div>
        </div>

        {/* Rank + XP progress */}
        {xpProgress && (
          <div className="mt-4 relative z-10">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider"
                  style={{ background: `${rank?.hex}18`, border: `1px solid ${rank?.hex}40`, color: rank?.hex }}>
                  LV {xpProgress.level} · {rank?.name}
                </span>
              </div>
              <span className="text-[9px] font-bold" style={{ color: 'rgba(148,163,184,0.6)' }}>
                {xpProgress.inLevel.toLocaleString()} / {xpProgress.span.toLocaleString()} XP
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${xpProgress.pct}%` }}
                transition={{ duration: 1.2, ease: 'easeOut', delay: 0.5 }}
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${rank?.hex}99, ${rank?.hex})` }}
              />
            </div>
          </div>
        )}

        <div className="mt-4 mb-3 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.2), transparent)' }} />

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 relative z-10">
          <HeroStat label={t(language, 'winRate')} value={`${winRate}%`}              color="#34d399" />
          <HeroStat label={t(language, 'totalXp')}  value={totalXp.toLocaleString()}   color="#22d3ee" />
          <HeroStat label={t(language, 'matches')}  value={totalGames.toLocaleString()} color="#f59e0b" />
        </div>
      </motion.div>

      {/* ── GAME CAROUSEL ─────────────────────────────────────── */}
      <motion.div variants={item}>
        <GameCarousel onOpenGame={onOpenGame} appConfig={appConfig} />
      </motion.div>

      {/* ── TOP PLAYERS ───────────────────────────────────────── */}
      <motion.div variants={item}>
        <TopPlayers currentTelegramId={user?.telegram_id || user?.id} />
      </motion.div>

      {/* ── GAME STATS ────────────────────────────────────────── */}
      <motion.div variants={item}>
        <GameStats gami={gami} onOpenGame={onOpenGame} />
      </motion.div>

      {/* ── RECENT ACTIVITY ───────────────────────────────────── */}
      {activity.length > 0 && (
        <motion.div variants={item}>
          <div className="flex items-center gap-2 mb-3">
            <Zap size={11} style={{ color: '#22d3ee', filter: 'drop-shadow(0 0 6px rgba(34,211,238,0.8))' }} />
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.75)' }}>
              {t(language, 'recentActivity')}
            </p>
          </div>
          <div className="glass-card rounded-2xl overflow-hidden">
            {activity.map((a, i) => (
              <div key={i}
                className={`flex items-center gap-3 px-4 py-3.5 ${i < activity.length - 1 ? 'border-b' : ''}`}
                style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <div className="w-0.5 h-7 rounded-full flex-shrink-0"
                  style={{ background: a.pos ? 'linear-gradient(to bottom,#10b981,#059669)' : 'linear-gradient(to bottom,#f43f5e,#be123c)' }} />
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={a.pos
                    ? { background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.18)' }
                    : { background: 'rgba(244,63,94,0.10)',  border: '1px solid rgba(244,63,94,0.18)' }}>
                  {a.pos ? <ArrowDownLeft size={14} className="text-emerald-400" /> : <ArrowUpRight size={14} className="text-rose-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{a.desc}</p>
                  <p className="text-[10px] font-medium mt-0.5" style={{ color: 'rgba(148,163,184,0.6)' }}>{a.time}</p>
                </div>
                <span className={`font-black text-sm flex-shrink-0 ${a.pos ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {a.amount} {sym}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <ShareProfileCard
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        xp={totalXp}
        wins={totalWins}
        totalGames={totalGames}
        winRate={winRate}
      />
    </motion.div>
  );
}

function HeroStat({ label, value, color }) {
  return (
    <div className="rounded-2xl p-3 relative overflow-hidden"
      style={{ background: `${color}10`, border: `1px solid ${color}30` }}>
      <p className="font-orbitron text-base font-black leading-none" style={{ color }}>{value}</p>
      <p className="text-[9px] font-bold uppercase tracking-widest mt-1.5" style={{ color: 'rgba(148,163,184,0.7)' }}>
        {label}
      </p>
    </div>
  );
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

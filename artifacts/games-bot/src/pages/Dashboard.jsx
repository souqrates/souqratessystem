import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Gamepad2, ArrowUpRight, ArrowDownLeft, ShieldCheck, Flame, Zap, Coins,
  TrendingUp, User, Sparkles, ChevronRight, Pencil, Smartphone, Share2, Lock,
} from 'lucide-react';
import useAppStore from '../store/appStore';
import { t } from '../lib/i18n';
import GamificationCard from '../components/GamificationCard';
import PlayerRankCard from '../components/PlayerRankCard';
import ProfileEditModal from '../components/ProfileEditModal';
import DailyStreakCard from '../components/DailyStreakCard';
import ShareProfileCard from '../components/ShareProfileCard';
import { listLedger } from '../lib/payments';
import { supabase } from '../lib/supabase';
import { getVerifiedSession } from '../lib/telegram';
import { rankProgress } from '../lib/ranks';
import { fetchStreak, fetchGamification } from '../lib/gamification';
import { displayNameOf, avatarUrlOf, initialOf } from '../lib/profile';

const isSlowDevice = document.documentElement.classList.contains('device-low') || document.documentElement.classList.contains('device-mid');
// No stagger or opacity-0 on initial load — prevents cascade flash when dashboard first appears
const container = { animate: {} };
const item = { initial: {}, animate: {} };

// Only Solo is shipped today. PvP / Quad / Tournament will be added later;
// rather than ship dead "Coming Soon" cards, we hide them entirely.
const QUICK_MODES = [
  { id: 'solo', labelKey: 'soloLabel', icon: User, hex: '#22d3ee', glow: 'rgba(34,211,238,0.35)', descKey: 'beatYourBest', comingSoon: false },
];

export default function Dashboard() {
  const { user, wallet, language, appConfig, setCurrentPage, navigateToGames, refreshBalance, pwaInstallPrompt, setPwaInstallPrompt, games } = useAppStore();
  const [editOpen, setEditOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [totalXp, setTotalXp] = useState(0);
  const [totalGames, setTotalGames] = useState(0);
  const [activity, setActivity] = useState([]);
  const [streak, setStreak] = useState(null);
  const [gami, setGami] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function loadMine() {
      const sid = getVerifiedSession()?.session_id;
      if (!sid) return;
      const { data } = await supabase.rpc('gm_get_user_state', { p_session_id: sid });
      const gam = data?.gamification || {};
      if (!cancelled) {
        setTotalXp(Number(gam.xp || 0));
        setTotalGames(Number(gam.total_games || 0));
      }
      const [streakData, gamiData] = await Promise.all([fetchStreak(), fetchGamification()]);
      if (!cancelled) { setStreak(streakData); setGami(gamiData); }
    }
    async function loadActivity() {
      try {
        const rows = await listLedger({ limit: 6 });
        if (!cancelled && rows?.length) {
          setActivity(rows.map(r => {
            const isCredit = r.direction === 'credit';
            const amt = Number(r.amount_token || r.amount_usd || 0);
            const ago = timeAgo(r.created_at);
            return {
              desc: r.description || r.category?.replace(/_/g, ' ') || 'Transaction',
              amount: `${isCredit ? '+' : '-'}${amt.toLocaleString()}`,
              time: ago,
              pos: isCredit,
            };
          }));
        }
      } catch { /* ignore */ }
    }
    loadMine();
    loadActivity();
    return () => { cancelled = true; };
  }, [user?.telegram_id]);

  const sym         = appConfig?.currency_symbol || 'SKZ';
  const dashboardCta = (typeof appConfig?.dashboard_cta === 'string' && appConfig.dashboard_cta.trim())
    ? appConfig.dashboard_cta.trim()
    : null;

  // Feature flags — hide game modes the admin disabled
  const soloEnabled  = appConfig?.solo_games_enabled  !== false;
  const duoEnabled   = appConfig?.duo_games_enabled   !== false;
  const quadEnabled  = appConfig?.quad_games_enabled  !== false;
  const groupEnabled = appConfig?.group_games_enabled !== false;
  const visibleModes = QUICK_MODES.filter(({ id }) => {
    if (id === 'solo')  return soloEnabled;
    if (id === 'pvp')   return duoEnabled;
    if (id === 'quad')  return quadEnabled;
    if (id === 'group') return groupEnabled;
    return true;
  });
  const scBalance   = Number(wallet?.sc_balance) || 0;
  const trialActive = !!wallet?.trial_active;

  const totalWins  = Number(gami?.total_wins  || 0);
  const totalGamesPlayed = Number(gami?.total_games || totalGames || 0);
  const winRate = totalGamesPlayed > 0
    ? Math.round((totalWins / totalGamesPlayed) * 100)
    : 0;

  const initial = initialOf(user);
  const avatar  = avatarUrlOf(user);
  const dispName = displayNameOf(user);

  return (
    <motion.div
      className="px-4 pt-5 pb-8 space-y-5 relative z-10"
      variants={container}
      initial="initial"
      animate="animate"
    >
      {/* HERO */}
      <motion.div variants={item} className="glass-hero rounded-3xl p-5 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'rgba(34,211,238,0.20)' }} />
        <div className="absolute -bottom-16 -left-12 w-44 h-44 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'rgba(16,185,129,0.16)' }} />

        <div className="flex items-center gap-4 relative z-10">
          <button
            onClick={() => setEditOpen(true)}
            className="avatar-ring-wrap w-16 h-16 flex-shrink-0 relative group"
            aria-label="Edit profile"
            style={{ cursor: 'pointer' }}
          >
            <div className="avatar-ring-inner overflow-hidden">
              {avatar
                ? <img src={avatar} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
                : <span className="font-orbitron text-xl font-black text-white">{initial}</span>}
            </div>
            <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#0891b2,#22d3ee)', boxShadow: '0 4px 12px rgba(34,211,238,0.5)', border: '2px solid #0b1220' }}>
              <Pencil size={10} color="#fff" />
            </span>
          </button>

          <div className="flex-1 min-w-0">
            <button onClick={() => setEditOpen(true)} className="block text-left max-w-full">
              <h2 className="font-orbitron text-base font-black text-white truncate tracking-wide leading-snug">
                {dispName}
              </h2>
            </button>
            <p className="text-xs font-medium mt-0.5" style={{ color: 'rgba(148,163,184,0.85)' }}>
              @{user?.username || 'player'}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5">
              {trialActive ? (
                <>
                  <Sparkles size={10} style={{ color: '#fbbf24' }} />
                  <span className="text-[9px] font-black tracking-widest uppercase" style={{ color: '#fbbf24' }}>
                    Free Trial Active
                  </span>
                </>
              ) : (
                <>
                  <ShieldCheck size={10} style={{ color: '#10b981' }} />
                  <span className="text-[9px] font-black tracking-widest uppercase" style={{ color: '#10b981' }}>
                    Pro Member
                  </span>
                </>
              )}
              <span className="w-3 h-px" style={{ background: 'rgba(148,163,184,0.3)' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
              <span className="text-[9px] font-semibold text-emerald-400">Online</span>
            </div>
          </div>

          <div className="flex-shrink-0 text-right">
            <div className="flex items-center justify-end gap-2 mb-1">
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.7)' }}>
                Balance
              </p>
              <button
                onClick={() => setShareOpen(true)}
                className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.25)' }}
              >
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

        <div className="mt-5 mb-4 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.25), transparent)' }} />

        <div className="grid grid-cols-3 gap-2 relative z-10">
          <HeroStat label="Win Rate"  value={`${winRate}%`} color="#34d399" />
          <HeroStat label="Total XP"  value={totalXp.toLocaleString()} color="#22d3ee" />
          <HeroStat label="Matches"   value={totalGames.toLocaleString()} color="#f59e0b" />
        </div>
      </motion.div>

      {/* RANK SHOWCASE */}
      <motion.div variants={item}>
        <PlayerRankCard />
      </motion.div>

      {/* DAILY STREAK */}
      {(streak || gami) && (
        <motion.div variants={item}>
          <DailyStreakCard
            streak={streak}
            gami={gami}
            onClaimed={() => {
              fetchStreak().then(s => setStreak(s));
              fetchGamification().then(g => { setGami(g); setTotalXp(Number(g?.xp || 0)); });
            }}
          />
        </motion.div>
      )}

      {/* PLAY NOW */}
      <motion.button
        variants={item}
        onClick={() => setCurrentPage('games')}
        className="w-full py-4 rounded-2xl btn-primary btn-sweep play-pulse flex items-center justify-center gap-3"
        whileTap={{ scale: 0.96 }}
      >
        <Gamepad2 size={20} style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.5))' }} />
        <span className="text-sm tracking-[0.12em]">{dashboardCta || t(language, 'playNow')}</span>
        <Flame size={16} className="text-amber-300 ig-gold" />
      </motion.button>

      {/* ADD TO HOMESCREEN */}
      {pwaInstallPrompt && (
        <motion.button
          variants={item}
          onClick={async () => {
            try {
              pwaInstallPrompt.prompt();
              const result = await pwaInstallPrompt.userChoice;
              if (result.outcome === 'accepted') setPwaInstallPrompt(null);
            } catch { /* ignore */ }
          }}
          className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2.5"
          style={{
            background: 'rgba(6,182,212,0.08)',
            border: '1px solid rgba(6,182,212,0.25)',
          }}
          whileTap={{ scale: 0.96 }}
        >
          <Smartphone size={16} style={{ color: '#22d3ee' }} />
          <span className="text-xs font-black uppercase tracking-widest" style={{ color: '#22d3ee', fontFamily: 'Orbitron, sans-serif' }}>
            {t(language, 'addToHomeScreen')}
          </span>
        </motion.button>
      )}

      {/* QUICK MODES */}
      <motion.div variants={item}>
        <SectionTitle icon={Gamepad2} label={t(language, 'gameModes')} />
        <div className="grid grid-cols-2 gap-2.5">
          {visibleModes.map(({ id, labelKey, icon: Icon, hex, glow, descKey, comingSoon }) => (
            comingSoon ? (
              <div
                key={id}
                className="relative rounded-2xl p-3.5 text-left overflow-hidden"
                style={{
                  background: 'rgba(15,23,42,0.35)',
                  border: `1px solid ${hex}18`,
                  opacity: 0.7,
                  cursor: 'not-allowed',
                }}
              >
                {/* Shimmer animation */}
                <motion.div
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', repeatDelay: 4 }}
                  style={{
                    position: 'absolute', top: 0, left: 0, width: '40%', height: '100%',
                    background: `linear-gradient(90deg, transparent, ${hex}08, transparent)`,
                    pointerEvents: 'none',
                  }}
                />
                {/* Blur overlay */}
                <div className="absolute inset-0 rounded-2xl pointer-events-none"
                  style={{ backdropFilter: 'blur(0.5px)', background: 'rgba(0,0,0,0.18)' }} />

                <div className="relative z-10 flex items-center gap-2.5 mb-2.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: `${hex}12`, border: `1px solid ${hex}25` }}>
                    <Icon size={16} color={`${hex}80`} />
                  </div>
                  <p className="font-orbitron text-[13px] font-black tracking-wide" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    {t(language, labelKey)}
                  </p>
                </div>
                <p className="text-[10px] font-medium relative z-10" style={{ color: 'rgba(148,163,184,0.45)' }}>
                  {t(language, descKey)}
                </p>
                <div className="mt-2.5 flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-1">
                    <Lock size={9} color={hex} style={{ opacity: 0.8 }} />
                    <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: hex, opacity: 0.9 }}>
                      Coming Soon
                    </span>
                  </div>
                  <div style={{
                    padding: '2px 6px', borderRadius: 99,
                    background: `${hex}12`, border: `1px solid ${hex}28`,
                  }}>
                    <span style={{ fontSize: 7, fontWeight: 900, color: hex, letterSpacing: '0.08em' }}>LOCKED</span>
                  </div>
                </div>
              </div>
            ) : (
              <motion.button
                key={id}
                whileTap={{ scale: 0.96 }}
                onClick={() => navigateToGames(id === 'pvp' ? 'duo' : id)}
                className="relative rounded-2xl p-3.5 text-left overflow-hidden"
                style={{
                  background: 'rgba(15,23,42,0.55)',
                  border: `1px solid ${hex}30`,
                  boxShadow: `0 10px 24px -16px ${glow}`,
                }}
              >
                <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl pointer-events-none"
                  style={{ background: glow }} />
                <div className="relative z-10 flex items-center gap-2.5 mb-2.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: `${hex}1f`, border: `1px solid ${hex}40` }}>
                    <Icon size={16} color={hex} />
                  </div>
                  <p className="font-orbitron text-[13px] font-black tracking-wide text-white">{t(language, labelKey)}</p>
                </div>
                <p className="text-[10px] font-medium" style={{ color: 'rgba(148,163,184,0.75)' }}>{t(language, descKey)}</p>
                <div className="mt-2.5 flex items-center justify-between relative z-10">
                  <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: hex }}>
                    {t(language, 'playNowShort')}
                  </span>
                  <ChevronRight size={12} color={hex} />
                </div>
              </motion.button>
            )
          ))}
        </div>
      </motion.div>

      {/* GAMIFICATION CARD (rank pill + claim) */}
      <motion.div variants={item}>
        <GamificationCard />
      </motion.div>

      {/* Top-earners leaderboard moved to the Mother Bot (single central hub) —
          removed from here to avoid duplicating the same list across bots. */}

      {/* REAL BALANCE CARD */}
      <motion.div variants={item} className="glass-card rounded-2xl p-4 relative overflow-hidden"
        style={{ border: '1px solid rgba(16,185,129,0.20)' }}>
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'rgba(16,185,129,0.10)' }} />
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.30)' }}>
              <Coins size={16} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.7)' }}>Real Balance</p>
              <p className="text-[10px] font-semibold mt-0.5 flex items-center gap-1 text-emerald-400">
                <TrendingUp size={9} /> Withdrawable to TON
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-orbitron text-2xl font-black text-white leading-none">{scBalance.toLocaleString()}</p>
            <p className="text-[10px] font-bold mt-1 text-emerald-400">{sym}</p>
          </div>
        </div>
      </motion.div>

      {/* HOW TO EARN */}
      <motion.div variants={item}>
        <SectionTitle icon={Sparkles} label={t(language, 'howXpWorks')} />
        <div className="grid grid-cols-3 gap-2">
          <XpTile color="#22d3ee" label="Easy"   xp="150" />
          <XpTile color="#f59e0b" label="Medium" xp="250" />
          <XpTile color="#ef4444" label="Hard"   xp="500" />
        </div>
        <p className="text-[10px] mt-2 text-center" style={{ color: 'rgba(148,163,184,0.6)' }}>
          Win = full XP. Loss still earns 40% — every match progresses your rank.
        </p>
      </motion.div>

      {/* ACTIVITY */}
      <motion.div variants={item}>
        <SectionTitle icon={Zap} label={t(language, 'recentActivity')} />
        <div className="glass-card rounded-2xl overflow-hidden">
          {activity.map((a, i) => (
            <div key={i}
              className={`log-row flex items-center gap-3 px-4 py-3.5 ${i < activity.length - 1 ? 'border-b' : ''}`}
              style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <div className="w-0.5 h-7 rounded-full flex-shrink-0"
                style={{ background: a.pos ? 'linear-gradient(to bottom,#10b981,#059669)' : 'linear-gradient(to bottom,#f43f5e,#be123c)' }} />
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={a.pos
                  ? { background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.18)' }
                  : { background: 'rgba(244,63,94,0.10)',  border: '1px solid rgba(244,63,94,0.18)' }}>
                {a.pos
                  ? <ArrowDownLeft size={14} className="text-emerald-400" />
                  : <ArrowUpRight  size={14} className="text-rose-400" />}
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

      <ProfileEditModal open={editOpen} onClose={() => setEditOpen(false)} />
      <ShareProfileCard
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        xp={totalXp}
        wins={user?.win_count || 0}
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

function SectionTitle({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={11} style={{ color: '#22d3ee', filter: 'drop-shadow(0 0 6px rgba(34,211,238,0.8))' }} />
      <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.75)' }}>
        {label}
      </p>
    </div>
  );
}

function XpTile({ color, label, xp }) {
  return (
    <div className="rounded-2xl p-3 text-center relative overflow-hidden"
      style={{ background: `${color}10`, border: `1px solid ${color}30` }}>
      <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: `${color}cc` }}>{label}</p>
      <p className="font-orbitron text-xl font-black mt-1" style={{ color }}>+{xp}</p>
      <p className="text-[9px] font-bold uppercase tracking-widest mt-1" style={{ color: 'rgba(148,163,184,0.6)' }}>XP / Win</p>
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
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

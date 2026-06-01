import React, { useEffect, useState, useRef, lazy, Suspense, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import useAppStore from './store/appStore';
import { GAMES } from './constants';
import { initTelegramWebApp, getTelegramUser, verifyTelegramSession, getStartParam, getTelegramWebApp } from './lib/telegram';
import { warmSession } from './lib/session';
import { upsertUser as upsertMotherBotUser } from './lib/motherBot';
import { trackVisitor } from './manager/lib/managerDb';
import SplashScreen from './components/SplashScreen';
import Navbar from './components/Navbar';
import BottomNav from './components/BottomNav';
import NotificationSystem from './components/NotificationSystem';
import AdminAnnouncementBanner from './components/AdminAnnouncementBanner';
import AppErrorBoundary from './components/AppErrorBoundary';
import Dashboard from './pages/Dashboard';
import { SkeletonCard, SkeletonRow } from './components/Skeleton';

function PageSkeleton() {
  return (
    <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SkeletonCard height={100} />
      <SkeletonCard height={80} />
      {[0,1,2,3].map(i => <SkeletonRow key={i} />)}
    </div>
  );
}

const Games        = lazy(() => import('./pages/Games'));
const Contests     = lazy(() => import('./pages/Contests'));
const Wallet       = lazy(() => import('./pages/Wallet'));
const Achievements = lazy(() => import('./pages/Achievements'));
import GameModal from './components/games/GameModal';

function MaintenanceScreen({ appConfig }) {
  const title = appConfig?.app_title || 'Skill Games';
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#04030a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center', gap: 20 }}>
      <div style={{ fontSize: 56 }}>■</div>
      <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '0.05em' }}>{title}</h1>
      <p style={{ fontSize: 14, color: 'rgba(148,163,184,0.75)', lineHeight: 1.6, maxWidth: 280 }}>
        We are performing scheduled maintenance. We will be back shortly!
      </p>
      <div style={{ marginTop: 8, padding: '8px 20px', borderRadius: 99, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)' }}>
        <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Under Maintenance</span>
      </div>
    </div>
  );
}

class GameModalErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, msg: '', stack: '' }; }
  static getDerivedStateFromError(e) { return { hasError: true, msg: e?.message || String(e), stack: e?.stack?.split('\n').slice(0,5).join('\n') || '' }; }
  componentDidCatch(e, info) {
    if (import.meta.env.DEV) console.error('[GameModalError]', e, info?.componentStack);
    // Stale chunk after deploy → React.lazy() inside GameEngine throws.
    // Trigger the global recovery (one hard reload, guarded against loops)
    // so the user lands on the new bundle instead of staring at
    // "Could not open game". Falls through to the normal error UI if
    // recovery isn't possible (e.g. real JS bug, or reload already used).
    try { window.__skzRecoverFromChunkError?.(e); } catch { /* ignore */ }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 340, textAlign: 'center', padding: 28, borderRadius: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 42, marginBottom: 14, color: '#fbbf24' }}>!</div>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Could not open game</p>
            <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.75)', marginBottom: 20, lineHeight: 1.5 }}>
              Please try again. If the problem persists, close and reopen the app.
            </p>
            {this.state.msg && <p style={{ fontSize: 12, color: 'rgba(239,68,68,0.8)', marginBottom: 8, wordBreak: 'break-all', textAlign: 'left' }}>{this.state.msg}</p>}
            {this.state.stack && <pre style={{ fontSize: 9, color: 'rgba(148,163,184,0.5)', marginBottom: 14, wordBreak: 'break-all', textAlign: 'left', whiteSpace: 'pre-wrap' }}>{this.state.stack}</pre>}
            <button
              onClick={() => { this.setState({ hasError: false, msg: '', stack: '' }); this.props.onClose?.(); }}
              style={{ padding: '12px 28px', borderRadius: 14, background: 'linear-gradient(135deg, #06b6d4, #0ea5e9)', color: '#fff', fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: 14 }}
            >
              Close
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const isSlowDevice = document.documentElement.classList.contains('device-low') || document.documentElement.classList.contains('device-mid');
// On iOS, AnimatePresence mode="wait" produces a blank frame between pages:
// the exiting component is unmounted before the entering one mounts, and WebKit
// doesn't guarantee a synchronous repaint in between. Fix: skip transitions on
// iOS entirely (instant swap, no flicker) — same as isSlowDevice.
const isIos = document.documentElement.classList.contains('ios');
const pageVariants = (isSlowDevice || isIos)
  ? { initial: {}, animate: {}, exit: {} }
  : {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0.15, ease: 'easeOut' } },
      exit:    { opacity: 1 }, // stay visible — new page fades in on top
    };

const PAGES = { dashboard: Dashboard, games: Games, contests: Contests, wallet: Wallet, achievements: Achievements };

export default function App() {
  const [appReady, setAppReady] = useState(false);

  // App-level safety valve: even if SplashScreen never calls onDone
  // (broken timers, JS error in splash, etc.), force the app to become
  // interactive within 5 seconds so the user is never trapped on splash.
  useEffect(() => {
    const t = setTimeout(() => setAppReady(true), 5000);
    return () => clearTimeout(t);
  }, []);
  const [openGame, setOpenGame] = useState(null);
  const [openGameTiers, setOpenGameTiers] = useState(null);
  const [pendingRoom, setPendingRoom] = useState(null);
  const currentPage        = useAppStore(s => s.currentPage);
  const appConfig          = useAppStore(s => s.appConfig);
  const setUser            = useAppStore(s => s.setUser);
  const setCurrentPage     = useAppStore(s => s.setCurrentPage);
  const setPwaInstallPrompt = useAppStore(s => s.setPwaInstallPrompt);
  const loadRemoteConfig   = useAppStore(s => s.loadRemoteConfig);
  const refreshBalance     = useAppStore(s => s.refreshBalance);
  const subscribeBalance   = useAppStore(s => s.subscribeBalance);
  const unsubscribeBalance = useAppStore(s => s.unsubscribeBalance);

  // Track the last handled start_param to avoid processing the same deeplink twice
  const lastHandledSpRef = useRef('');
  const openGameRef = useRef(openGame);
  openGameRef.current = openGame;

  const handleBack = useCallback(() => {
    if (openGameRef.current) {
      // Give the active game a chance to intercept (and show a confirm
      // dialog) before we tear it down. GameModal listens for this
      // cancelable event during 'playing' and calls preventDefault.
      const ev = new CustomEvent('game-modal-back', { cancelable: true });
      const proceed = window.dispatchEvent(ev);
      if (!proceed) return;
      setOpenGame(null);
      setPendingRoom(null);
      refreshBalance();
    } else if (currentPage !== 'dashboard') {
      setCurrentPage('dashboard');
    }
  }, [currentPage, refreshBalance, setCurrentPage]);

  const handleBackRef = useRef(handleBack);
  handleBackRef.current = handleBack;

  // Sync Telegram BackButton with app navigation state
  useEffect(() => {
    const wa = getTelegramWebApp();
    if (!wa?.BackButton) return;
    const bb = wa.BackButton;
    const shouldShow = openGame !== null || currentPage !== 'dashboard';
    if (shouldShow) {
      bb.show();
    } else {
      bb.hide();
    }
    const handleBack = handleBackRef.current;
    bb.onClick(handleBack);
    return () => { bb.offClick(handleBack); };
  }, [currentPage, openGame]);

  function handleStartParam(sp) {
    if (!sp || sp === lastHandledSpRef.current) return;
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('contest') || sp.startsWith('contest_')) {
      lastHandledSpRef.current = sp;
      setCurrentPage('contests');
    } else if (sp.startsWith('room_')) {
      const parts = sp.slice(5).split('_');
      if (parts.length >= 2) {
        const roomId = parts[0];
        const gameId = Number(parts[1]);
        const roomType = parts[2] || 'pvp';
        const game = GAMES.find(g => g.id === gameId);
        if (game && roomId) {
          lastHandledSpRef.current = sp;
          if (openGameRef.current && Number(openGameRef.current.id) !== gameId) {
            setOpenGame(null);
            setPendingRoom(null);
          }
          setPendingRoom({ roomId, gameId, roomType });
          setOpenGame(game);
          setCurrentPage('games');
        }
      }
    }
  }

  useEffect(() => {
    const onInstallPrompt = (e) => { e.preventDefault(); setPwaInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', onInstallPrompt);

    const wa = initTelegramWebApp();

    // Fire all independent init tasks in parallel — don't await sequentially
    loadRemoteConfig();
    warmSession(); // warms session cache so first game action is instant

    // Handle deeplink on initial load
    const urlParams = new URLSearchParams(window.location.search);
    const sp = getStartParam() || urlParams.get('startapp') || '';
    handleStartParam(sp);
    if (!sp && urlParams.get('contest')) {
      setCurrentPage('contests');
    }

    const tgUser = getTelegramUser();
    if (tgUser) {
      const normalized = {
        ...tgUser,
        telegram_id: tgUser.telegram_id || tgUser.id,
      };
      setUser(normalized);
      trackVisitor(normalized);
    }

    verifyTelegramSession()
      .then((session) => {
        if (session?.telegram_id) {
          const u = useAppStore.getState().user || {};
          const mergedUser = {
            ...u,
            telegram_id: session.telegram_id,
            first_name: u.first_name || session.user?.first_name || 'Player',
            username:   u.username   || session.user?.username   || 'player',
          };
          setUser(mergedUser);
          // Provision user in Mother Bot (initData carries all user fields server-side)
          const sp = getStartParam();
          const referrerTelegramId = sp?.startsWith('ref_') ? sp.slice(4) : undefined;
          upsertMotherBotUser({ referrerTelegramId }).catch(() => {});
        }
        // refreshBalance and subscribeBalance in parallel
        Promise.all([refreshBalance(), Promise.resolve(subscribeBalance())]).catch(() => {});
      })
      .catch(() => {});

    let vhTimer = null;
    let recalc = null;
    let lastVh = '';
    const setVh = (px) => {
      const next = `${px}px`;
      if (next === lastVh) return; // idempotent — no needless re-layout/flicker
      lastVh = next;
      document.documentElement.style.setProperty('--tg-viewport-height', next);
    };
    if (wa) {
      recalc = () => {
        clearTimeout(vhTimer);
        vhTimer = setTimeout(() => {
          setVh(wa.viewportHeight || window.innerHeight);
        }, 250);
      };
      recalc();
      try { wa.onEvent('viewportChanged', recalc); } catch { /* ignore */ }
    } else {
      setVh(window.innerHeight);
    }

    // Re-check start_param when the app comes back to foreground.
    // Telegram sometimes doesn't reload the Mini App when a startapp link is
    // tapped while the app is already open — it just brings it back to front
    // without changing the URL. In that case the new start_param is available
    // in initDataUnsafe but the initial useEffect has already run.
    const onVis = () => {
      document.body.classList.toggle('is-hidden', document.hidden);
      if (!document.hidden) {
        const freshSp = getStartParam();
        if (freshSp && freshSp !== lastHandledSpRef.current) {
          handleStartParam(freshSp);
        }
      }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      clearTimeout(vhTimer);
      if (wa && recalc) { try { wa.offEvent('viewportChanged', recalc); } catch { /* ignore */ } }
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('beforeinstallprompt', onInstallPrompt);
      unsubscribeBalance();
    };
  }, []);

  const Page = useMemo(() => PAGES[currentPage] || Dashboard, [currentPage]);
  const inMaintenance = useMemo(() => appConfig?.maintenance_mode === true, [appConfig]);

  return (
    <div className="app-shell text-white select-none" style={{ background: '#04030a' }}>
      {/* Main app shell is ALWAYS mounted underneath the splash.
          When splash fades out, the app is already painted — no mass-mount flash. */}
      {inMaintenance ? (
        <MaintenanceScreen appConfig={appConfig} />
      ) : (
        <>
          {/* Use Fragment, NOT a wrapping <div>. The wrapping div broke
              flex:1 on <main className="scroll-area">: a non-flex parent
              meant main grew to its natural content height instead of
              filling the remaining viewport, so overflow-y:auto never
              activated and the entire page became unscrollable on mobile. */}
          <NotificationSystem />
          <AdminAnnouncementBanner />
          <Navbar />
          <main className="scroll-area max-w-xl mx-auto w-full">
            <AppErrorBoundary>
              {/* mode="wait" prevents two pages overlapping during transition */}
              <AnimatePresence initial={false} mode="wait">
                <motion.div
                  key={currentPage}
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  style={{ position: 'relative', background: '#04030a' }}
                >
                  <Suspense fallback={<PageSkeleton />}>
                    <Page onOpenGame={(g, tiers) => { setOpenGame(g); setOpenGameTiers(tiers || null); }} />
                  </Suspense>
                </motion.div>
              </AnimatePresence>
            </AppErrorBoundary>
          </main>
          <BottomNav />
        </>
      )}

      {/* Splash overlays everything; fades out over app that's already mounted */}
      <AnimatePresence initial={false}>
        {!appReady && <SplashScreen onDone={() => setAppReady(true)} />}
      </AnimatePresence>

      {openGame && createPortal(
        <GameModalErrorBoundary key={openGame.id} onClose={() => { setOpenGame(null); setPendingRoom(null); setOpenGameTiers(null); }}>
          <GameModal
            game={openGame}
            prefetchedTiers={openGameTiers}
            initialJoinCode={Number(pendingRoom?.gameId) === Number(openGame.id) ? pendingRoom.roomId : null}
            initialRoomType={Number(pendingRoom?.gameId) === Number(openGame.id) ? (pendingRoom.roomType || 'pvp') : null}
            onClose={() => { setOpenGame(null); setPendingRoom(null); setOpenGameTiers(null); refreshBalance(); }}
          />
        </GameModalErrorBoundary>,
        document.body
      )}
    </div>
  );
}

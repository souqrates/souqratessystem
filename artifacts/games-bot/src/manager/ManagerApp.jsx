import { useState, useEffect, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Gamepad2, Settings, Users, Eye, Shield, LogOut, ChevronRight, Menu, X, Wallet, Banknote, ArrowUpRight, Coins, Bot, Link2, FileDown, Megaphone, Plug, FileText, Globe, ShieldAlert, ChartBar as BarChart2, Trophy, UserCheck, MessageCircle, FlaskConical } from 'lucide-react';
import { checkIsAdmin, managerWebLogin, managerSetWebPasscode, listEconomySettings } from './lib/managerDb';
import { verifyTelegramSession } from '../lib/telegram';
import OverviewPage from './pages/OverviewPage';
import GamesPage from './pages/GamesPage';
import { ContentPage } from './pages/ContentPage';
import UsersPage from './pages/UsersPage';
import PreviewPage from './pages/PreviewPage';
import AdminsPage from './pages/AdminsPage';
import TreasuryPage from './pages/TreasuryPage';
import PayoutsPage from './pages/PayoutsPage';
import WithdrawalsPage from './pages/WithdrawalsPage';
import EconomyPage from './pages/EconomyPage';
import BotsPage from './pages/BotsPage';
import ReferralsPage from './pages/ReferralsPage';
import ReportsPage from './pages/ReportsPage';
import BroadcastsPage from './pages/BroadcastsPage';
import IntegrationsPage from './pages/IntegrationsPage';
import ContestsPage from './pages/ContestsPage';
import InfoPagesPage from './pages/InfoPagesPage';
import WalletPage from './pages/WalletPage';
import SecurityPage from './pages/SecurityPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AchievementsPage from './pages/AchievementsPage';
import FeeTiersPage from './pages/FeeTiersPage';
import InfluencersPage from './pages/InfluencersPage';
import ContactMessagesPage from './pages/ContactMessagesPage';

const MGR_LANGS = { en: 'EN', ar: 'عربي', ru: 'РУ' };

const MGR_I18N = {
  en: {
    overview:'Overview', economy:'Economy', feetiers:'Fee Tiers', adminwallet:'Wallet', treasury:'Treasury', payouts:'Payouts',
    withdrawals:'User Txns', games:'Games', contests:'Contests', content:'Content',
    infopages:'Info Pages', users:'Visitors', bots:'Smart Bots', referrals:'Referrals',
    reports:'Reports', broadcasts:'Broadcasts', integrations:'Integrations',
    preview:'Preview', security:'Security', admins:'Admins', analytics:'Analytics', achievements:'Achievements', influencers:'Influencers', contact:'Contact Msgs',
    manager:'MANAGER', controlPanel:'Control Panel',
    authenticating:'AUTHENTICATING', managerAccess:'MANAGER ACCESS',
    signIn:'Sign in', firstTimeSetup:'First-time setup',
    telegramId:'Telegram ID', passcode:'Passcode', newPasscode:'New Passcode',
    confirmPasscode:'Confirm Passcode', createSignIn:'CREATE & SIGN IN',
    signInBtn:'SIGN IN', logout:'Logout', live:'LIVE',
    orOpenTg:'Or open Manager from inside Telegram to sign in automatically.',
    enterValidTid:'Enter a valid Telegram ID.',
    enterPasscode:'Enter your passcode.',
    passMin8:'Passcode must be at least 8 characters.',
    passNoMatch:'Passcodes do not match.',
    invalidLogin:'Invalid Telegram ID or passcode. If this is your first time, switch to "First-time setup".',
    passExistsErr:'A passcode already exists for this admin. Use the sign-in form, or reset it from inside the dashboard.',
    notAdminErr:'This Telegram ID is not registered as an admin.',
    passSetFailed:'Passcode set, but login failed. Try signing in.',
    signInDesc:'Sign in with your Telegram ID & passcode',
    setupDesc:'Create your desktop passcode',
    sessionEnded:'Session ended.',
  },
  ar: {
    overview:'نظرة عامة', economy:'الاقتصاد', feetiers:'مستويات الرسوم', adminwallet:'المحفظة', treasury:'الخزينة', payouts:'المدفوعات',
    withdrawals:'معاملات المستخدم', games:'الألعاب', contests:'المسابقات', content:'المحتوى',
    infopages:'صفحات المعلومات', users:'الزوار', bots:'البوتات الذكية', referrals:'الإحالات',
    reports:'التقارير', broadcasts:'الإذاعات', integrations:'التكاملات',
    preview:'المعاينة', security:'الأمان', admins:'المشرفون', analytics:'التحليلات', achievements:'الإنجازات', influencers:'المؤثرون', contact:'رسائل التواصل',
    manager:'المدير', controlPanel:'لوحة التحكم',
    authenticating:'جاري المصادقة', managerAccess:'وصول المدير',
    signIn:'تسجيل الدخول', firstTimeSetup:'الإعداد الأولي',
    telegramId:'معرف تلغرام', passcode:'رمز المرور', newPasscode:'رمز مرور جديد',
    confirmPasscode:'تأكيد رمز المرور', createSignIn:'إنشاء وتسجيل الدخول',
    signInBtn:'تسجيل الدخول', logout:'تسجيل الخروج', live:'مباشر',
    orOpenTg:'أو افتح المدير من داخل تلغرام لتسجيل الدخول تلقائياً.',
    enterValidTid:'أدخل معرف تلغرام صالح.',
    enterPasscode:'أدخل رمز المرور.',
    passMin8:'رمز المرور يجب أن يكون 8 أحرف على الأقل.',
    passNoMatch:'رمز المرور غير متطابق.',
    invalidLogin:'معرف تلغرام أو رمز مرور غير صالح. إذا كانت هذه المرة الأولى، انتقل إلى "الإعداد الأولي".',
    passExistsErr:'يوجد رمز مرور لهذا المشرف. استخدم نموذج تسجيل الدخول.',
    notAdminErr:'معرف تلغرام هذا غير مسجل كمشرف.',
    passSetFailed:'تم تعيين رمز المرور ولكن فشل تسجيل الدخول. حاول تسجيل الدخول.',
    signInDesc:'سجل الدخول بمعرف تلغرام ورمز المرور',
    setupDesc:'أنشئ رمز مرور سطح المكتب',
    sessionEnded:'انتهت الجلسة.',
  },
  ru: {
    overview:'Обзор', economy:'Экономика', feetiers:'Уровни тарифов', adminwallet:'Кошелёк', treasury:'Казначейство', payouts:'Выплаты',
    withdrawals:'Транзакции', games:'Игры', contests:'Конкурсы', content:'Контент',
    infopages:'Инфо-страницы', users:'Посетители', bots:'Умные боты', referrals:'Рефералы',
    reports:'Отчёты', broadcasts:'Рассылки', integrations:'Интеграции',
    preview:'Просмотр', security:'Безопасность', admins:'Админы', analytics:'Аналитика', achievements:'Достижения', influencers:'Инфлюенсеры', contact:'Сообщения',
    manager:'МЕНЕДЖЕР', controlPanel:'Панель управления',
    authenticating:'АУТЕНТИФИКАЦИЯ', managerAccess:'ДОСТУП МЕНЕДЖЕРА',
    signIn:'Войти', firstTimeSetup:'Первоначальная настройка',
    telegramId:'Telegram ID', passcode:'Пароль', newPasscode:'Новый пароль',
    confirmPasscode:'Подтвердите пароль', createSignIn:'СОЗДАТЬ И ВОЙТИ',
    signInBtn:'ВОЙТИ', logout:'Выход', live:'LIVE',
    orOpenTg:'Или откройте Менеджер в Telegram для автоматического входа.',
    enterValidTid:'Введите корректный Telegram ID.',
    enterPasscode:'Введите пароль.',
    passMin8:'Пароль должен содержать минимум 8 символов.',
    passNoMatch:'Пароли не совпадают.',
    invalidLogin:'Неверный Telegram ID или пароль. Если вы впервые, переключитесь на "Первоначальная настройка".',
    passExistsErr:'Пароль уже существует. Используйте форму входа.',
    notAdminErr:'Этот Telegram ID не зарегистрирован как администратор.',
    passSetFailed:'Пароль установлен, но вход не удался. Попробуйте войти.',
    signInDesc:'Войдите с Telegram ID и паролем',
    setupDesc:'Создайте пароль для рабочего стола',
    sessionEnded:'Сессия завершена.',
  },
};

const mt = (lang, key) => MGR_I18N[lang]?.[key] || MGR_I18N.en[key] || key;
const MgrLangCtx = createContext('en');
export const useMgrLang = () => useContext(MgrLangCtx);

const NAV = [
  { id: 'overview',    key: 'overview',    icon: LayoutDashboard, color: '#00d4ff' },
  { id: 'economy',     key: 'economy',     icon: Coins,           color: '#10b981' },
  { id: 'feetiers',   key: 'feetiers',   icon: Coins,           color: '#f59e0b' },
  { id: 'adminwallet', key: 'adminwallet', icon: Wallet,          color: '#06b6d4' },
  { id: 'treasury',    key: 'treasury',    icon: Wallet,          color: '#10b981' },
  { id: 'payouts',     key: 'payouts',     icon: Banknote,        color: '#06b6d4' },
  { id: 'withdrawals', key: 'withdrawals', icon: ArrowUpRight,    color: '#f43f5e' },
  { id: 'games',       key: 'games',       icon: Gamepad2,        color: '#10b981' },
  { id: 'contests',    key: 'contests',    icon: Gamepad2,        color: '#22d3ee' },
  { id: 'content',     key: 'content',     icon: Settings,        color: '#f59e0b' },
  { id: 'infopages',   key: 'infopages',   icon: FileText,        color: '#06b6d4' },
  { id: 'users',       key: 'users',       icon: Users,           color: '#f97316' },
  { id: 'bots',        key: 'bots',        icon: Bot,             color: '#06b6d4' },
  { id: 'referrals',   key: 'referrals',   icon: Link2,           color: '#10b981' },
  { id: 'reports',     key: 'reports',     icon: FileDown,        color: '#f59e0b' },
  { id: 'broadcasts',  key: 'broadcasts',  icon: Megaphone,       color: '#00d4ff' },
  { id: 'integrations',key: 'integrations',icon: Plug,            color: '#10b981' },
  { id: 'analytics',   key: 'analytics',   icon: BarChart2,       color: '#00d4ff' },
  { id: 'achievements',key: 'achievements',icon: Trophy,          color: '#f59e0b' },
  { id: 'preview',     key: 'preview',     icon: Eye,             color: '#06b6d4' },
  { id: 'security',    key: 'security',    icon: ShieldAlert,     color: '#f97316' },
  { id: 'influencers', key: 'influencers', icon: UserCheck,       color: '#f59e0b' },
  { id: 'contact',     key: 'contact',     icon: MessageCircle,   color: '#10b981' },
  { id: 'admins',      key: 'admins',      icon: Shield,          color: '#ef4444' },
];

const PAGE_MAP = { overview: OverviewPage, economy: EconomyPage, feetiers: FeeTiersPage, adminwallet: WalletPage, treasury: TreasuryPage, payouts: PayoutsPage, withdrawals: WithdrawalsPage, games: GamesPage, contests: ContestsPage, content: ContentPage, infopages: InfoPagesPage, users: UsersPage, bots: BotsPage, referrals: ReferralsPage, reports: ReportsPage, broadcasts: BroadcastsPage, integrations: IntegrationsPage, analytics: AnalyticsPage, achievements: AchievementsPage, influencers: InfluencersPage, contact: ContactMessagesPage, preview: PreviewPage, security: SecurityPage, admins: AdminsPage };

export default function ManagerApp() {
  const [page, setPage]           = useState('overview');
  const [admin, setAdmin]         = useState(null);
  const [authState, setAuth]      = useState('loading'); // loading | gate | authed
  const [authErr, setAuthErr]     = useState('');
  const [sideOpen, setSide]       = useState(false);
  const [mgrLang, setMgrLang]     = useState(() => localStorage.getItem('mgr_lang') || 'en');
  const [isTestnet, setIsTestnet] = useState(false);
  const m = (key) => mt(mgrLang, key);
  const cycleLang = () => {
    const langs = Object.keys(MGR_LANGS);
    const next = langs[(langs.indexOf(mgrLang) + 1) % langs.length];
    setMgrLang(next);
    localStorage.setItem('mgr_lang', next);
  };

  useEffect(() => {
    (async () => {
      setAuth('loading');
      // Try cached desktop session first
      try {
        const raw = localStorage.getItem('skz_manager_web');
        if (raw) {
          const cached = JSON.parse(raw);
          if (cached?.telegram_id && cached?.exp && cached.exp > Date.now()) {
            const a = await checkIsAdmin(cached.telegram_id);
            if (a) { setAdmin(a); setAuth('authed'); return; }
          }
          localStorage.removeItem('skz_manager_web');
        }
      } catch { /* ignore */ }

      // Try Telegram session (mobile / WebApp)
      try {
        const session = await verifyTelegramSession();
        const tid = Number(session?.telegram_id);
        if (session && !session.guest && Number.isFinite(tid) && tid > 0) {
          const a = await checkIsAdmin(tid);
          if (a) { setAdmin(a); setAuth('authed'); return; }
        }
      } catch { /* fall through */ }

      setAuth('gate');
    })();
  }, []);

  useEffect(() => {
    if (!admin?.telegram_id) return;
    listEconomySettings(admin.telegram_id).then(rows => {
      const row = rows.find(r => r.key === 'testnet_mode');
      setIsTestnet(row?.value === 'true');
    }).catch(() => {});
  }, [admin?.telegram_id]);

  function handleLogout() {
    try { localStorage.removeItem('skz_manager_web'); } catch { /* ignore */ }
    setAdmin(null); setAuth('gate'); setAuthErr(m('sessionEnded'));
  }

  function handleWebAuth(adminRow) {
    try {
      localStorage.setItem('skz_manager_web', JSON.stringify({
        telegram_id: adminRow.telegram_id,
        exp: Date.now() + 1000 * 60 * 60 * 12, // 12h
      }));
    } catch { /* ignore */ }
    setAdmin(adminRow);
    setAuth('authed');
    setAuthErr('');
  }

  if (authState === 'loading') return (
    <div style={{ minHeight: '100vh', background: '#050813', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          style={{ width: 52, height: 52, border: '3px solid rgba(0,212,255,0.2)', borderTop: '3px solid #00d4ff', borderRadius: '50%', margin: '0 auto 16px' }} />
        <p style={{ fontFamily: 'Orbitron, sans-serif', color: '#00d4ff', fontSize: 13, letterSpacing: '0.15em' }}>{m('authenticating')}</p>
      </div>
    </div>
  );

  if (authState === 'gate') return (
    <GateScreen
      authErr={authErr}
      setAuthErr={setAuthErr}
      onWebAuth={handleWebAuth}
      m={m}
      mgrLang={mgrLang}
      cycleLang={cycleLang}
    />
  );

  const CurrentPage = PAGE_MAP[page] || OverviewPage;
  const isRtl = mgrLang === 'ar';

  return (
    <MgrLangCtx.Provider value={mgrLang}>
    <div dir={isRtl ? 'rtl' : 'ltr'} style={{ minHeight: '100vh', background: '#050813', display: 'flex', fontFamily: 'Inter, sans-serif' }}>
      {/* Mobile overlay */}
      <AnimatePresence>
        {sideOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSide(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40, display: 'none' }}
            className="mobile-overlay" />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside style={{
        width: 240, flexShrink: 0, background: 'rgba(255,255,255,0.02)', borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh',
      }}>
        {/* Logo */}
        <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, rgba(0,212,255,0.3), rgba(0,212,255,0.1))', border: '1px solid rgba(0,212,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LayoutDashboard size={17} color="#00d4ff" />
            </div>
            <div>
              <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 13, color: '#fff', margin: 0 }}>{m('manager')}</p>
              <p style={{ fontSize: 10, color: 'rgba(148,163,184,0.4)', margin: 0 }}>{m('controlPanel')}</p>
            </div>
          </div>
        </div>

        {/* Admin info */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,212,255,0.03)' }}>
          <p style={{ fontSize: 11, color: '#00d4ff', fontWeight: 700, margin: '0 0 1px' }}>{admin?.name}</p>
          <p style={{ fontSize: 10, color: 'rgba(148,163,184,0.4)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{admin?.role}</p>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {NAV.map(item => {
            const Icon = item.icon;
            const active = page === item.id;
            return (
              <motion.button key={item.id} whileTap={{ scale: 0.97 }} onClick={() => setPage(item.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left',
                  background: active ? `${item.color}14` : 'transparent',
                  borderLeft: active ? `3px solid ${item.color}` : '3px solid transparent',
                  transition: 'all 0.15s',
                }}>
                <Icon size={16} color={active ? item.color : 'rgba(148,163,184,0.45)'} />
                <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? '#fff' : 'rgba(148,163,184,0.55)', letterSpacing: '0.02em' }}>{m(item.key)}</span>
                {active && <ChevronRight size={13} color={item.color} style={{ marginLeft: 'auto' }} />}
              </motion.button>
            );
          })}
        </nav>

        {/* Logout */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleLogout}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'rgba(239,68,68,0.07)', color: '#ef4444' }}>
            <LogOut size={15} color="#ef4444" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>{m('logout')}</span>
          </motion.button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Testnet warning banner */}
        {isTestnet && (
          <div style={{ background: 'rgba(251,191,36,0.12)', borderBottom: '2px solid rgba(251,191,36,0.5)', padding: '10px 28px', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, zIndex: 20 }}>
            <FlaskConical size={16} color="#fbbf24" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.06em' }}>TESTNET MODE ACTIVE</span>
            <span style={{ fontSize: 12, color: 'rgba(251,191,36,0.7)', marginLeft: 8 }}>— Simulated transactions only. Disable in Economy settings before going live.</span>
          </div>
        )}
        {/* Top bar */}
        <div style={{ height: 60, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 12, position: 'sticky', top: isTestnet ? 44 : 0, background: '#050813', zIndex: 10 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 15, color: '#fff', margin: 0 }}>
              {m(NAV.find(n => n.id === page)?.key || 'overview')}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.button whileTap={{ scale: 0.94 }} onClick={cycleLang}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', color: 'rgba(148,163,184,0.7)', fontSize: 11, fontWeight: 700 }}>
              <Globe size={13} /> {MGR_LANGS[mgrLang]}
            </motion.button>
            <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }} transition={{ duration: 2, repeat: Infinity }}
              style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
            <span style={{ fontSize: 11, color: 'rgba(148,163,184,0.5)', fontWeight: 600 }}>{m('live')}</span>
          </div>
        </div>

        {/* Page */}
        <div style={{ flex: 1, padding: '28px', maxWidth: 1200 }}>
          <AnimatePresence mode="wait">
            <motion.div key={page} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
              <CurrentPage adminId={admin?.telegram_id} />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
    </MgrLangCtx.Provider>
  );
}

function GateScreen({ authErr, setAuthErr, onWebAuth, m, mgrLang, cycleLang }) {
  const [mode, setMode] = useState('login'); // 'login' | 'setup'
  const [tid, setTid] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [busy, setBusy] = useState(false);

  async function submitLogin(e) {
    e.preventDefault();
    setAuthErr('');
    const n = Number(tid);
    if (!Number.isFinite(n) || n <= 0) { setAuthErr(m('enterValidTid')); return; }
    if (!pass) { setAuthErr(m('enterPasscode')); return; }
    setBusy(true);
    const a = await managerWebLogin(n, pass);
    setBusy(false);
    if (a) onWebAuth(a);
    else setAuthErr(m('invalidLogin'));
  }

  async function submitSetup(e) {
    e.preventDefault();
    setAuthErr('');
    const n = Number(tid);
    if (!Number.isFinite(n) || n <= 0) { setAuthErr(m('enterValidTid')); return; }
    if (!pass || pass.length < 8) { setAuthErr(m('passMin8')); return; }
    if (pass !== pass2) { setAuthErr(m('passNoMatch')); return; }
    setBusy(true);
    const err = await managerSetWebPasscode(n, pass);
    if (err) {
      setBusy(false);
      if (err.includes('current_passcode_invalid')) {
        setAuthErr(m('passExistsErr'));
      } else if (err.includes('not_admin')) {
        setAuthErr(m('notAdminErr'));
      } else if (err.includes('passcode_too_short')) {
        setAuthErr(m('passMin8'));
      } else {
        setAuthErr(err);
      }
      return;
    }
    const a = await managerWebLogin(n, pass);
    setBusy(false);
    if (a) onWebAuth(a);
    else setAuthErr(m('passSetFailed'));
  }

  const isSetup = mode === 'setup';
  return (
    <div style={{ minHeight: '100vh', background: '#050813', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        style={{ width: '100%', maxWidth: 440, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,212,255,0.18)', borderRadius: 24, padding: 32, boxShadow: '0 0 80px rgba(0,212,255,0.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(0,212,255,0.05))', border: '2px solid rgba(0,212,255,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <Shield size={26} color="#00d4ff" />
          </div>
          <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 19, color: '#fff', margin: '0 0 4px' }}>{m('managerAccess')}</p>
          <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.55)', margin: 0 }}>
            {isSetup ? m('setupDesc') : m('signInDesc')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 18, padding: 4, background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
          {[
            { id: 'login', label: m('signIn') },
            { id: 'setup', label: m('firstTimeSetup') },
          ].map(t => (
            <button key={t.id} onClick={() => { setMode(t.id); setAuthErr(''); }}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: 11, letterSpacing: '0.06em',
                background: mode === t.id ? 'rgba(0,212,255,0.15)' : 'transparent',
                color: mode === t.id ? '#00d4ff' : 'rgba(148,163,184,0.6)',
              }}>{t.label}</button>
          ))}
        </div>

        <form onSubmit={isSetup ? submitSetup : submitLogin} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ fontSize: 11, color: 'rgba(148,163,184,0.7)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{m('telegramId')}</label>
          <input value={tid} onChange={e => setTid(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric"
            placeholder="e.g. 8763315766" autoComplete="username"
            style={inputStyle} />

          <label style={{ fontSize: 11, color: 'rgba(148,163,184,0.7)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 6 }}>{isSetup ? m('newPasscode') : m('passcode')}</label>
          <input type="password" value={pass} onChange={e => setPass(e.target.value)}
            placeholder={isSetup ? 'At least 8 characters' : 'Your passcode'}
            autoComplete={isSetup ? 'new-password' : 'current-password'}
            style={inputStyle} />

          {isSetup && (
            <>
              <label style={{ fontSize: 11, color: 'rgba(148,163,184,0.7)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 6 }}>{m('confirmPasscode')}</label>
              <input type="password" value={pass2} onChange={e => setPass2(e.target.value)}
                placeholder="Re-enter passcode" autoComplete="new-password"
                style={inputStyle} />
            </>
          )}

          {authErr && (
            <p style={{ color: '#ef4444', fontSize: 12, margin: '6px 0 0', lineHeight: 1.5 }}>{authErr}</p>
          )}

          <motion.button type="submit" disabled={busy} whileTap={{ scale: 0.97 }}
            style={{ marginTop: 14, width: '100%', padding: '14px 0', borderRadius: 12, border: '1px solid rgba(0,212,255,0.4)',
              background: 'linear-gradient(135deg, rgba(0,212,255,0.22), rgba(0,212,255,0.08))',
              color: '#00d4ff', fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 13, letterSpacing: '0.12em',
              cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1,
              boxShadow: '0 0 30px rgba(0,212,255,0.1)' }}>
            {busy ? '...' : isSetup ? m('createSignIn') : m('signInBtn')}
          </motion.button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(148,163,184,0.4)', marginTop: 18, lineHeight: 1.5 }}>
          {m('orOpenTg')}
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
          <motion.button whileTap={{ scale: 0.94 }} onClick={cycleLang}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', color: 'rgba(148,163,184,0.6)', fontSize: 11, fontWeight: 700 }}>
            <Globe size={13} /> {MGR_LANGS[mgrLang]}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '12px 14px', borderRadius: 10,
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
  color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit',
  boxSizing: 'border-box',
};

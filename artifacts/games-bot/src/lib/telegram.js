export const getTelegramWebApp = () =>
  typeof window !== 'undefined' ? window.Telegram?.WebApp : null;

export const initTelegramWebApp = () => {
  const wa = getTelegramWebApp();
  if (!wa) return wa;
  wa.ready();
  try { wa.disableVerticalSwipes?.(); } catch { /* older clients */ }
  try { wa.lockOrientation?.(); } catch { /* not supported */ }
  try { wa.enableClosingConfirmation?.(); } catch { /* ignore */ }
  // Single deferred expand — avoids double viewport resize that causes flash
  setTimeout(() => {
    wa.expand();
    try { wa.disableVerticalSwipes?.(); } catch { /* ignore */ }
    if (typeof wa.isVersionAtLeast === 'function' && wa.isVersionAtLeast('8.0')) {
      try { wa.requestFullscreen?.(); } catch { /* ignore */ }
    }
  }, 50);

  return wa;
};

const supportsFullscreen = (wa) =>
  !!wa && typeof wa.isVersionAtLeast === 'function' && wa.isVersionAtLeast('8.0');

export const requestFullscreen = () => {
  const wa = getTelegramWebApp();
  if (!supportsFullscreen(wa)) return;
  try { wa.requestFullscreen?.(); } catch { /* ignore */ }
};

export const exitFullscreen = () => {
  const wa = getTelegramWebApp();
  if (!supportsFullscreen(wa)) return;
  try { wa.exitFullscreen?.(); } catch { /* ignore */ }
};

let _lastHapticAt = 0;
const HAPTIC_MIN_INTERVAL_MS = 40;

export const triggerHaptic = (style = 'light') => {
  const wa = getTelegramWebApp();
  if (!wa?.HapticFeedback) return;
  const now = Date.now();
  const isNotification = style === 'success' || style === 'error' || style === 'warning';
  if (!isNotification && now - _lastHapticAt < HAPTIC_MIN_INTERVAL_MS) return;
  _lastHapticAt = now;
  const hf = wa.HapticFeedback;
  try {
    if (style === 'success') hf.notificationOccurred('success');
    else if (style === 'error') hf.notificationOccurred('error');
    else if (style === 'warning') hf.notificationOccurred('warning');
    else hf.impactOccurred(style);
  } catch { /* ignore */ }
};

export const getTelegramUser = () =>
  getTelegramWebApp()?.initDataUnsafe?.user || null;

export const getInitData = () => getTelegramWebApp()?.initData || '';

export const getStartParam = () =>
  getTelegramWebApp()?.initDataUnsafe?.start_param || '';

let _verifiedSession = null;
let _verifyInFlight = null;

const TG_SESSION_KEY = 'skz_tg_session';
const GUEST_SESSION_KEY = 'skz_guest_session';
const GUEST_NAME_KEY = 'skz_guest_name';

const SESSION_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

export function isSessionValid(session) {
  if (!session?.session_id) return false;
  if (!session.expires_at) return true;
  return new Date(session.expires_at).getTime() > Date.now() + SESSION_EXPIRY_BUFFER_MS;
}

function readCachedTgSession() {
  try {
    const raw = localStorage.getItem(TG_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isSessionValid(parsed)) return null;
    return parsed;
  } catch { return null; }
}

function cacheTgSession(data) {
  try {
    localStorage.setItem(TG_SESSION_KEY, JSON.stringify({
      session_id: data.session_id,
      telegram_id: data.telegram_id,
      expires_at: data.expires_at,
      user: data.user,
    }));
  } catch { /* ignore */ }
}

const getGuestName = () => {
  try {
    return localStorage.getItem(GUEST_NAME_KEY) || 'Guest';
  } catch { return 'Guest'; }
};

const readCachedGuestSession = () => {
  try {
    const raw = localStorage.getItem(GUEST_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.session_id || !parsed?.telegram_id) return null;
    if (!isSessionValid(parsed)) return null;
    return parsed;
  } catch { return null; }
};

function getSupabaseBase() {
  return import.meta.env.VITE_SUPABASE_URL || '';
}

async function createGuestSession() {
  const cached = readCachedGuestSession();
  if (cached) {
    return {
      ok: true,
      session_id: cached.session_id,
      telegram_id: cached.telegram_id,
      user: { id: cached.telegram_id, first_name: cached.first_name || getGuestName(), username: '', language_code: 'en' },
      start_param: '',
      expires_at: cached.expires_at,
      guest: true,
    };
  }

  const name = getGuestName();
  const url = `${getSupabaseBase()}/rest/v1/rpc/pay_create_guest_session`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ p_guest_tg_id: null, p_first_name: name }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.session_id) return null;
    try {
      localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify({
        session_id: data.session_id,
        telegram_id: data.telegram_id,
        expires_at: data.expires_at,
        first_name: name,
      }));
    } catch { /* ignore */ }
    return {
      ok: true,
      session_id: data.session_id,
      telegram_id: data.telegram_id,
      user: { id: data.telegram_id, first_name: name, username: '', language_code: 'en' },
      start_param: '',
      expires_at: data.expires_at,
      guest: true,
    };
  } catch { return null; }
}

async function verifyInitDataOnce(initData) {
  const url = `${getSupabaseBase()}/functions/v1/verify_init_data`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ initData }),
  });
  if (!res.ok) throw new Error(`verify_${res.status}`);
  const data = await res.json();
  if (!data?.ok) throw new Error('verify_rejected');
  return data;
}

export const verifyTelegramSession = async () => {
  if (_verifiedSession && isSessionValid(_verifiedSession)) return _verifiedSession;

  if (_verifyInFlight) return _verifyInFlight;

  _verifyInFlight = _doVerify();
  try {
    return await _verifyInFlight;
  } finally {
    _verifyInFlight = null;
  }
};

const REVALIDATE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

function isFreshSession(session) {
  if (!session?.expires_at) return false;
  return new Date(session.expires_at).getTime() > Date.now() + REVALIDATE_THRESHOLD_MS;
}

async function _doVerify() {
  const cached = readCachedTgSession();
  const initData = getInitData();

  if (initData) {
    // Skip network call if session is fresh (more than 1h remaining)
    if (cached && isFreshSession(cached)) {
      _verifiedSession = cached;
      return cached;
    }
    if (cached && isSessionValid(cached)) {
      _verifiedSession = cached;
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const data = await verifyInitDataOnce(initData);
        _verifiedSession = data;
        cacheTgSession(data);
        try { localStorage.removeItem(GUEST_SESSION_KEY); } catch { /* ignore */ }
        return data;
      } catch {
        if (attempt < 2) await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
      }
    }
    if (cached && isSessionValid(cached)) return cached;

    const guest = await createGuestSession();
    if (guest) {
      _verifiedSession = guest;
      return guest;
    }
    return cached || null;
  }

  if (cached && isSessionValid(cached)) {
    _verifiedSession = cached;
    return cached;
  }

  const guest = await createGuestSession();
  if (guest) {
    _verifiedSession = guest;
    return guest;
  }
  return null;
}

export const getVerifiedSession = () => _verifiedSession;

export const refreshSession = async () => {
  const old = _verifiedSession;
  _verifiedSession = null;
  try { localStorage.removeItem(TG_SESSION_KEY); } catch { /* ignore */ }
  try { localStorage.removeItem(GUEST_SESSION_KEY); } catch { /* ignore */ }
  // Invalidate session.js memory cache too
  try {
    const { invalidateSessionCache } = await import('./session');
    invalidateSessionCache();
  } catch { /* ignore */ }
  const fresh = await verifyTelegramSession();
  if (!fresh && old && isSessionValid(old)) {
    _verifiedSession = old;
    return old;
  }
  return fresh;
};

export const showTelegramConfirm = (message, callback) => {
  const wa = getTelegramWebApp();
  if (wa?.showConfirm) {
    wa.showConfirm(message, callback);
  } else {
    callback(window.confirm(message));
  }
};

export const showTelegramAlert = (message, callback) => {
  const wa = getTelegramWebApp();
  if (wa?.showAlert) {
    wa.showAlert(message, callback);
  } else {
    window.alert(message);
    callback?.();
  }
};

export const setTelegramTheme = () => {
  const wa = getTelegramWebApp();
  if (!wa) return;
  try { wa.setHeaderColor('#04030a'); } catch { /* older clients */ }
  try { wa.setBackgroundColor('#04030a'); } catch { /* ignore */ }
  const tgBg = wa.themeParams?.bg_color;
  if (tgBg) {
    document.documentElement.style.setProperty('--tg-bg', tgBg);
  }
};

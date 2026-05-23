import { verifyTelegramSession, getVerifiedSession, isSessionValid } from './telegram';

const TG_SESSION_KEY    = 'skz_tg_session';
const GUEST_SESSION_KEY = 'skz_guest_session';

// In-flight promise so concurrent callers share one network request
let _inflight = null;
// Resolved session_id cached in memory (fastest path)
let _cachedId = null;

function readAnyLocalSession() {
  for (const key of [TG_SESSION_KEY, GUEST_SESSION_KEY]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed?.session_id && isSessionValid(parsed)) return parsed;
    } catch { /* ignore */ }
  }
  return null;
}

export async function getSessionId() {
  // 1. Fastest: in-memory cache
  if (_cachedId) return _cachedId;

  // 2. Fast: already-verified in-memory session
  const s = getVerifiedSession();
  if (s?.session_id && isSessionValid(s)) {
    _cachedId = s.session_id;
    return _cachedId;
  }

  // 3. Fast: localStorage session (no network)
  const local = readAnyLocalSession();
  if (local?.session_id) {
    _cachedId = local.session_id;
    return _cachedId;
  }

  // 4. Network: deduplicate concurrent calls
  if (!_inflight) {
    _inflight = verifyTelegramSession().finally(() => { _inflight = null; });
  }
  const verified = await _inflight;
  if (verified?.session_id) {
    _cachedId = verified.session_id;
    return _cachedId;
  }

  return null;
}

// Called by App.jsx at startup — warms session so first game action is instant
export async function warmSession() {
  try {
    const id = await getSessionId();
    return id;
  } catch { return null; }
}

// Invalidate cache when session is explicitly refreshed
export function invalidateSessionCache() {
  _cachedId = null;
}

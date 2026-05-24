import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import './index.css'
import App from './App.jsx'
import AppErrorBoundary from './components/AppErrorBoundary.jsx'
import { getDeviceTier } from './lib/deviceProfile.js'
import { setTelegramTheme } from './lib/telegram.js'

// ── Stale-chunk recovery ─────────────────────────────────────────────────────
// After a deploy, Vite emits new hashed JS filenames. A page that was opened
// before the deploy still points at the OLD filenames; dynamic import() then
// gets the SPA index.html fallback and the browser refuses it with
// "text/html is not a valid JavaScript MIME type" or "Failed to fetch
// dynamically imported module". We catch both signals and hard-reload the
// page ONCE so the user transparently lands on the new bundle. A sessionStorage
// guard prevents an infinite reload loop if the failure is something else.
const RELOAD_GUARD_KEY = 'skz_chunk_reload_at';
function shouldAutoReload() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
    // Allow one auto-reload per 30s window — anything tighter is a real bug.
    return Date.now() - last > 30_000;
  } catch { return true; }
}
function markReload() {
  try { sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now())); } catch { /* ignore */ }
}
function isStaleChunkError(err) {
  const msg = String(err?.message || err || '');
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('is not a valid JavaScript MIME type') ||
    msg.includes("'text/html' is not a valid JavaScript MIME") ||
    msg.includes('Loading chunk') && msg.includes('failed') ||
    msg.includes('Loading CSS chunk')
  );
}
function maybeRecoverFromChunkError(err) {
  if (!isStaleChunkError(err)) return false;
  if (!shouldAutoReload()) return false;
  markReload();
  // Hard reload, bypassing in-memory cache where supported.
  try { window.location.reload(); } catch { window.location.href = window.location.href; }
  return true;
}
// Vite-specific: emitted before dynamic import rejects.
window.addEventListener('vite:preloadError', (event) => {
  if (maybeRecoverFromChunkError(event?.payload)) event.preventDefault?.();
});
// Catch any unhandled promise rejection from a dynamic import.
window.addEventListener('unhandledrejection', (event) => {
  if (maybeRecoverFromChunkError(event?.reason)) event.preventDefault?.();
});
// Catch <script>/CSS load failures (capture-phase since error events don't bubble).
window.addEventListener('error', (event) => {
  // Only handle network-style resource errors, not generic JS exceptions.
  const target = event?.target;
  if (target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK')) {
    if (shouldAutoReload()) {
      markReload();
      try { window.location.reload(); } catch { /* ignore */ }
    }
  } else if (maybeRecoverFromChunkError(event?.error)) {
    event.preventDefault?.();
  }
}, true);
// Expose so React error boundary / lazy fallbacks can opt in.
window.__skzRecoverFromChunkError = maybeRecoverFromChunkError;

const tier = getDeviceTier();
document.documentElement.classList.add(`device-${tier}`);

// Apply Telegram header/background color immediately before first React paint
setTelegramTheme();

const motionReducedMotion = tier === 'low' ? 'always' : tier === 'mid' ? 'user' : 'never';
const isProduction = import.meta.env.PROD;
const defaultTransition = { type: 'tween', duration: 0.1 };

const app = (
  <MotionConfig reducedMotion={motionReducedMotion} transition={defaultTransition}>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </MotionConfig>
);

createRoot(document.getElementById('root')).render(
  isProduction ? app : <StrictMode>{app}</StrictMode>
)

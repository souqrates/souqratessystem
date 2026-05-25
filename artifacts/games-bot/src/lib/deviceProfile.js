// Device performance classification: 'high' | 'mid' | 'low'
// Measured once per session at app startup, cached in sessionStorage.
// The benchmark is intentionally small to avoid blocking the main thread on weak devices.

const STORAGE_KEY = 'skz_device_tier';

function measure() {
  let score = 0;

  try {
    // CPU cores
    const cores = navigator.hardwareConcurrency || 2;
    if (cores >= 8) score += 3;
    else if (cores >= 4) score += 2;
    else score += 0;

    // RAM
    const ram = navigator.deviceMemory || 1;
    if (ram >= 6) score += 3;
    else if (ram >= 3) score += 2;
    else score += 0;

    // Fast-path: clearly low-end — skip expensive checks
    if (cores <= 2 && ram <= 1) return 'low';

    // Network (bonus only — don't penalise for unknown)
    const conn = navigator.connection;
    if (conn) {
      if (conn.effectiveType === '4g') score += 1;
      else if (conn.effectiveType === '3g') score += 0;
      else score -= 1;
    }

    // WebGL renderer — detect low-end GPU strings
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1; canvas.height = 1;
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        if (ext) {
          const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL).toLowerCase();
          const lowGpu = ['adreno 3', 'adreno 4', 'mali-4', 'mali-t', 'powervr sgx', 'gc7000', 'vivante'];
          const midGpu = ['adreno 5', 'mali-g5', 'apple a9', 'apple a10'];
          if (lowGpu.some(k => renderer.includes(k))) score -= 2;
          else if (midGpu.some(k => renderer.includes(k))) score += 0;
          else score += 1;
        }
        // Release context to avoid memory leak
        const ext2 = gl.getExtension('WEBGL_lose_context');
        if (ext2) ext2.loseContext();
      }
    } catch (_) { /* WebGL unavailable — skip */ }

    // Micro-benchmark: small loop (~5k iters) to gauge JS speed without blocking
    try {
      const t0 = performance.now();
      let x = 0;
      for (let i = 0; i < 5_000; i++) x += Math.sin(i) * Math.cos(i);
      const elapsed = performance.now() - t0;
      // Scale thresholds proportionally from the original 500k benchmark
      if (elapsed < 0.15) score += 2;
      else if (elapsed < 0.35) score += 1;
      else score -= 1;
      void x;
    } catch (_) { /* skip if performance API unavailable */ }
  } catch (_) {
    // Any unexpected failure → safe 'mid' default
    return 'mid';
  }

  if (score >= 7) return 'high';
  if (score >= 3) return 'mid';
  return 'low';
}

let _tier = null;

export function getDeviceTier() {
  if (_tier) return _tier;
  try {
    const cached = sessionStorage.getItem(STORAGE_KEY);
    if (cached === 'high' || cached === 'mid' || cached === 'low') {
      _tier = cached;
      return _tier;
    }
  } catch (_) { /* sessionStorage blocked */ }
  _tier = measure();
  try { sessionStorage.setItem(STORAGE_KEY, _tier); } catch (_) { /* ignore */ }
  return _tier;
}

export const isLowEnd  = () => getDeviceTier() === 'low';
export const isMidEnd  = () => getDeviceTier() === 'mid';

// iOS / iPadOS detection. iPadOS 13+ reports as Mac with touch points, so
// check both userAgent and the Mac+touch combo. Used to disable expensive
// effects (backdrop-filter blur, infinite shimmer text) that flicker on
// iOS Safari / Telegram WebView when they share a compositor layer.
let _isIOS = null;
export function isIOS() {
  if (_isIOS !== null) return _isIOS;
  try {
    const ua = navigator.userAgent || '';
    const iOSUA = /iPad|iPhone|iPod/.test(ua);
    const iPadOS = ua.includes('Mac') && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1;
    _isIOS = iOSUA || iPadOS;
  } catch (_) {
    _isIOS = false;
  }
  return _isIOS;
}
export const isHighEnd = () => getDeviceTier() === 'high';

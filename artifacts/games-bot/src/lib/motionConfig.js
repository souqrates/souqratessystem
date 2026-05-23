// Adaptive Framer Motion transition presets based on device tier.
// Use these instead of hardcoded transition objects.

import { getDeviceTier } from './deviceProfile';

function buildPresets(tier) {
  if (tier === 'low') {
    return {
      // Near-instant transitions for low-end: still animate but very short
      fast: { duration: 0.08, ease: 'linear' },
      normal: { duration: 0.12, ease: 'easeOut' },
      slow: { duration: 0.15, ease: 'easeOut' },
      spring: { type: 'tween', duration: 0.1, ease: 'easeOut' },
      // Disable infinite/repeating decorative animations
      disableInfinite: true,
      // Reduce initial/exit complexity
      pageEnter: { opacity: 0 },
      pageExit: { opacity: 0 },
      pageEnterAnim: { opacity: 1 },
    };
  }
  if (tier === 'mid') {
    return {
      fast: { duration: 0.15, ease: 'easeOut' },
      normal: { duration: 0.22, ease: 'easeOut' },
      slow: { duration: 0.3, ease: 'easeOut' },
      spring: { type: 'spring', stiffness: 220, damping: 28 },
      disableInfinite: false,
      pageEnter: { opacity: 0, y: 8 },
      pageExit: { opacity: 0 },
      pageEnterAnim: { opacity: 1, y: 0 },
    };
  }
  // high
  return {
    fast: { duration: 0.2, ease: 'easeOut' },
    normal: { duration: 0.3, ease: 'easeOut' },
    slow: { duration: 0.45, ease: 'easeOut' },
    spring: { type: 'spring', stiffness: 320, damping: 26 },
    disableInfinite: false,
    pageEnter: { opacity: 0, y: 12 },
    pageExit: { opacity: 0 },
    pageEnterAnim: { opacity: 1, y: 0 },
  };
}

let _presets = null;
export function getMotionPresets() {
  if (!_presets) _presets = buildPresets(getDeviceTier());
  return _presets;
}

// Returns true if infinite/looping decorative animations should be suppressed
export function shouldDisableInfiniteAnimations() {
  return getMotionPresets().disableInfinite;
}

// Returns 8 for high-end, 3 for mid, 0 for low (used by decorative loops).
// Capped on high-end: Infinity keeps GPU busy for all decorative elements simultaneously.
export function loopCount() {
  const tier = getDeviceTier();
  if (tier === 'low') return 0;
  if (tier === 'mid') return 3;
  return 8;
}

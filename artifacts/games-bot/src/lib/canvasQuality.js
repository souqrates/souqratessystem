// Adaptive canvas quality settings based on device tier.
// Import getQuality() in game files to adjust rendering fidelity.

import { getDeviceTier } from './deviceProfile';

const PRESETS = {
  high: {
    targetFps: 60,
    particleMultiplier: 1.0,   // 100% of particle count
    shadowBlur: true,           // enable ctx.shadowBlur
    shadowScale: 1.0,           // full shadow radius
    gradientCache: false,       // recreate gradients freely
    ambientParticles: true,     // sparkles, ambient effects
    trailLength: 12,            // ball/trail trail length
    enableGlow: true,
    enableBackdropBlur: true,
  },
  mid: {
    targetFps: 45,
    particleMultiplier: 0.5,
    shadowBlur: true,
    shadowScale: 0.5,
    gradientCache: true,        // cache gradients between frames
    ambientParticles: false,    // skip ambient sparkles
    trailLength: 6,
    enableGlow: true,
    enableBackdropBlur: false,  // no backdrop-filter blur
  },
  low: {
    targetFps: 30,
    particleMultiplier: 0.2,   // 20% of particles (or 0 for some types)
    shadowBlur: false,          // never set ctx.shadowBlur
    shadowScale: 0,
    gradientCache: true,
    ambientParticles: false,
    trailLength: 0,             // no trails
    enableGlow: false,
    enableBackdropBlur: false,
  },
};

let _quality = null;

export function getQuality() {
  if (!_quality) _quality = PRESETS[getDeviceTier()];
  return _quality;
}

// Returns frame interval in ms for use with RAF throttling
export function getFrameInterval() {
  return 1000 / getQuality().targetFps;
}

// Scale a particle count by quality multiplier, minimum 1
export function scaleParticles(count) {
  const q = getQuality();
  return Math.max(1, Math.round(count * q.particleMultiplier));
}

// Apply shadow settings to a canvas context (no-op on low)
export function applyShadow(ctx, blur, color) {
  const q = getQuality();
  if (!q.shadowBlur) {
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'rgba(0,0,0,0)';
    return;
  }
  ctx.shadowBlur = blur * q.shadowScale;
  ctx.shadowColor = color;
}

// Clear shadow settings
export function clearShadow(ctx) {
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'rgba(0,0,0,0)';
}

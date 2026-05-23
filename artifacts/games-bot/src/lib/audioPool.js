// Shared AudioContext singleton — avoids creating a new AudioContext per sound
// which causes memory leaks on low-end devices.
// On 'low' tier devices, all audio is silently suppressed.

import { isLowEnd } from './deviceProfile';

let _ctx = null;

export function getAudioContext() {
  if (isLowEnd()) return null;
  if (_ctx && _ctx.state !== 'closed') return _ctx;
  try {
    _ctx = new (window.AudioContext || window.webkitAudioContext)();
    return _ctx;
  } catch {
    return null;
  }
}

// Resume AudioContext after user gesture (required by browsers)
export function resumeAudio() {
  if (_ctx && _ctx.state === 'suspended') {
    _ctx.resume().catch(() => {});
  }
}

// Play a short tone — wraps oscillator creation with the shared context
export function playTone({ type = 'sine', freq = 440, freqEnd, gain = 0.2, duration = 0.15 } = {}) {
  const ac = getAudioContext();
  if (!ac) return;
  try {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.connect(g);
    g.connect(ac.destination);
    o.type = type;
    o.frequency.setValueAtTime(freq, ac.currentTime);
    if (freqEnd != null) {
      o.frequency.exponentialRampToValueAtTime(freqEnd, ac.currentTime + duration);
    }
    g.gain.setValueAtTime(gain, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    o.start();
    o.stop(ac.currentTime + duration);
  } catch {}
}

// Play white-noise burst (explosions, impacts)
export function playNoise({ gain = 0.2, duration = 0.3 } = {}) {
  const ac = getAudioContext();
  if (!ac) return;
  try {
    const bufLen = Math.round(ac.sampleRate * duration);
    const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const g = ac.createGain();
    src.connect(g);
    g.connect(ac.destination);
    g.gain.setValueAtTime(gain, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    src.start();
    src.stop(ac.currentTime + duration);
  } catch {}
}

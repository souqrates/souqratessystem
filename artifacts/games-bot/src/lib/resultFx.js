import { triggerHaptic } from './telegram';
import { getAudioContext } from './audioPool';

function audio() {
  const ac = getAudioContext();
  if (!ac) return null;
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  return ac;
}

function tone(freq, startOffset, duration, gain = 0.18, type = 'sine') {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + startOffset;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g);
  g.connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

export function playWinFanfare() {
  triggerHaptic('success');
  // C major triumphant arpeggio + harmonic stack
  tone(523.25, 0.00, 0.22, 0.20, 'triangle'); // C5
  tone(659.25, 0.10, 0.22, 0.20, 'triangle'); // E5
  tone(783.99, 0.20, 0.28, 0.22, 'triangle'); // G5
  tone(1046.5, 0.32, 0.50, 0.24, 'triangle'); // C6
  tone(1318.5, 0.32, 0.50, 0.14, 'sine');     // E6 shimmer
  tone(1567.9, 0.45, 0.40, 0.10, 'sine');     // G6
  // sparkle
  tone(2093.0, 0.60, 0.20, 0.07, 'sine');
}

export function playLoseDescent() {
  triggerHaptic('warning');
  tone(440.00, 0.00, 0.20, 0.14, 'sawtooth'); // A4
  tone(370.00, 0.18, 0.22, 0.14, 'sawtooth'); // F#4
  tone(293.66, 0.36, 0.30, 0.14, 'sawtooth'); // D4
  tone(196.00, 0.58, 0.50, 0.12, 'triangle'); // G3 thud
}

let _ac = null;
export function getAC() {
  if (_ac) return _ac;
  try { _ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { _ac = null; }
  return _ac;
}

export function tone(freq, dur = 0.12, type = 'sine', vol = 0.25, slide = 0) {
  const ac = getAC(); if (!ac) return;
  try {
    const o = ac.createOscillator(), g = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    o.type = type; o.frequency.setValueAtTime(freq, ac.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), ac.currentTime + dur);
    g.gain.setValueAtTime(vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    o.start(); o.stop(ac.currentTime + dur);
  } catch {}
}

export function chord(freqs, step = 0.06, dur = 0.18, type = 'sine', vol = 0.18) {
  const ac = getAC(); if (!ac) return;
  try {
    freqs.forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.type = type;
      o.frequency.setValueAtTime(f, ac.currentTime + i * step);
      g.gain.setValueAtTime(vol, ac.currentTime + i * step);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * step + dur);
      o.start(ac.currentTime + i * step); o.stop(ac.currentTime + i * step + dur);
    });
  } catch {}
}

export function noiseHit(dur = 0.2, vol = 0.22) {
  const ac = getAC(); if (!ac) return;
  try {
    const bufferSize = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, bufferSize, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const g = ac.createGain();
    g.gain.value = vol;
    src.connect(g); g.connect(ac.destination);
    src.start(); src.stop(ac.currentTime + dur);
  } catch {}
}

export const COLORS = {
  cyan: '#06b6d4',
  blue: '#3b82f6',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  pink: '#ec4899',
  rose: '#f43f5e',
  white: '#ffffff',
  gold: '#fbbf24',
};

export function hudColor(t, total) {
  const r = t / total;
  return r > 0.33 ? '#10b981' : r > 0.17 ? '#f59e0b' : '#ef4444';
}

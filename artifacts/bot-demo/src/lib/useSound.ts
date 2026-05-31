let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function playScratch() {
  try {
    const ac = getCtx();
    const buf = ac.createBuffer(1, ac.sampleRate * 0.12, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ac.sampleRate * 0.04));
    const src = ac.createBufferSource();
    src.buffer = buf;
    const lp = ac.createBiquadFilter();
    lp.type = 'bandpass';
    lp.frequency.value = 3200;
    lp.Q.value = 0.8;
    const gain = ac.createGain();
    gain.gain.value = 0.18;
    src.connect(lp); lp.connect(gain); gain.connect(ac.destination);
    src.start();
  } catch {}
}

export function playReveal() {
  try {
    const ac = getCtx();
    [0, 0.06, 0.12].forEach((delay, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = 440 * Math.pow(1.25, i);
      gain.gain.setValueAtTime(0, ac.currentTime + delay);
      gain.gain.linearRampToValueAtTime(0.22, ac.currentTime + delay + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + 0.3);
      osc.connect(gain); gain.connect(ac.destination);
      osc.start(ac.currentTime + delay);
      osc.stop(ac.currentTime + delay + 0.35);
    });
  } catch {}
}

export function playWin(big = false) {
  try {
    const ac = getCtx();
    const freqs = big
      ? [523, 659, 784, 1047, 1319]
      : [440, 554, 659, 880];
    freqs.forEach((f, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const t = ac.currentTime + i * 0.1;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(big ? 0.32 : 0.22, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + (big ? 0.55 : 0.4));
      osc.connect(gain); gain.connect(ac.destination);
      osc.start(t); osc.stop(t + 0.6);
    });
  } catch {}
}

export function playTicket() {
  try {
    const ac = getCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ac.currentTime);
    osc.frequency.linearRampToValueAtTime(880, ac.currentTime + 0.12);
    gain.gain.setValueAtTime(0.25, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.25);
    osc.connect(gain); gain.connect(ac.destination);
    osc.start(); osc.stop(ac.currentTime + 0.28);
  } catch {}
}

import { useEffect, useRef } from 'react';
import { playScratch } from '../lib/useSound';

interface Props {
  width: number;
  height: number;
  c1: string;
  c2: string;
  emoji?: string;
  label?: string;
  threshold?: number;
  onScratched: () => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
  disabled?: boolean;
}

export default function ScratchZone({
  width, height, c1, c2, emoji, label,
  threshold = 0.55, onScratched, children, style, disabled
}: Props) {
  const cvs = useRef<HTMLCanvasElement>(null);
  const done = useRef(false);
  const down = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = cvs.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width, H = canvas.height;

    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, c1);
    g.addColorStop(0.5, lighten(c1, 28));
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.roundRect(0, 0, W, H, 14);
    ctx.fill();

    const sg = ctx.createLinearGradient(0, 0, W, H);
    sg.addColorStop(0, 'rgba(255,255,255,0)');
    sg.addColorStop(0.48, 'rgba(255,255,255,0.04)');
    sg.addColorStop(0.5, 'rgba(255,255,255,0.18)');
    sg.addColorStop(0.52, 'rgba(255,255,255,0.04)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg;
    ctx.roundRect(0, 0, W, H, 14);
    ctx.fill();

    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#fff';
    for (let x = 10; x < W; x += 16)
      for (let y = 10; y < H; y += 16) {
        ctx.beginPath(); ctx.arc(x, y, 1.2, 0, Math.PI * 2); ctx.fill();
      }
    ctx.globalAlpha = 1;

    const mid = H / 2;
    if (emoji) {
      ctx.font = `${Math.min(H * 0.32, 32)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, W / 2, label ? mid - H * 0.13 : mid);
    }
    if (label) {
      ctx.font = `bold ${Math.min(H * 0.1, 12)}px Tajawal, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, W / 2, emoji ? mid + H * 0.18 : mid);
    }
  }, []);

  function lighten(hex: string, n: number) {
    try {
      const v = parseInt(hex.replace('#', ''), 16);
      return `rgb(${Math.min(255, (v >> 16) + n)},${Math.min(255, ((v >> 8) & 255) + n)},${Math.min(255, (v & 255) + n)})`;
    } catch { return hex; }
  }

  function getXY(e: React.PointerEvent) {
    const r = cvs.current!.getBoundingClientRect();
    const c = cvs.current!;
    return {
      x: (e.clientX - r.left) * (c.width / r.width),
      y: (e.clientY - r.top) * (c.height / r.height),
    };
  }

  function scratch(x: number, y: number, fx?: number, fy?: number) {
    const c = cvs.current;
    if (!c || done.current) return;
    const ctx = c.getContext('2d')!;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    if (fx !== undefined && fy !== undefined) {
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(x, y);
      ctx.lineWidth = 52; ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    check(c);
  }

  function check(c: HTMLCanvasElement) {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let t = 0;
    const n = Math.floor((c.width * c.height) / 8);
    for (let i = 3; i < d.length; i += 32) if (d[i] < 100) t++;
    if (t / n < threshold) return;
    done.current = true;
    let a = 1;
    const fade = () => {
      a -= 0.1; c.style.opacity = `${Math.max(0, a)}`;
      if (a > 0) requestAnimationFrame(fade);
      else c.style.pointerEvents = 'none';
    };
    requestAnimationFrame(fade);
    setTimeout(onScratched, 220);
  }

  return (
    <div style={{ position: 'relative', width, height, borderRadius: 14, overflow: 'hidden', ...style }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 14, overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {children}
      </div>
      <canvas
        ref={cvs} width={width} height={height}
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          borderRadius: 14,
          cursor: disabled ? 'default' : 'crosshair',
          touchAction: 'none', userSelect: 'none',
          pointerEvents: disabled ? 'none' : 'auto',
        }}
        onPointerDown={e => {
          if (done.current || disabled) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          down.current = true;
          playScratch();
          const p = getXY(e); last.current = p; scratch(p.x, p.y);
        }}
        onPointerMove={e => {
          if (!down.current || done.current) return;
          const p = getXY(e);
          scratch(p.x, p.y, last.current?.x, last.current?.y);
          last.current = p;
          if (Math.random() < 0.18) playScratch();
        }}
        onPointerUp={() => { down.current = false; last.current = null; }}
        onPointerLeave={() => { down.current = false; last.current = null; }}
      />
    </div>
  );
}

import { useEffect, useState, useRef } from 'react';

export default function DebugTouchOverlay() {
  const [log, setLog] = useState([]);
  const [tapCount, setTapCount] = useState(0);
  const [scrollCount, setScrollCount] = useState(0);
  const [lastTarget, setLastTarget] = useState('');
  const idRef = useRef(0);

  useEffect(() => {
    const push = (msg) => {
      idRef.current += 1;
      const id = idRef.current;
      setLog((prev) => [...prev.slice(-5), { id, msg, t: Date.now() }]);
    };

    const describe = (el) => {
      if (!el || !el.tagName) return '(none)';
      const tag = el.tagName.toLowerCase();
      const cls = (el.className && typeof el.className === 'string')
        ? el.className.split(' ').slice(0, 2).join('.')
        : '';
      const id = el.id ? `#${el.id}` : '';
      return `${tag}${id}${cls ? '.' + cls : ''}`;
    };

    const onTouchStart = (e) => {
      const t = e.touches[0];
      const el = document.elementFromPoint(t.clientX, t.clientY);
      const tgt = describe(el);
      setLastTarget(tgt);
      push(`TOUCH@${Math.round(t.clientX)},${Math.round(t.clientY)} → ${tgt}`);
    };

    const onClick = (e) => {
      setTapCount((c) => c + 1);
      push(`CLICK → ${describe(e.target)}`);
    };

    const onScroll = (e) => {
      setScrollCount((c) => c + 1);
      const tgt = describe(e.target === document ? document.scrollingElement : e.target);
      push(`SCROLL on ${tgt}`);
    };

    document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    document.addEventListener('click', onClick, { capture: true });
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });

    push('Debug overlay mounted');

    return () => {
      document.removeEventListener('touchstart', onTouchStart, { capture: true });
      document.removeEventListener('click', onClick, { capture: true });
      document.removeEventListener('scroll', onScroll, { capture: true });
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 'env(safe-area-inset-top)',
        left: 0,
        right: 0,
        zIndex: 999999,
        background: 'rgba(255,0,128,0.92)',
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: 10,
        padding: '6px 8px',
        pointerEvents: 'none',
        maxHeight: '40vh',
        overflow: 'hidden',
        borderBottom: '2px solid #ff0',
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: 2 }}>
        DEBUG · taps:{tapCount} scrolls:{scrollCount}
      </div>
      <div style={{ marginBottom: 4, opacity: 0.9 }}>
        last:{lastTarget || '—'}
      </div>
      {log.map((l) => (
        <div key={l.id} style={{ lineHeight: 1.2 }}>{l.msg}</div>
      ))}
      <button
        onClick={() => setTapCount((c) => c + 100)}
        style={{
          pointerEvents: 'auto',
          marginTop: 4,
          background: '#fff',
          color: '#c0006e',
          fontWeight: 'bold',
          padding: '4px 10px',
          border: 'none',
          borderRadius: 4,
          fontSize: 11,
        }}
      >
        TAP ME (test button)
      </button>
    </div>
  );
}

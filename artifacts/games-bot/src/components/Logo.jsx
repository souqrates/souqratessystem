const LOGO_SRC = import.meta.env.BASE_URL + 'souqrates-logo.webp';

export default function Logo({ size = 96, withWordmark = false, animated = true }) {
  const w = withWordmark ? Math.round(size * 1.7) : size;
  const h = size;

  return (
    <div
      style={{
        width: w,
        height: h,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        filter: 'drop-shadow(0 6px 24px rgba(201,162,39,0.35))',
      }}
    >
      <img
        src={LOGO_SRC}
        alt="SOUQRATES SKILLZ"
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          objectPosition: 'center',
          borderRadius: '50%',
          animation: animated ? 'logoPulse 2.8s ease-in-out infinite' : 'none',
          userSelect: 'none',
        }}
      />
      <style>{`
        @keyframes logoPulse {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50%       { transform: scale(1.035); filter: brightness(1.08) drop-shadow(0 0 12px rgba(201,162,39,0.5)); }
        }
      `}</style>
    </div>
  );
}

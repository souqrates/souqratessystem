const EMBLEM_SRC  = '/WhatsApp_Image_2026-05-11_at_5.53.33_PM.jpeg';
const FULL_SRC    = '/WhatsApp_Image_2026-05-11_at_5.53.33_PM_(1).jpeg';

export default function Logo({ size = 96, withWordmark = false, animated = true }) {
  const src = withWordmark ? FULL_SRC : EMBLEM_SRC;
  const w   = withWordmark ? Math.round(size * 1.7) : size;
  const h   = size;

  return (
    <div
      style={{
        width: w,
        height: h,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        filter: 'drop-shadow(0 6px 24px rgba(255,215,0,0.25))',
      }}
    >
      <img
        src={src}
        alt="Sougrates Skillz"
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          objectPosition: 'center',
          animation: animated ? 'logoPulse 2.8s ease-in-out infinite' : 'none',
          userSelect: 'none',
        }}
      />
      <style>{`
        @keyframes logoPulse {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50%      { transform: scale(1.035); filter: brightness(1.08); }
        }
      `}</style>
    </div>
  );
}

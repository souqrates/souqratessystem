export function Skeleton({ width = '100%', height = 16, radius = 8, style = {}, className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: 'block',
        width,
        height,
        borderRadius: radius,
        background: 'linear-gradient(90deg, rgba(148,163,184,0.08) 0%, rgba(148,163,184,0.18) 50%, rgba(148,163,184,0.08) 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

export function SkeletonCard({ height = 120 }) {
  return (
    <div style={{
      padding: 16,
      borderRadius: 16,
      background: 'rgba(15,23,42,0.6)',
      border: '1px solid rgba(148,163,184,0.1)',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      minHeight: height,
    }}>
      <Skeleton width="60%" height={14} />
      <Skeleton width="40%" height={10} />
      <Skeleton width="100%" height={28} radius={10} />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
      <Skeleton width={36} height={36} radius={999} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Skeleton width="50%" height={12} />
        <Skeleton width="30%" height={10} />
      </div>
      <Skeleton width={50} height={14} />
    </div>
  );
}

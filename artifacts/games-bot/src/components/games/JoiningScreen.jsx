export default function JoiningScreen({ label = 'Joining room...' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: '40px 0' }}>
      <div className="lobby-spinner" />
      <p style={{ color: 'rgba(148,163,184,0.75)', fontSize: 13, fontWeight: 600, margin: 0 }}>{label}</p>
    </div>
  );
}

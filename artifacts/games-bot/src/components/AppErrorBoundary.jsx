import React from 'react';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error) {
    // After a deploy, React.lazy chunks fail to load — surface this as a
    // transparent one-time reload instead of a generic error screen.
    try { window.__skzRecoverFromChunkError?.(error); } catch { /* ignore */ }
  }
  reset = () => this.setState({ hasError: false, error: null });
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: '#04030a',
          color: '#fff',
          fontFamily: 'Inter, sans-serif',
        }}>
          <div style={{
            maxWidth: 360,
            textAlign: 'center',
            padding: 28,
            borderRadius: 20,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div style={{ fontSize: 42, marginBottom: 14, color: '#fbbf24' }}>!</div>
            <p style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>حدث خطأ غير متوقع</p>
            <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.75)', marginBottom: 20, lineHeight: 1.5 }}>
              واجه التطبيق مشكلة غير متوقعة. يُرجى المحاولة مرة أخرى.
            </p>
            <button
              onClick={() => { this.reset(); window.location.reload(); }}
              style={{
                padding: '12px 28px',
                borderRadius: 14,
                background: 'linear-gradient(135deg, #06b6d4, #0ea5e9)',
                color: '#fff',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

import { createRoot } from "react-dom/client";
import { Component, useState, type ReactNode, type ErrorInfo } from "react";
import App from "./App";
import { SplashScreen } from "./components/SplashScreen";
import "./index.css";

// ── Telegram WebApp bootstrap ─────────────────────────────────────────────────
try { (window as any).Telegram?.WebApp?.ready?.(); } catch {}
try { (window as any).Telegram?.WebApp?.expand?.(); } catch {}

// ── Stale-chunk recovery ──────────────────────────────────────────────────────
const _rk = "souq:chunk_reload_at";
const _sr = () => { try { return Date.now() - Number(sessionStorage.getItem(_rk) || 0) > 30_000; } catch { return true; } };
const _mr = () => { try { sessionStorage.setItem(_rk, String(Date.now())); } catch {} };
const _ce = (e: unknown) => { const m = String((e as any)?.message || e || ""); return m.includes("Failed to fetch dynamically imported module") || m.includes("is not a valid JavaScript MIME type") || m.includes("'text/html' is not a valid JavaScript MIME"); };
const _re = (e: unknown) => { if (!_ce(e) || !_sr()) return false; _mr(); try { window.location.reload(); } catch {} return true; };
window.addEventListener("vite:preloadError", (e) => { if (_re((e as any)?.payload)) e.preventDefault?.(); });
window.addEventListener("unhandledrejection", (e) => { if (_re(e?.reason)) e.preventDefault?.(); });
window.addEventListener("error", (e) => {
  const t = e?.target as HTMLElement | null;
  if ((t?.tagName === "SCRIPT" || t?.tagName === "LINK") && _sr()) { _mr(); window.location.reload(); }
  else _re(e?.error);
}, true);

// ── Error Boundary ────────────────────────────────────────────────────────────
class AppErrorBoundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(e: Error) { return { err: e }; }
  componentDidCatch(e: Error, i: ErrorInfo) { console.error("[ErrorBoundary]", e, i.componentStack); }
  render() {
    if (this.state.err) return (
      <div style={{ padding: 24, textAlign: "center", fontFamily: "sans-serif", background: "#0f172a", minHeight: "100vh", color: "#f1f5f9", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <h2 style={{ margin: "0 0 8px" }}>حدث خطأ غير متوقع</h2>
        <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 20px" }}>{this.state.err.message}</p>
        <button onClick={() => window.location.reload()} style={{ padding: "10px 24px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>إعادة تحميل</button>
      </div>
    );
    return this.props.children;
  }
}

// ── Splash screen (once per session) ─────────────────────────────────────────
const SPLASH_KEY = "souq:splash:v1";
function Root() {
  const [done, setDone] = useState(() => {
    try { return sessionStorage.getItem(SPLASH_KEY) === "1"; } catch { return false; }
  });
  const finish = () => {
    try { sessionStorage.setItem(SPLASH_KEY, "1"); } catch {}
    setDone(true);
  };
  if (!done) return <SplashScreen onDone={finish} />;
  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary><Root /></AppErrorBoundary>
);

import { createRoot } from "react-dom/client";
import { Component, type ReactNode, type ErrorInfo } from "react";
import App from "./App";
import "./index.css";

// ── Stale-chunk recovery ──────────────────────────────────────────────────────
// After a deploy, Vite emits new hashed JS filenames. A page opened before the
// deploy still points at OLD filenames; dynamic import() then gets the SPA
// index.html fallback and the browser refuses it ("text/html is not a valid
// JavaScript MIME type"). We catch that and hard-reload ONCE so the admin lands
// on the new bundle. A sessionStorage guard prevents infinite reload loops.
const _rk = "souq:admin:chunk_reload_at";
const _sr = () => { try { return Date.now() - Number(sessionStorage.getItem(_rk) || 0) > 30_000; } catch { return true; } };
const _mr = () => { try { sessionStorage.setItem(_rk, String(Date.now())); } catch {} };
const _ce = (e: unknown) => {
  const m = String((e as any)?.message || e || "");
  return (
    m.includes("Failed to fetch dynamically imported module") ||
    m.includes("is not a valid JavaScript MIME type") ||
    m.includes("'text/html' is not a valid JavaScript MIME") ||
    m.includes("Importing a module script failed")
  );
};
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
  componentDidCatch(e: Error, i: ErrorInfo) { console.error("[SuperAdmin ErrorBoundary]", e, i.componentStack); }
  render() {
    if (this.state.err) return (
      <div style={{ padding: 32, textAlign: "center", fontFamily: "sans-serif", background: "#f8fafc", minHeight: "100vh", color: "#1e293b", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>حدث خطأ غير متوقع</h2>
        <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 4px" }}>{this.state.err.message}</p>
        <p style={{ fontSize: 11, color: "#94a3b8", margin: "0 0 24px", fontFamily: "monospace", maxWidth: 500 }}>
          {this.state.err.stack?.split("\n")[1]?.trim()}
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: "10px 28px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}
        >
          إعادة تحميل
        </button>
      </div>
    );
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary><App /></AppErrorBoundary>
);

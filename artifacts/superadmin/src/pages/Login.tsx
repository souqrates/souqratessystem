import { useState } from "react";
import { useLocation } from "wouter";
import { api, setToken, ApiError } from "@/lib/api";

export default function Login() {
  const [, navigate] = useLocation();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.loginUnauthed<{ ok: true }>("/superadmin/login", { code });
      setToken(code);
      navigate("/");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "تعذّر تسجيل الدخول";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3 text-indigo-400"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
          <h1 className="text-3xl font-bold text-white">لوحة المدير المركزية</h1>
          <p className="text-slate-400 mt-2">SOUQRATES SUPER ADMIN</p>
        </div>

        <form onSubmit={submit} className="bg-slate-800/60 backdrop-blur border border-slate-700 rounded-2xl p-6 shadow-2xl">
          <label className="block text-sm font-medium text-slate-200 mb-2">
            الكود المركزي السري
          </label>
          <input
            type="password"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="••••••••••••••••"
            dir="ltr"
            className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {error && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/40 text-red-300 text-sm">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || !code}
            className="mt-5 w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition"
          >
            {loading ? "جارٍ التحقق…" : "دخول"}
          </button>
          <p className="mt-4 text-xs text-slate-500 text-center">
            هذا الكود يمنح صلاحيات كاملة على كل البوتات. لا تشاركه مع أحد.
          </p>
        </form>
      </div>
    </div>
  );
}

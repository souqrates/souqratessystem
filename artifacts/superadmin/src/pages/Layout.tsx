import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import Sidebar from "@/components/Sidebar";
import { api, getToken, clearToken } from "@/lib/api";

export default function Layout({ children }: { children: ReactNode }) {
  const [, navigate] = useLocation();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      navigate("/login");
      return;
    }
    api
      .get<{ ok: boolean }>("/superadmin/me")
      .then(() => setChecking(false))
      .catch(() => {
        clearToken();
        navigate("/login");
      });
  }, [navigate]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400" dir="rtl">
        جارٍ التحقق من الجلسة…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50" dir="rtl">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

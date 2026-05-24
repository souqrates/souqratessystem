import { useQuery } from "@tanstack/react-query";
import { api, type Bot } from "@/lib/api";
import { BOTS } from "@/lib/bots-meta";
import { Link } from "wouter";

interface Overview {
  users: number;
  bots: number;
  overrides: number;
}

export default function OverviewPage() {
  const { data: stats } = useQuery({
    queryKey: ["superadmin", "overview"],
    queryFn: () => api.get<Overview>("/superadmin/overview"),
  });
  const { data: botsResp } = useQuery({
    queryKey: ["superadmin", "bots"],
    queryFn: () => api.get<{ data: Bot[] }>("/superadmin/bots"),
  });

  const dbBots = botsResp?.data ?? [];
  const bySlug = new Map(dbBots.map((b) => [b.slug, b]));

  return (
    <div className="p-8 max-w-6xl mx-auto" dir="rtl">
      <h1 className="text-3xl font-bold text-slate-900">نظرة عامة</h1>
      <p className="text-slate-500 mt-1">إدارة كاملة لمنظومة سوقريتس — 7 بوتات تحت لوحة واحدة.</p>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="المستخدمين" value={stats?.users ?? "—"} icon="👥" />
        <StatCard label="البوتات المُسجَّلة" value={stats?.bots ?? "—"} icon="🤖" />
        <StatCard label="استثناءات العمولة" value={stats?.overrides ?? "—"} icon="⚙️" />
      </div>

      <h2 className="mt-10 text-xl font-bold text-slate-900">البوتات</h2>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {BOTS.map((meta) => {
          const bot = bySlug.get(meta.slug);
          const rate = bot ? (parseFloat(bot.commissionRate) * 100).toFixed(2) : "—";
          return (
            <Link key={meta.slug} href={`/bots/${meta.slug}`}>
              <a className="block bg-white rounded-2xl border border-slate-200 p-5 hover:border-indigo-400 hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">{meta.icon}</div>
                    <div>
                      <div className="font-bold text-slate-900">{meta.brand}</div>
                      <div className="text-xs text-slate-500">{meta.arName}</div>
                    </div>
                  </div>
                  {bot ? (
                    <span className={`text-[11px] px-2 py-1 rounded-full ${bot.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {bot.isActive ? "نشط" : "متوقف"}
                    </span>
                  ) : (
                    <span className="text-[11px] px-2 py-1 rounded-full bg-amber-100 text-amber-700">غير مُسجَّل</span>
                  )}
                </div>
                <div className="mt-4 text-sm text-slate-600">
                  العمولة: <span className="font-semibold text-slate-900">{rate}{bot ? "%" : ""}</span>
                </div>
              </a>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number | string; icon: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-slate-500">{label}</div>
          <div className="text-3xl font-bold text-slate-900 mt-1">{value}</div>
        </div>
        <div className="text-4xl opacity-70">{icon}</div>
      </div>
    </div>
  );
}

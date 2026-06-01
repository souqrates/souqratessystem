import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type ReportDailyResponse } from "@/lib/api";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
}

const PRESETS: { label: string; days: number }[] = [
  { label: "7 أيام", days: 6 },
  { label: "30 يوم", days: 29 },
  { label: "90 يوم", days: 89 },
];

export default function ReportsPage() {
  const [from, setFrom] = useState(isoDaysAgo(29));
  const [to, setTo] = useState(isoDaysAgo(0));

  const q = new URLSearchParams({ from, to });
  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "reports", "daily", from, to],
    queryFn: () => api.get<ReportDailyResponse>(`/superadmin/reports/daily?${q}`),
  });

  const series = data?.series ?? [];
  const totals = data?.totals;

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">التقارير المالية</h1>
        <p className="text-slate-500 mt-1">
          سلاسل زمنية يومية للإيرادات، الإيداعات، السحوبات، والمستخدمين الجدد ضمن المدى المحدد.
        </p>
      </header>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 shadow-sm flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">من تاريخ</span>
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm" dir="ltr" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">إلى تاريخ</span>
          <input type="date" value={to} min={from} max={isoDaysAgo(0)} onChange={(e) => setTo(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm" dir="ltr" />
        </label>
        <div className="flex gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.days}
              onClick={() => { setFrom(isoDaysAgo(p.days)); setTo(isoDaysAgo(0)); }}
              className="px-3 py-2 text-sm rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="إجمالي العمولة" value={fmt(totals?.revenue)} suffix="SKZ" accent="emerald" />
        <KpiCard label="إجمالي الإيداعات" value={fmt(totals?.deposits)} suffix="SKZ" />
        <KpiCard label="إجمالي السحوبات المقبولة" value={fmt(totals?.withdrawals)} suffix="SKZ" accent="amber" />
        <KpiCard label="مستخدمون جدد" value={fmt(totals?.newUsers)} />
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-slate-400">جارٍ التحميل…</div>
      ) : (
        <div className="space-y-4">
          <ChartCard title="العمولة مقابل الإيداعات والسحوبات">
            {series.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={series} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rev2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="dep2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="wd2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip labelFormatter={(d) => `التاريخ: ${d}`} contentStyle={{ direction: "ltr", textAlign: "right" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="revenue" name="العمولة" stroke="#6366f1" strokeWidth={2} fill="url(#rev2)" />
                  <Area type="monotone" dataKey="deposits" name="الإيداعات" stroke="#10b981" strokeWidth={2} fill="url(#dep2)" />
                  <Area type="monotone" dataKey="withdrawals" name="السحوبات" stroke="#f59e0b" strokeWidth={2} fill="url(#wd2)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <Empty />
            )}
          </ChartCard>

          <ChartCard title="المستخدمون الجدد يومياً">
            {series.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={series} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip labelFormatter={(d) => `التاريخ: ${d}`} formatter={(v: number) => [`${v}`, "مستخدمون"]} />
                  <Bar dataKey="newUsers" name="مستخدمون جدد" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty />
            )}
          </ChartCard>
        </div>
      )}
    </div>
  );
}

function fmt(v: number | undefined): string {
  if (v === undefined) return "—";
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function KpiCard({ label, value, suffix, accent = "slate" }: { label: string; value: string; suffix?: string; accent?: "slate" | "emerald" | "amber" }) {
  const accentCls = accent === "emerald" ? "text-emerald-700" : accent === "amber" ? "text-amber-700" : "text-slate-900";
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <div className="text-xs text-slate-500 truncate">{label}</div>
      <div className={`text-2xl font-bold ${accentCls} mt-1`}>
        {value}
        {suffix && <span className="text-xs text-slate-400 mr-1 font-normal">{suffix}</span>}
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <h3 className="font-semibold text-slate-900 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Empty() {
  return <div className="h-[260px] flex items-center justify-center text-sm text-slate-400">لا توجد بيانات في هذا المدى.</div>;
}

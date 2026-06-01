import { useQuery } from "@tanstack/react-query";
import { api, type Bot } from "@/lib/api";
import { BOTS } from "@/lib/bots-meta";
import { Link } from "wouter";
import {
  Users, TrendingUp, TrendingDown, Clock, Server, Settings,
  Diamond, Triangle, BookOpen, Play, Radio, Crown, Star, Hexagon,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";

// Dashboard payload returned by /superadmin/overview. All series are bounded
// (≤30 points for revenue, ≤7 bars for bots, ≤5 donut slices for withdrawal
// statuses) so a single round-trip is enough.
interface Overview {
  users: number;
  bots: number;
  overrides: number;
  totalRevenue: string;
  totalWithdrawn: string;
  pendingWithdrawals: number;
  revenueByDay: { day: string; revenue: number }[];
  withdrawalsByStatus: { status: string; count: number }[];
  topBots: { slug: string; revenue: number; transactions: number }[];
}

const STATUS_COLOR: Record<string, string> = {
  pending: "#f59e0b",
  processing: "#3b82f6",
  approved: "#10b981",
  rejected: "#ef4444",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "بانتظار",
  processing: "قيد التحويل",
  approved: "مقبولة",
  rejected: "مرفوضة",
};

export default function OverviewPage() {
  const { data: stats } = useQuery({
    queryKey: ["superadmin", "overview"],
    queryFn: () => api.get<Overview>("/superadmin/overview"),
    refetchInterval: 30000,
  });
  const { data: botsResp } = useQuery({
    queryKey: ["superadmin", "bots"],
    queryFn: () => api.get<{ data: Bot[] }>("/superadmin/bots"),
  });

  const dbBots = botsResp?.data ?? [];
  const bySlug = new Map(dbBots.map((b) => [b.slug, b]));
  const brandBySlug = new Map(BOTS.map((b) => [b.slug, b]));

  return (
    <div className="p-8 max-w-7xl mx-auto" dir="rtl">
      <h1 className="text-3xl font-bold text-slate-900">لوحة المعلومات</h1>
      <p className="text-slate-500 mt-1">نظرة مالية حيّة على منظومة سوقريتس — تحديث تلقائي كل 30 ثانية.</p>

      {/* Top KPI row — lifetime metrics that summarize the platform health. */}
      <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="المستخدمين" value={stats?.users ?? "—"} icon={<Users size={28} />} />
        <StatCard label="إيرادات العمولة" value={fmt(stats?.totalRevenue)} suffix="SKZ" icon={<TrendingUp size={28} />} accent="emerald" />
        <StatCard label="إجمالي المسحوب" value={fmt(stats?.totalWithdrawn)} suffix="SKZ" icon={<TrendingDown size={28} />} />
        <StatCard label="بانتظار المراجعة" value={stats?.pendingWithdrawals ?? "—"} icon={<Clock size={28} />} accent={stats?.pendingWithdrawals ? "amber" : "slate"} />
        <StatCard label="البوتات المُسجَّلة" value={stats?.bots ?? "—"} icon={<Server size={28} />} />
        <StatCard label="استثناءات العمولة" value={stats?.overrides ?? "—"} icon={<Settings size={28} />} />
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue trend (last 30 days). Area chart conveys momentum at a glance. */}
        <ChartCard title="إيرادات العمولة — آخر 30 يوم" colSpan="lg:col-span-2">
          {stats?.revenueByDay && stats.revenueByDay.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={stats.revenueByDay} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: number) => [`${v.toFixed(2)} SKZ`, "العمولة"]}
                  labelFormatter={(d) => `التاريخ: ${d}`}
                  contentStyle={{ direction: "ltr", textAlign: "right" }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart hint="لم تُسجَّل عمولات بعد." />
          )}
        </ChartCard>

        {/* Withdrawals funnel. Color-coded by status to mirror the withdrawals page. */}
        <ChartCard title="حالة السحوبات">
          {stats?.withdrawalsByStatus && stats.withdrawalsByStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={stats.withdrawalsByStatus.map((s) => ({ name: STATUS_LABEL[s.status] ?? s.status, value: s.count, raw: s.status }))}
                  dataKey="value"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {stats.withdrawalsByStatus.map((s) => (
                    <Cell key={s.status} fill={STATUS_COLOR[s.status] ?? "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v} طلب`, ""]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart hint="لا توجد سحوبات بعد." />
          )}
        </ChartCard>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top bots by lifetime commission revenue. */}
        <ChartCard title="البوتات الأعلى إيراداً" colSpan="lg:col-span-3">
          {stats?.topBots && stats.topBots.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={stats.topBots.map((b) => ({
                  name: brandBySlug.get(b.slug)?.brand ?? b.slug,
                  revenue: b.revenue,
                  transactions: b.transactions,
                }))}
                margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: number, name) => name === "revenue" ? [`${v.toFixed(2)} SKZ`, "العمولة"] : [`${v}`, "العمليات"]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" fill="#6366f1" name="العمولة (SKZ)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart hint="لم تُسجَّل عمولات لأي بوت بعد." />
          )}
        </ChartCard>
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
                    <div className="text-3xl opacity-80">{BOT_ICON_MAP[meta.slug] ?? <Diamond size={28} />}</div>
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

function fmt(v: string | undefined): string {
  if (!v) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

const BOT_ICON_MAP: Record<string, React.ReactNode> = {
  "mother-bot":    <Diamond size={28} />,
  "games-bot":     <Triangle size={28} />,
  "books-bot":     <BookOpen size={28} />,
  "video-bot":     <Play size={28} />,
  "voice-bot":     <Radio size={28} />,
  "subagents-bot": <Crown size={28} />,
  "contests-bot":  <Star size={28} />,
  "scratchy-bot":  <Hexagon size={28} />,
};

function StatCard({ label, value, icon, suffix, accent = "slate" }: { label: string; value: number | string; icon: React.ReactNode; suffix?: string; accent?: "slate" | "emerald" | "amber" }) {
  const accentCls = accent === "emerald" ? "text-emerald-700" : accent === "amber" ? "text-amber-700" : "text-slate-900";
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs text-slate-500 truncate">{label}</div>
          <div className={`text-2xl font-bold ${accentCls} mt-1`}>
            {value}
            {suffix && <span className="text-xs text-slate-400 mr-1 font-normal">{suffix}</span>}
          </div>
        </div>
        <div className="text-3xl opacity-70 shrink-0">{icon}</div>
      </div>
    </div>
  );
}

function ChartCard({ title, children, colSpan }: { title: string; children: React.ReactNode; colSpan?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 p-5 ${colSpan ?? ""}`}>
      <h3 className="font-semibold text-slate-900 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function EmptyChart({ hint }: { hint: string }) {
  return (
    <div className="h-[260px] flex items-center justify-center text-sm text-slate-400">
      {hint}
    </div>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { BOTS } from "@/lib/bots-meta";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";
import { TrendingUp, Percent, Filter, ChevronLeft, ChevronRight } from "lucide-react";

interface CommissionRow {
  id: number;
  botSlug: string;
  userId: number;
  telegramId: string | null;
  username: string | null;
  grossAmount: string;
  commissionRate: string;
  commissionAmount: string;
  netAmount: string;
  currency: string;
  status: string;
  createdAt: string;
}

interface CommissionsResp {
  data: CommissionRow[];
  total: number;
  summary: {
    totalCommission: string;
    byBot: { botSlug: string; total: string; count: number }[];
  };
}

const BOT_COLORS: Record<string, string> = {
  "games-bot":     "#f97316",
  "books-bot":     "#0F766E",
  "contests-bot":  "#eab308",
  "scratchy-bot":  "#8b5cf6",
  "subagents-bot": "#D4AF37",
  "mother-bot":    "#6366f1",
};

const PAGE_SIZE = 50;

export default function CommissionsPage() {
  const [botSlug, setBotSlug] = useState("");
  const [telegramId, setTelegramId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);

  const params = new URLSearchParams();
  if (botSlug)     params.set("botSlug", botSlug);
  if (telegramId)  params.set("telegramId", telegramId);
  if (from)        params.set("from", from);
  if (to)          params.set("to", to);
  params.set("limit", String(PAGE_SIZE));
  params.set("offset", String(page * PAGE_SIZE));

  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "commissions", botSlug, telegramId, from, to, page],
    queryFn: () => api.get<CommissionsResp>(`/superadmin/commissions?${params}`),
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  function applyFilter() { setPage(0); }
  function clearFilter() {
    setBotSlug(""); setTelegramId(""); setFrom(""); setTo(""); setPage(0);
  }

  const botName = (slug: string) => BOTS.find(b => b.slug === slug)?.brand ?? slug;

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-indigo-700">تحليلات العمولات</h1>
        <p className="text-sm text-slate-500 mt-1">ملخص العمولات المحصّلة من كل بوت مع سجل مفصّل قابل للتصفية.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="إجمالي العمولات"
          value={data ? `${parseFloat(data.summary.totalCommission).toFixed(2)} SKZ` : "—"}
          icon={<TrendingUp size={18} />}
          color="#6366f1"
        />
        <StatCard
          label="إجمالي السجلات"
          value={data ? data.total.toLocaleString() : "—"}
          icon={<Percent size={18} />}
          color="#0F766E"
        />
        {data?.summary.byBot.slice(0, 2).map(b => (
          <StatCard
            key={b.botSlug}
            label={botName(b.botSlug)}
            value={`${parseFloat(b.total).toFixed(2)} SKZ`}
            icon={<TrendingUp size={18} />}
            color={BOT_COLORS[b.botSlug] ?? "#888"}
          />
        ))}
      </div>

      {/* Chart */}
      {data && data.summary.byBot.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 mb-6">
          <div className="font-semibold text-slate-700 text-sm mb-4">العمولات حسب البوت</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.summary.byBot} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="botSlug" tick={{ fontSize: 11 }} tickFormatter={s => botName(s).replace("SOUQRATES ", "")} />
              <YAxis tick={{ fontSize: 11 }} width={60} />
              <Tooltip
                formatter={(v: number) => [`${v} SKZ`, "العمولة"]}
                labelFormatter={s => botName(String(s))}
              />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {data.summary.byBot.map(b => (
                  <Cell key={b.botSlug} fill={BOT_COLORS[b.botSlug] ?? "#6366f1"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 mb-4">
        <div className="flex items-center gap-2 mb-3 text-sm font-medium text-slate-700">
          <Filter size={14} />
          تصفية
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <div className="text-[11px] text-slate-500 mb-1">البوت</div>
            <select
              value={botSlug}
              onChange={e => setBotSlug(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="">الكل</option>
              {BOTS.filter(b => b.slug !== "mother-bot").map(b => (
                <option key={b.slug} value={b.slug}>{b.brand}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 mb-1">Telegram ID</div>
            <input
              value={telegramId}
              onChange={e => setTelegramId(e.target.value)}
              placeholder="123456789"
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-40 font-mono"
              dir="ltr"
            />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 mb-1">من</div>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 mb-1">إلى</div>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <button onClick={applyFilter}
            className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
            تطبيق
          </button>
          <button onClick={clearFilter}
            className="px-4 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200">
            مسح
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">جاري التحميل…</div>
        ) : !data || data.data.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">لا توجد بيانات</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-xs text-slate-500 border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3">البوت</th>
                <th className="px-4 py-3">المستخدم</th>
                <th className="px-4 py-3">الإجمالي</th>
                <th className="px-4 py-3">نسبة العمولة</th>
                <th className="px-4 py-3">العمولة</th>
                <th className="px-4 py-3">الصافي</th>
                <th className="px-4 py-3">العملة</th>
                <th className="px-4 py-3">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map(row => (
                <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <span className="inline-block px-2 py-0.5 rounded-full text-white text-xs font-medium"
                      style={{ background: BOT_COLORS[row.botSlug] ?? "#888" }}>
                      {botName(row.botSlug).replace("SOUQRATES ", "")}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500" dir="ltr">
                    {row.telegramId ?? row.userId}
                    {row.username && <span className="text-slate-400 mr-1">@{row.username}</span>}
                  </td>
                  <td className="px-4 py-2.5 font-semibold" dir="ltr">{parseFloat(row.grossAmount).toFixed(4)}</td>
                  <td className="px-4 py-2.5 text-center">{(parseFloat(row.commissionRate) * 100).toFixed(1)}%</td>
                  <td className="px-4 py-2.5 font-semibold text-indigo-600" dir="ltr">{parseFloat(row.commissionAmount).toFixed(4)}</td>
                  <td className="px-4 py-2.5" dir="ltr">{parseFloat(row.netAmount).toFixed(4)}</td>
                  <td className="px-4 py-2.5 uppercase text-xs font-medium text-slate-500">{row.currency}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400" dir="ltr">
                    {new Date(row.createdAt).toLocaleDateString("ar-SA")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-slate-500">
            صفحة {page + 1} من {totalPages} ({data?.total} سجل)
          </span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1">
              <ChevronRight size={14} /> السابق
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1">
              التالي <ChevronLeft size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color?: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <span className="opacity-60" style={color ? { color } : undefined}>{icon}</span>
        <span className="text-xl font-bold" style={color ? { color } : undefined}>{value}</span>
      </div>
    </div>
  );
}

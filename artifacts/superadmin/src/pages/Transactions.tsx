import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type SuperTransaction } from "@/lib/api";
import { TransactionsTable } from "./UserDetail";
import { BOTS } from "@/lib/bots-meta";

const TX_TYPES = ["", "admin_credit", "admin_debit", "deposit", "withdrawal", "commission", "referral_bonus", "game_win", "game_loss"];
const TX_STATUSES = ["", "completed", "pending", "failed", "cancelled"];

export default function TransactionsPage() {
  const [page, setPage] = useState(1);
  const [sourceBot, setSourceBot] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [telegramId, setTelegramId] = useState("");
  const limit = 50;

  const q = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (sourceBot) q.set("sourceBot", sourceBot);
  if (type) q.set("type", type);
  if (status) q.set("status", status);
  if (telegramId.trim()) q.set("telegramId", telegramId.trim());

  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "transactions", page, sourceBot, type, status, telegramId],
    queryFn: () => api.get<{ data: SuperTransaction[]; total: number }>(`/superadmin/transactions?${q}`),
  });

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / limit));

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">سجل المعاملات</h1>
        <p className="text-slate-500 mt-1">جميع العمليات المالية عبر كل البوتات</p>
      </header>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-3">
        <Select label="البوت المصدر" value={sourceBot} onChange={(v) => { setSourceBot(v); setPage(1); }}>
          <option value="">الكل</option>
          {BOTS.map((b) => <option key={b.slug} value={b.slug}>{b.brand}</option>)}
          <option value="superadmin">superadmin (يدوي)</option>
        </Select>
        <Select label="النوع" value={type} onChange={(v) => { setType(v); setPage(1); }}>
          {TX_TYPES.map((t) => <option key={t} value={t}>{t || "الكل"}</option>)}
        </Select>
        <Select label="الحالة" value={status} onChange={(v) => { setStatus(v); setPage(1); }}>
          {TX_STATUSES.map((s) => <option key={s} value={s}>{s || "الكل"}</option>)}
        </Select>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Telegram ID</label>
          <input value={telegramId} onChange={(e) => { setTelegramId(e.target.value); setPage(1); }}
            placeholder="رقم تيليغرام" dir="ltr"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="text-center py-10 text-slate-400">جارٍ التحميل…</div>
        ) : (
          <TransactionsTable rows={data?.data ?? []} />
        )}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
          <span className="text-xs text-slate-500">
            {data?.total ?? 0} معاملة · صفحة {page} من {totalPages}
          </span>
          <div className="flex gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 text-sm rounded border border-slate-300 disabled:opacity-40">السابق</button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm rounded border border-slate-300 disabled:opacity-40">التالي</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 bg-white">
        {children}
      </select>
    </div>
  );
}

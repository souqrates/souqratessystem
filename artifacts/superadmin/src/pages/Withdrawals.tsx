import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, X } from "lucide-react";
import { api, type SuperWithdrawal, ApiError } from "@/lib/api";

const CURRENCIES = ["", "usdt", "ton", "skz", "stars"];

export default function WithdrawalsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("pending");
  const [currency, setCurrency] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [telegramId, setTelegramId] = useState("");
  const [tgQuery, setTgQuery] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkReason, setBulkReason] = useState("");
  const [bulkMsg, setBulkMsg] = useState<{ kind: "ok" | "warn" | "err"; text: string } | null>(null);
  const limit = 50;

  const q = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) q.set("status", status);
  if (currency) q.set("currency", currency);
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  if (telegramId) q.set("telegramId", telegramId);

  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "withdrawals", page, status, currency, from, to, telegramId],
    queryFn: () => api.get<{ data: SuperWithdrawal[]; total: number }>(`/superadmin/withdrawals?${q}`),
    refetchInterval: 6000,
  });

  const rows = data?.data ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / limit));
  const pendingRows = useMemo(() => rows.filter((w) => w.status === "pending"), [rows]);
  const selectedCount = selected.size;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["superadmin", "withdrawals"] });

  const bulkApproveMut = useMutation({
    mutationFn: () =>
      api.post<{ approved: number; failed: number; errors: { id: number; error: string }[] }>(
        "/superadmin/withdrawals/bulk-approve",
        { ids: Array.from(selected) },
      ),
    onSuccess: (res) => {
      const msg = res.failed > 0
        ? `تمت الموافقة على ${res.approved} طلب — فشل ${res.failed} (رصيد غير كافٍ أو حالة خاطئة)`
        : `تمت الموافقة على ${res.approved} طلب`;
      setBulkMsg({ kind: res.failed > 0 ? "warn" : "ok", text: msg });
      setSelected(new Set());
      invalidate();
      setTimeout(() => setBulkMsg(null), 5000);
    },
    onError: (e) => setBulkMsg({ kind: "err", text: e instanceof Error ? e.message : "فشل القبول الجماعي" }),
  });

  const bulkRejectMut = useMutation({
    mutationFn: () =>
      api.post<{ rejected: number; ids: number[] }>("/superadmin/withdrawals/bulk-reject", {
        ids: Array.from(selected),
        reason: bulkReason.trim() || null,
      }),
    onSuccess: (res) => {
      setBulkMsg({ kind: "ok", text: `تم رفض ${res.rejected} طلب` });
      setSelected(new Set());
      setBulkReason("");
      invalidate();
      setTimeout(() => setBulkMsg(null), 4000);
    },
    onError: (e) => setBulkMsg({ kind: "err", text: e instanceof Error ? e.message : "فشل الرفض الجماعي" }),
  });

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => {
      if (prev.size === pendingRows.length && pendingRows.length > 0) return new Set();
      return new Set(pendingRows.map((w) => w.id));
    });
  }

  function resetFilters() {
    setCurrency(""); setFrom(""); setTo(""); setTelegramId(""); setTgQuery(""); setPage(1);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">طلبات السحب</h1>
        <p className="text-slate-500 mt-1">قبول / رفض طلبات السحب — يُخصم الرصيد تلقائياً عند القبول</p>
      </header>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4 shadow-sm flex gap-2 flex-wrap">
        {["pending", "processing", "approved", "rejected", ""].map((s) => (
          <button
            key={s || "all"}
            onClick={() => { setStatus(s); setPage(1); setSelected(new Set()); }}
            className={`px-3 py-1.5 text-sm rounded-lg ${
              status === s ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {s === "pending" ? "بانتظار المراجعة"
              : s === "processing" ? "قيد التحويل"
              : s === "approved" ? "مقبولة"
              : s === "rejected" ? "مرفوضة"
              : "الكل"}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4 shadow-sm flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">العملة</span>
          <select value={currency} onChange={(e) => { setCurrency(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm">
            {CURRENCIES.map((c) => <option key={c || "all"} value={c}>{c ? c.toUpperCase() : "الكل"}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">من تاريخ</span>
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm" dir="ltr" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">إلى تاريخ</span>
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm" dir="ltr" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Telegram ID</span>
          <div className="flex gap-2">
            <input value={tgQuery} onChange={(e) => setTgQuery(e.target.value.replace(/[^0-9]/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter") { setTelegramId(tgQuery); setPage(1); } }}
              placeholder="123456789" dir="ltr"
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono w-40" />
            <button onClick={() => { setTelegramId(tgQuery); setPage(1); }}
              className="px-3 py-2 text-sm rounded-lg bg-slate-900 text-white hover:bg-slate-800">بحث</button>
          </div>
        </label>
        {(currency || from || to || telegramId) && (
          <button onClick={resetFilters} className="px-3 py-2 text-sm rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">
            مسح الفلاتر
          </button>
        )}
      </div>

      {/* Bulk action bar — pending tab only */}
      {status === "pending" && selectedCount > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-slate-700">{selectedCount} محدد</span>
          <button
            onClick={() => {
              if (!window.confirm(`الموافقة على ${selectedCount} طلب سحب؟ سيُخصم الرصيد فوراً.`)) return;
              bulkApproveMut.mutate();
            }}
            disabled={bulkApproveMut.isPending || bulkRejectMut.isPending}
            className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold disabled:opacity-40"
          >
            {bulkApproveMut.isPending ? "…" : `✅ قبول ${selectedCount} طلب`}
          </button>
          <input
            value={bulkReason}
            onChange={(e) => setBulkReason(e.target.value)}
            placeholder="سبب الرفض الجماعي (اختياري)"
            className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border border-slate-200 text-sm"
          />
          <button
            onClick={() => bulkRejectMut.mutate()}
            disabled={bulkRejectMut.isPending || bulkApproveMut.isPending}
            className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg font-semibold disabled:opacity-40"
          >
            {bulkRejectMut.isPending ? "…" : `رفض ${selectedCount} طلب`}
          </button>
          <button onClick={() => setSelected(new Set())} className="px-3 py-2 text-sm rounded-lg bg-white border border-slate-200 text-slate-600">
            إلغاء
          </button>
        </div>
      )}
      {bulkMsg && (
        <div className={`mb-4 text-sm px-4 py-2 rounded-lg ${
          bulkMsg.kind === "ok"   ? "bg-emerald-50 text-emerald-700" :
          bulkMsg.kind === "warn" ? "bg-amber-50 text-amber-700" :
                                    "bg-red-50 text-red-700"
        }`}>
          {bulkMsg.text}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="py-10 text-center text-slate-400">جارٍ التحميل…</div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-slate-400">لا توجد طلبات مطابقة</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-4 py-2 text-right w-8">
                  {status === "pending" && pendingRows.length > 0 && (
                    <input type="checkbox"
                      checked={selectedCount === pendingRows.length && pendingRows.length > 0}
                      onChange={toggleAll} className="w-4 h-4" />
                  )}
                </th>
                <th className="px-4 py-2 text-right">#</th>
                <th className="px-4 py-2 text-right">المستخدم</th>
                <th className="px-4 py-2 text-right">المبلغ</th>
                <th className="px-4 py-2 text-right">الصافي</th>
                <th className="px-4 py-2 text-right">الطريقة</th>
                <th className="px-4 py-2 text-right">العنوان</th>
                <th className="px-4 py-2 text-right">الحالة</th>
                <th className="px-4 py-2 text-right">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((w) => (
                <WithdrawalRow
                  key={w.id}
                  w={w}
                  selectable={status === "pending" && w.status === "pending"}
                  selected={selected.has(w.id)}
                  onToggle={() => toggle(w.id)}
                />
              ))}
            </tbody>
          </table>
        )}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
          <span className="text-xs text-slate-500">
            {data?.total ?? 0} طلب · صفحة {page} من {totalPages}
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

function WithdrawalRow({ w, selectable, selected, onToggle }: {
  w: SuperWithdrawal;
  selectable: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const qc = useQueryClient();
  const [actionOpen, setActionOpen] = useState<null | "approve" | "reject" | "force_reject">(null);
  const [txHash, setTxHash] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [isInsufficient, setIsInsufficient] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["superadmin", "withdrawals"] });

  const approveMut = useMutation({
    mutationFn: () => api.post(`/superadmin/withdrawals/${w.id}/approve`, { txHash: txHash.trim() || null }),
    onSuccess: () => { setActionOpen(null); setTxHash(""); setErr(null); setIsInsufficient(false); invalidate(); },
    onError: (e: ApiError) => {
      const isInsuf = e.status === 422 && e.message === "insufficient_funds_at_approval";
      setIsInsufficient(isInsuf);
      setErr(isInsuf
        ? "رصيد المستخدم غير كافٍ — تم إخطاره تلقائياً. شحن رصيده ثم حاول مجدداً، أو ارفض الطلب."
        : e.message);
    },
  });

  const rejectMut = useMutation({
    mutationFn: () => api.post(`/superadmin/withdrawals/${w.id}/reject`, { reason: reason.trim() }),
    onSuccess: () => { setActionOpen(null); setReason(""); setErr(null); setIsInsufficient(false); invalidate(); },
    onError: (e: ApiError) => setErr(e.message),
  });

  const statusCls: Record<string, string> = {
    pending:    "bg-amber-100 text-amber-700",
    processing: "bg-blue-100 text-blue-700",
    approved:   "bg-emerald-100 text-emerald-700",
    rejected:   "bg-red-100 text-red-700",
  };
  const statusLabel: Record<string, string> = {
    pending:    "بانتظار",
    processing: "قيد التحويل",
    approved:   "مقبولة",
    rejected:   "مرفوضة",
  };

  return (
    <>
      <tr className="hover:bg-slate-50">
        <td className="px-4 py-2">
          {selectable && (
            <input type="checkbox" checked={selected} onChange={onToggle} className="w-4 h-4" />
          )}
        </td>
        <td className="px-4 py-2 font-mono text-xs text-slate-500">{w.id}</td>
        <td className="px-4 py-2">
          <div className="font-medium text-slate-900">{w.userFirstName ?? "—"}</div>
          {w.userUsername && <div className="text-xs text-slate-500" dir="ltr">@{w.userUsername}</div>}
          <div className="font-mono text-[10px] text-slate-400" dir="ltr">
            {w.userTelegramId ? String(w.userTelegramId) : ""}
          </div>
        </td>
        <td className="px-4 py-2 font-mono" dir="ltr">
          {Number(w.amount).toFixed(4)}{" "}
          <span className="text-xs uppercase text-slate-500">{w.currency}</span>
        </td>
        <td className="px-4 py-2 font-mono text-xs" dir="ltr">{Number(w.netAmount).toFixed(4)}</td>
        <td className="px-4 py-2 text-xs">{w.method}</td>
        <td className="px-4 py-2 text-xs font-mono max-w-xs truncate" dir="ltr" title={w.address ?? ""}>
          {w.address ?? "—"}
        </td>
        <td className="px-4 py-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${statusCls[w.status] ?? "bg-slate-100"}`}>
            {statusLabel[w.status] ?? w.status}
          </span>
        </td>
        <td className="px-4 py-2">
          {w.status === "pending" && (
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => { setErr(null); setIsInsufficient(false); setActionOpen(actionOpen === "approve" ? null : "approve"); }}
                className="text-xs px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded"
              >قبول يدوي</button>
              <button
                onClick={() => { setErr(null); setIsInsufficient(false); setActionOpen(actionOpen === "reject" ? null : "reject"); }}
                className="text-xs px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded"
              >رفض</button>
            </div>
          )}
          {w.status === "processing" && (
            <div className="flex gap-1 flex-wrap items-center">
              <span className="text-xs text-blue-600" title="بانتظار تأكيد على الشبكة">قيد التحويل</span>
              <button
                onClick={() => { setErr(null); setActionOpen(actionOpen === "force_reject" ? null : "force_reject"); }}
                className="text-xs px-2 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded border border-orange-200"
                title="رفض قسري — يُستخدم عند تعذّر التحويل"
              >رفض قسري</button>
            </div>
          )}
          {w.status !== "pending" && w.status !== "processing" && (
            <span className="text-xs text-slate-400">—</span>
          )}
          {err && (
            <div className={`text-xs mt-1 rounded px-2 py-1 ${isInsufficient ? "bg-amber-50 text-amber-700 border border-amber-200" : "text-red-600"}`}>
              {isInsufficient && <AlertTriangle size={12} className="inline mr-1 text-amber-500" />}
              {err}
            </div>
          )}
        </td>
      </tr>

      {actionOpen === "approve" && (
        <tr className="bg-emerald-50/50">
          <td colSpan={9} className="px-4 py-3">
            <div className="flex items-center gap-2">
              <input
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder="Transaction hash (اختياري)"
                dir="ltr"
                className="flex-1 px-3 py-2 rounded-lg border border-emerald-200 font-mono text-sm"
              />
              <button
                onClick={() => approveMut.mutate()}
                disabled={approveMut.isPending}
                className="px-3 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold disabled:opacity-40"
              >{approveMut.isPending ? "…" : "تأكيد القبول وخصم الرصيد"}</button>
            </div>
            {err && (
              <div className={`text-sm mt-2 rounded px-3 py-2 ${isInsufficient ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                {isInsufficient ? <AlertTriangle size={12} className="inline mr-1 text-amber-500" /> : <X size={12} className="inline mr-1" />}{err}
                {isInsufficient && (
                  <button
                    onClick={() => { setActionOpen("reject"); setErr(null); setIsInsufficient(false); setReason("رصيد غير كافٍ عند الموافقة"); }}
                    className="mr-3 text-xs underline text-red-600 hover:text-red-800"
                  >رفض الطلب الآن</button>
                )}
              </div>
            )}
          </td>
        </tr>
      )}

      {(actionOpen === "reject" || actionOpen === "force_reject") && (
        <tr className="bg-red-50/50">
          <td colSpan={9} className="px-4 py-3">
            {actionOpen === "force_reject" && (
              <p className="text-xs text-orange-600 mb-2 font-medium">
                <AlertTriangle size={13} className="inline mr-1 text-orange-600" /> رفض قسري — يُستخدم عند تعذّر إتمام التحويل. سيُعاد الطلب إلى حالة "مرفوضة" وسيُخطر المستخدم.
              </p>
            )}
            <div className="flex items-center gap-2">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={actionOpen === "force_reject" ? "سبب الإلغاء القسري" : "سبب الرفض"}
                className="flex-1 px-3 py-2 rounded-lg border border-red-200 text-sm"
              />
              <button
                onClick={() => rejectMut.mutate()}
                disabled={rejectMut.isPending || !reason.trim()}
                className="px-3 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded font-semibold disabled:opacity-40"
              >{rejectMut.isPending ? "…" : actionOpen === "force_reject" ? "تأكيد الرفض القسري" : "تأكيد الرفض"}</button>
            </div>
            {err && <div className="text-red-600 text-sm mt-1">{err}</div>}
          </td>
        </tr>
      )}
    </>
  );
}

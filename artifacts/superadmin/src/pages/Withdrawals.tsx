import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type SuperWithdrawal, ApiError } from "@/lib/api";

export default function WithdrawalsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("pending");
  const limit = 50;

  const q = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) q.set("status", status);

  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "withdrawals", page, status],
    queryFn: () => api.get<{ data: SuperWithdrawal[]; total: number }>(`/superadmin/withdrawals?${q}`),
    refetchInterval: 6000,
  });

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / limit));

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">💳 طلبات السحب</h1>
        <p className="text-slate-500 mt-1">قبول / رفض طلبات السحب — يُخصم الرصيد تلقائياً عند القبول</p>
      </header>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4 shadow-sm flex gap-2 flex-wrap">
        {["pending", "processing", "approved", "rejected", ""].map((s) => (
          <button
            key={s || "all"}
            onClick={() => { setStatus(s); setPage(1); }}
            className={`px-3 py-1.5 text-sm rounded-lg ${
              status === s
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {s === "pending"
              ? "بانتظار المراجعة"
              : s === "processing"
              ? "قيد التحويل"
              : s === "approved"
              ? "مقبولة"
              : s === "rejected"
              ? "مرفوضة"
              : "الكل"}
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="py-10 text-center text-slate-400">جارٍ التحميل…</div>
        ) : (data?.data ?? []).length === 0 ? (
          <div className="py-10 text-center text-slate-400">لا توجد طلبات مطابقة</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
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
              {data!.data.map((w) => <WithdrawalRow key={w.id} w={w} />)}
            </tbody>
          </table>
        )}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
          <span className="text-xs text-slate-500">
            {data?.total ?? 0} طلب · صفحة {page} من {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm rounded border border-slate-300 disabled:opacity-40"
            >
              السابق
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm rounded border border-slate-300 disabled:opacity-40"
            >
              التالي
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WithdrawalRow({ w }: { w: SuperWithdrawal }) {
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
        <td className="px-4 py-2 font-mono text-xs text-slate-500">{w.id}</td>
        <td className="px-4 py-2">
          <div className="font-medium text-slate-900">{w.userFirstName ?? "—"}</div>
          {w.userUsername && (
            <div className="text-xs text-slate-500" dir="ltr">@{w.userUsername}</div>
          )}
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
        <td
          className="px-4 py-2 text-xs font-mono max-w-xs truncate"
          dir="ltr"
          title={w.address ?? ""}
        >
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
              >
                قبول يدوي
              </button>
              <button
                onClick={() => { setErr(null); setIsInsufficient(false); setActionOpen(actionOpen === "reject" ? null : "reject"); }}
                className="text-xs px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded"
              >
                رفض
              </button>
            </div>
          )}
          {w.status === "processing" && (
            <div className="flex gap-1 flex-wrap items-center">
              <span className="text-xs text-blue-600" title="بانتظار تأكيد على الشبكة">
                ⏳ قيد التحويل
              </span>
              <button
                onClick={() => { setErr(null); setActionOpen(actionOpen === "force_reject" ? null : "force_reject"); }}
                className="text-xs px-2 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded border border-orange-200"
                title="رفض قسري — يُستخدم عند تعذّر التحويل"
              >
                رفض قسري
              </button>
            </div>
          )}
          {w.status !== "pending" && w.status !== "processing" && (
            <span className="text-xs text-slate-400">—</span>
          )}
          {err && (
            <div
              className={`text-xs mt-1 rounded px-2 py-1 ${
                isInsufficient
                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                  : "text-red-600"
              }`}
            >
              {isInsufficient && "⚠️ "}
              {err}
            </div>
          )}
        </td>
      </tr>

      {actionOpen === "approve" && (
        <tr className="bg-emerald-50/50">
          <td colSpan={8} className="px-4 py-3">
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
              >
                {approveMut.isPending ? "…" : "تأكيد القبول وخصم الرصيد"}
              </button>
            </div>
            {err && (
              <div
                className={`text-sm mt-2 rounded px-3 py-2 ${
                  isInsufficient
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {isInsufficient ? "⚠️ " : "❌ "}{err}
                {isInsufficient && (
                  <button
                    onClick={() => { setActionOpen("reject"); setErr(null); setIsInsufficient(false); setReason("رصيد غير كافٍ عند الموافقة"); }}
                    className="mr-3 text-xs underline text-red-600 hover:text-red-800"
                  >
                    رفض الطلب الآن
                  </button>
                )}
              </div>
            )}
          </td>
        </tr>
      )}

      {(actionOpen === "reject" || actionOpen === "force_reject") && (
        <tr className="bg-red-50/50">
          <td colSpan={8} className="px-4 py-3">
            {actionOpen === "force_reject" && (
              <p className="text-xs text-orange-600 mb-2 font-medium">
                ⚠️ رفض قسري — يُستخدم عند تعذّر إتمام التحويل. سيُعاد الطلب إلى حالة "مرفوضة" وسيُخطر المستخدم.
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
              >
                {rejectMut.isPending ? "…" : actionOpen === "force_reject" ? "تأكيد الرفض القسري" : "تأكيد الرفض"}
              </button>
            </div>
            {err && <div className="text-red-600 text-sm mt-1">{err}</div>}
          </td>
        </tr>
      )}
    </>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

type AuditRow = {
  id: number;
  actor: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  payload: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  const limit = 50;

  const q = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (action) q.set("action", action);
  if (targetType) q.set("targetType", targetType);

  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "audit-log", page, action, targetType],
    queryFn: () =>
      api.get<{ data: AuditRow[]; total: number; page: number; limit: number }>(
        `/superadmin/audit-log?${q}`,
      ),
    refetchInterval: 15000,
  });

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / limit));

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">سجل تدقيق المدير</h1>
        <p className="text-slate-500 mt-1">
          كل فعل قام به المدير: من، متى، على ماذا. هذا هو الدفتر الرسمي للمسؤوليات.
        </p>
      </header>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">نوع الإجراء</label>
          <input
            value={action}
            onChange={(e) => { setAction(e.target.value); setPage(1); }}
            placeholder="مثلاً: withdrawal.approve"
            className={cls}
            dir="ltr"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">نوع الهدف</label>
          <input
            value={targetType}
            onChange={(e) => { setTargetType(e.target.value); setPage(1); }}
            placeholder="مثلاً: user / withdrawal / bot"
            className={cls}
            dir="ltr"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="py-10 text-center text-slate-400">جارٍ التحميل…</div>
        ) : (data?.data ?? []).length === 0 ? (
          <div className="py-10 text-center text-slate-400">
            لا يوجد سجل مطابق. عند هذه النقطة لم يُسجَّل أي فعل بهذه الفلاتر.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {data!.data.map((row) => <AuditRowView key={row.id} row={row} />)}
          </div>
        )}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
          <span className="text-xs text-slate-500">{data?.total ?? 0} سجل · صفحة {page} من {totalPages}</span>
          <div className="flex gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 text-sm rounded border border-slate-300 disabled:opacity-40">السابق</button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm rounded border border-slate-300 disabled:opacity-40">التالي</button>
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        يُكتب السجل تلقائياً من <code className="bg-slate-100 px-1 rounded" dir="ltr">logAdminAction()</code> في كل route سوبر-أدمن يغيّر بيانات.
      </p>
    </div>
  );
}

function AuditRowView({ row }: { row: AuditRow }) {
  const [open, setOpen] = useState(false);
  const hasPayload = row.payload !== null && row.payload !== undefined && !(typeof row.payload === "object" && Object.keys(row.payload as object).length === 0);
  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-indigo-100 text-indigo-700">
          {row.action}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1">
            <span className="font-mono">{row.actor}</span>
            <span>·</span>
            <span dir="ltr">{new Date(row.createdAt).toLocaleString("ar-EG")}</span>
            {row.targetType && (
              <>
                <span>·</span>
                <span dir="ltr" className="font-mono">{row.targetType}{row.targetId ? `:${row.targetId}` : ""}</span>
              </>
            )}
            {row.ip && <span dir="ltr" className="font-mono text-slate-400">· {row.ip}</span>}
          </div>
          {hasPayload && (
            <button onClick={() => setOpen((v) => !v)} className="text-xs text-indigo-600 hover:underline">
              {open ? "إخفاء البيانات" : "إظهار البيانات"}
            </button>
          )}
          {open && hasPayload && (
            <pre className="mt-2 text-xs bg-slate-100 text-slate-700 p-3 rounded overflow-x-auto" dir="ltr">
              {JSON.stringify(row.payload, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

const cls = "w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-indigo-500";

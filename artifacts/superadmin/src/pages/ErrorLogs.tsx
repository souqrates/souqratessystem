import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { api, type SuperErrorLog } from "@/lib/api";

export default function ErrorLogsPage() {
  const [page, setPage] = useState(1);
  const [source, setSource] = useState("");
  const [level, setLevel] = useState("");
  const [resolved, setResolved] = useState("");
  const limit = 50;
  const qc = useQueryClient();

  const q = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (source) q.set("source", source);
  if (level) q.set("level", level);
  if (resolved) q.set("resolved", resolved);

  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "error-logs", page, source, level, resolved],
    queryFn: () => api.get<{ data: SuperErrorLog[]; total: number }>(`/superadmin/error-logs?${q}`),
    refetchInterval: 8000,
  });

  const resolveMut = useMutation({
    mutationFn: (id: number) => api.post(`/superadmin/error-logs/${id}/resolve`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["superadmin", "error-logs"] }),
  });
  const delMut = useMutation({
    mutationFn: (id: number) => api.del(`/superadmin/error-logs/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["superadmin", "error-logs"] }),
  });

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / limit));

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><AlertTriangle size={22} className="text-amber-500" /> سجل الأخطاء</h1>
        <p className="text-slate-500 mt-1">أخطاء وقعت في البوتات أو الخادم — مع إمكانية وضع علامة "تم الحل"</p>
      </header>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">المصدر</label>
          <input value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }}
            placeholder="مثلاً: games-bot" className={cls} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">المستوى</label>
          <select value={level} onChange={(e) => { setLevel(e.target.value); setPage(1); }} className={cls}>
            <option value="">الكل</option>
            <option value="error">error</option>
            <option value="warn">warn</option>
            <option value="fatal">fatal</option>
            <option value="info">info</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">الحالة</label>
          <select value={resolved} onChange={(e) => { setResolved(e.target.value); setPage(1); }} className={cls}>
            <option value="">الكل</option>
            <option value="false">مفتوح</option>
            <option value="true">تم الحل</option>
          </select>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="py-10 text-center text-slate-400">جارٍ التحميل…</div>
        ) : (data?.data ?? []).length === 0 ? (
          <div className="py-10 text-center text-slate-400">
            لا توجد أخطاء مسجّلة — كل شيء على ما يرام.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {data!.data.map((e) => <ErrorRow key={e.id} log={e}
              onResolve={() => resolveMut.mutate(e.id)}
              onDelete={() => { if (confirm("حذف هذا السجل؟")) delMut.mutate(e.id); }}
            />)}
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
        لربط الأخطاء بهذا السجل تلقائياً، استدعِ <code className="bg-slate-100 px-1 rounded" dir="ltr">INSERT INTO error_logs (source, level, message, stack)</code> من البوتات/الخادم.
      </p>
    </div>
  );
}

function ErrorRow({ log, onResolve, onDelete }: { log: SuperErrorLog; onResolve: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const levelCls: Record<string, string> = {
    error: "bg-red-100 text-red-700",
    fatal: "bg-red-200 text-red-900",
    warn: "bg-amber-100 text-amber-700",
    info: "bg-sky-100 text-sky-700",
  };
  return (
    <div className={`p-4 ${log.resolved ? "opacity-50" : ""}`}>
      <div className="flex items-start gap-3">
        <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${levelCls[log.level] ?? "bg-slate-100"}`}>{log.level}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span className="font-mono">{log.source}</span>
            <span>·</span>
            <span dir="ltr">{new Date(log.createdAt).toLocaleString("ar-EG")}</span>
            {log.userTelegramId && <span dir="ltr" className="font-mono">· tid:{String(log.userTelegramId)}</span>}
            {log.resolved && <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">تم الحل</span>}
          </div>
          <div className="font-medium text-slate-900 break-words">{log.message}</div>
          {(log.stack != null || log.metadata != null) && (
            <button onClick={() => setOpen((v) => !v)} className="text-xs text-indigo-600 hover:underline mt-1">
              {open ? "إخفاء التفاصيل" : "إظهار التفاصيل"}
            </button>
          )}
          {open && (
            <div className="mt-2 space-y-2">
              {log.stack && <pre className="text-xs bg-slate-900 text-slate-200 p-3 rounded overflow-x-auto" dir="ltr">{log.stack}</pre>}
              {log.metadata !== null && log.metadata !== undefined && (
                <pre className="text-xs bg-slate-100 text-slate-700 p-3 rounded overflow-x-auto" dir="ltr">{JSON.stringify(log.metadata, null, 2)}</pre>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          {!log.resolved && (
            <button onClick={onResolve} className="text-xs px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded">حل</button>
          )}
          <button onClick={onDelete} className="text-xs px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded">حذف</button>
        </div>
      </div>
    </div>
  );
}

const cls = "w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-indigo-500";

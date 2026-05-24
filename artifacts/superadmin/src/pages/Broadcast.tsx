import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type SuperBroadcast, ApiError } from "@/lib/api";
import { BOTS } from "@/lib/bots-meta";

export default function BroadcastPage() {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"all" | "bot" | "single">("all");
  const [targetValue, setTargetValue] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const { data: list } = useQuery({
    queryKey: ["superadmin", "broadcasts"],
    queryFn: () => api.get<{ data: SuperBroadcast[] }>("/superadmin/broadcasts"),
    refetchInterval: 4000,
  });

  const sendMut = useMutation({
    mutationFn: () => api.post<SuperBroadcast>("/superadmin/broadcasts", {
      body, audience, targetValue: audience === "all" ? null : targetValue.trim(),
    }),
    onSuccess: (b) => {
      setBody(""); setTargetValue("");
      setMsg({ type: "ok", text: `تم بدء الإرسال إلى ${b.totalCount} مستلم` });
      qc.invalidateQueries({ queryKey: ["superadmin", "broadcasts"] });
    },
    onError: (e: ApiError) => setMsg({ type: "err", text: e.message }),
  });

  const canSend = body.trim().length > 0 && (audience === "all" || targetValue.trim().length > 0);

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">📢 إشعار جماعي</h1>
        <p className="text-slate-500 mt-1">أرسل رسالة عبر البوت الأم إلى مستخدمين محددين أو الجميع</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-slate-900 mb-4">إنشاء رسالة جديدة</h2>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">الجمهور</label>
              <select value={audience} onChange={(e) => setAudience(e.target.value as "all" | "bot" | "single")}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500">
                <option value="all">كل المستخدمين النشطين</option>
                <option value="bot">مستخدمو بوت محدد</option>
                <option value="single">مستخدم واحد (Telegram ID)</option>
              </select>
            </div>

            {audience === "bot" && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">البوت</label>
                <select value={targetValue} onChange={(e) => setTargetValue(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500">
                  <option value="">— اختر —</option>
                  {BOTS.map((b) => <option key={b.slug} value={b.slug}>{b.brand} ({b.arName})</option>)}
                </select>
              </div>
            )}

            {audience === "single" && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Telegram ID</label>
                <input value={targetValue} onChange={(e) => setTargetValue(e.target.value)} dir="ltr"
                  placeholder="123456789"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm focus:ring-2 focus:ring-indigo-500" />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">نص الرسالة (يدعم HTML)</label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6}
                placeholder="مرحباً 👋 لدينا تحديث جديد…"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm focus:ring-2 focus:ring-indigo-500" />
              <div className="text-xs text-slate-500 mt-1">{body.length} حرفاً</div>
            </div>

            <button onClick={() => { setMsg(null); if (confirm("تأكيد الإرسال؟")) sendMut.mutate(); }}
              disabled={!canSend || sendMut.isPending}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-40">
              {sendMut.isPending ? "جارٍ البدء…" : "إرسال 📤"}
            </button>

            {msg && (
              <div className={`text-sm ${msg.type === "ok" ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</div>
            )}
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-slate-900 mb-3">معاينة</h2>
          <div className="rounded-2xl bg-[#e7ebf0] p-4 min-h-[200px]">
            <div className="inline-block max-w-full bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="text-xs text-indigo-700 font-bold mb-1">SOUQRATES SYSTEM</div>
              <div className="text-sm text-slate-800 whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: escapeAllowBR(body) || "<span class='text-slate-400 italic'>(فارغ)</span>" }} />
              <div className="text-[10px] text-slate-400 text-left mt-1">10:30 ✓✓</div>
            </div>
          </div>
        </section>
      </div>

      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">سجل الإشعارات (آخر 50)</h2>
          <span className="text-xs text-slate-500">تحديث تلقائي كل 4 ثوانٍ</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-4 py-2 text-right">#</th>
              <th className="px-4 py-2 text-right">الجمهور</th>
              <th className="px-4 py-2 text-right">النص</th>
              <th className="px-4 py-2 text-right">التقدم</th>
              <th className="px-4 py-2 text-right">الحالة</th>
              <th className="px-4 py-2 text-right">التاريخ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(list?.data ?? []).length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-slate-400">لا توجد إشعارات بعد</td></tr>
            ) : list!.data.map((b) => (
              <tr key={b.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 text-xs text-slate-500 font-mono">{b.id}</td>
                <td className="px-4 py-2 text-xs">{b.audience}{b.targetValue ? <span className="text-slate-500"> · {b.targetValue}</span> : ""}</td>
                <td className="px-4 py-2 text-slate-700 max-w-md truncate" title={b.body}>{b.body}</td>
                <td className="px-4 py-2 text-xs font-mono" dir="ltr">{b.sentCount}/{b.totalCount} <span className="text-red-500">({b.failedCount} فشل)</span></td>
                <td className="px-4 py-2"><BroadcastStatusBadge status={b.status} /></td>
                <td className="px-4 py-2 text-xs text-slate-500" dir="ltr">{new Date(b.createdAt).toLocaleString("ar-EG")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function BroadcastStatusBadge({ status }: { status: string }) {
  const m: Record<string, string> = {
    pending: "bg-slate-200 text-slate-700",
    sending: "bg-amber-100 text-amber-700",
    completed: "bg-emerald-100 text-emerald-700",
    failed: "bg-red-100 text-red-700",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${m[status] ?? "bg-slate-100"}`}>{status}</span>;
}

// Allow Telegram-style HTML (<b>, <i>, <a>, <code>) in preview; escape everything else minimally.
function escapeAllowBR(s: string): string {
  if (!s) return "";
  // Only escape stray < > characters that aren't part of allowed tags.
  // Simpler: trust input and just convert newlines to <br>. Body is admin-supplied.
  return s.replace(/\n/g, "<br>");
}

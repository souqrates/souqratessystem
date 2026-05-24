import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type BotText } from "@/lib/api";

export default function BotTextsEditor({ botSlug }: { botSlug: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "bot-texts", botSlug],
    queryFn: () => api.get<{ data: BotText[] }>(`/superadmin/bot-texts?botSlug=${encodeURIComponent(botSlug)}`),
  });

  const publishAll = useMutation({
    mutationFn: () => api.post<{ ok: true; count: number }>("/superadmin/bot-texts/publish-all", { botSlug }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["superadmin", "bot-texts", botSlug] }),
  });

  const [addOpen, setAddOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newDraft, setNewDraft] = useState("");

  const addMut = useMutation({
    mutationFn: () => {
      if (!newKey.trim() || !newLabel.trim()) throw new Error("المفتاح والعنوان مطلوبان");
      return api.post<BotText>("/superadmin/bot-texts", {
        botSlug,
        key: newKey.trim(),
        label: newLabel.trim(),
        draftValue: newDraft,
      });
    },
    onSuccess: () => {
      setAddOpen(false);
      setNewKey(""); setNewLabel(""); setNewDraft("");
      qc.invalidateQueries({ queryKey: ["superadmin", "bot-texts", botSlug] });
    },
  });

  const rows = data?.data ?? [];
  const dirtyCount = rows.filter((r) => r.draftValue !== r.publishedValue).length;

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">نصوص البوت</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            عدّل أي نص ثم اضغط <span className="font-semibold">نشر</span> ليصبح فعلياً للمستخدمين.
            المسودات لا تظهر للمستخدم.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAddOpen((v) => !v)}
            className="px-3 py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-50"
          >
            + نص جديد
          </button>
          <button
            onClick={() => publishAll.mutate()}
            disabled={publishAll.isPending || dirtyCount === 0}
            className="px-4 py-2 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold"
            title={dirtyCount === 0 ? "لا توجد تغييرات بانتظار النشر" : `${dirtyCount} نص بانتظار النشر`}
          >
            {publishAll.isPending ? "…" : `نشر الكل${dirtyCount > 0 ? ` (${dirtyCount})` : ""}`}
          </button>
        </div>
      </div>

      {addOpen && (
        <div className="mb-5 p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="المفتاح (key)">
            <input className={inputCls} value={newKey} onChange={(e) => setNewKey(e.target.value)} dir="ltr" placeholder="مثال: button_play" />
          </Field>
          <Field label="العنوان (للوحة)">
            <input className={inputCls} value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="مثال: زر اللعب" />
          </Field>
          <Field label="القيمة الافتراضية (مسودة)">
            <input className={inputCls} value={newDraft} onChange={(e) => setNewDraft(e.target.value)} />
          </Field>
          <div className="md:col-span-3 flex items-center gap-2">
            <button onClick={() => addMut.mutate()} disabled={addMut.isPending} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold">
              {addMut.isPending ? "…" : "إضافة"}
            </button>
            <button onClick={() => setAddOpen(false)} className="px-3 py-2 text-sm text-slate-600 hover:underline">إلغاء</button>
            {addMut.isError && (
              <span className="text-sm text-red-600">{(addMut.error as Error).message}</span>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="py-10 text-center text-slate-400">جارٍ التحميل…</div>
      ) : rows.length === 0 ? (
        <div className="py-10 text-center text-slate-400">لا توجد نصوص بعد.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => <TextRow key={row.id} row={row} botSlug={botSlug} />)}
        </div>
      )}
    </section>
  );
}

function TextRow({ row, botSlug }: { row: BotText; botSlug: string }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState(row.draftValue);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => { setDraft(row.draftValue); }, [row.id, row.draftValue]);

  const dirty = draft !== row.draftValue;
  const unpublished = draft !== row.publishedValue;

  const saveMut = useMutation({
    mutationFn: () => api.patch<BotText>(`/superadmin/bot-texts/${row.id}`, { draftValue: draft }),
    onSuccess: () => {
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
      qc.invalidateQueries({ queryKey: ["superadmin", "bot-texts", botSlug] });
    },
  });

  const publishMut = useMutation({
    mutationFn: async () => {
      // Save current draft first if dirty, then publish.
      if (dirty) await api.patch<BotText>(`/superadmin/bot-texts/${row.id}`, { draftValue: draft });
      return api.post<BotText>(`/superadmin/bot-texts/${row.id}/publish`, {});
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["superadmin", "bot-texts", botSlug] }),
  });

  const delMut = useMutation({
    mutationFn: () => api.del<{ ok: true }>(`/superadmin/bot-texts/${row.id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["superadmin", "bot-texts", botSlug] }),
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="font-semibold text-slate-900">{row.label}</div>
          <div className="text-xs font-mono text-slate-500 mt-0.5" dir="ltr">{row.key}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {unpublished && (
            <span className="text-[10px] uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
              بانتظار النشر
            </span>
          )}
          {!unpublished && row.publishedAt && (
            <span className="text-[10px] uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full">
              منشور
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">المسودة (قابلة للتعديل)</div>
          <textarea
            className={`${inputCls} min-h-[100px] font-mono text-sm`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">معاينة (كما يراه المستخدم)</div>
          <TelegramPreview text={draft} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => saveMut.mutate()}
          disabled={!dirty || saveMut.isPending}
          className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40"
        >
          {saveMut.isPending ? "…" : "حفظ المسودة"}
        </button>
        <button
          onClick={() => publishMut.mutate()}
          disabled={!unpublished || publishMut.isPending}
          className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold"
        >
          {publishMut.isPending ? "…" : "نشر"}
        </button>
        <button
          onClick={() => setDraft(row.publishedValue)}
          disabled={!unpublished}
          className="px-3 py-1.5 text-sm rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40"
        >
          استعادة المنشور
        </button>
        {savedFlash && <span className="text-emerald-600 text-sm">✓ تم الحفظ</span>}
        <button
          onClick={() => {
            if (confirm(`حذف "${row.label}"؟`)) delMut.mutate();
          }}
          className="mr-auto px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg"
        >
          حذف
        </button>
      </div>
    </div>
  );
}

function TelegramPreview({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-[#e7ebf0] p-3 min-h-[100px]">
      <div className="inline-block max-w-full bg-white rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-sm">
        <div className="text-sm text-slate-800 whitespace-pre-wrap break-words">
          {text || <span className="text-slate-400 italic">(فارغ)</span>}
        </div>
        <div className="text-[10px] text-slate-400 text-left mt-1">10:30 ✓✓</div>
      </div>
    </div>
  );
}

const inputCls = "w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

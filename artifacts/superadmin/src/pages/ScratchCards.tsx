import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Check, X, ToggleLeft, ToggleRight } from "lucide-react";
import { api, ApiError } from "@/lib/api";

interface ScratchCard {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  isActive: boolean;
  buyPriceSKZ: string;
  winRate: string;
  maxPrizeSKZ: string;
  jackpotValueSKZ: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

const EMPTY_FORM = {
  slug: "", name: "", description: "",
  buyPriceSKZ: "10", winRate: "0.30",
  maxPrizeSKZ: "100", jackpotValueSKZ: "1000",
  displayOrder: "0",
};

type FormData = typeof EMPTY_FORM;

export default function ScratchCardsPage() {
  const qc = useQueryClient();
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<FormData>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<FormData>(EMPTY_FORM);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "scratch-cards"],
    queryFn: () => api.get<{ data: ScratchCard[] }>("/superadmin/scratch-cards"),
  });
  const cards = data?.data ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["superadmin", "scratch-cards"] });
  const flash = (kind: "ok" | "err", text: string) => {
    setMsg({ kind, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const patchMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      api.patch<ScratchCard>(`/superadmin/scratch-cards/${id}`, body),
    onSuccess: () => { setEditId(null); invalidate(); flash("ok", "تم الحفظ"); },
    onError: (e) => flash("err", e instanceof ApiError ? e.message : "فشل الحفظ"),
  });

  const createMut = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post<ScratchCard>("/superadmin/scratch-cards", body),
    onSuccess: () => { setCreating(false); setCreateForm(EMPTY_FORM); invalidate(); flash("ok", "تمت الإضافة"); },
    onError: (e) => flash("err", e instanceof ApiError ? e.message : "فشل الإنشاء"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.del<{ ok: boolean }>(`/superadmin/scratch-cards/${id}`),
    onSuccess: () => { invalidate(); flash("ok", "تم الحذف"); },
    onError: (e) => flash("err", e instanceof ApiError ? e.message : "فشل الحذف"),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      api.patch<ScratchCard>(`/superadmin/scratch-cards/${id}`, { isActive }),
    onSuccess: () => invalidate(),
  });

  function startEdit(c: ScratchCard) {
    setEditId(c.id);
    setEditForm({
      slug: c.slug, name: c.name, description: c.description ?? "",
      buyPriceSKZ: c.buyPriceSKZ, winRate: c.winRate,
      maxPrizeSKZ: c.maxPrizeSKZ, jackpotValueSKZ: c.jackpotValueSKZ,
      displayOrder: String(c.displayOrder),
    });
  }

  function saveEdit(id: number) {
    patchMut.mutate({ id, body: {
      name: editForm.name, description: editForm.description,
      buyPriceSKZ: parseFloat(editForm.buyPriceSKZ),
      winRate: parseFloat(editForm.winRate),
      maxPrizeSKZ: parseFloat(editForm.maxPrizeSKZ),
      jackpotValueSKZ: parseFloat(editForm.jackpotValueSKZ),
      displayOrder: parseInt(editForm.displayOrder),
    }});
  }

  function submitCreate() {
    createMut.mutate({
      slug: createForm.slug, name: createForm.name, description: createForm.description,
      buyPriceSKZ: parseFloat(createForm.buyPriceSKZ),
      winRate: parseFloat(createForm.winRate),
      maxPrizeSKZ: parseFloat(createForm.maxPrizeSKZ),
      jackpotValueSKZ: parseFloat(createForm.jackpotValueSKZ),
      displayOrder: parseInt(createForm.displayOrder),
    });
  }

  const iCls = "border border-slate-300 rounded-lg px-2 py-1 text-sm w-full";
  const numCls = `${iCls} text-left font-mono`;

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">بطاقات الحك واربح</h1>
          <p className="text-slate-500 mt-1">
            إدارة كتالوج بطاقات SOUQRATES SCRATCHY — أسعار الشراء، نسب الفوز، والجوائز القصوى.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl"
        >
          <Plus size={16} /> بطاقة جديدة
        </button>
      </header>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium ${msg.kind === "ok" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
          {msg.text}
        </div>
      )}

      {isLoading ? (
        <div className="py-20 text-center text-slate-400">جارٍ التحميل…</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">
                <th className="px-3 py-3">الترتيب</th>
                <th className="px-3 py-3">الاسم / الـ Slug</th>
                <th className="px-3 py-3">السعر (SKZ)</th>
                <th className="px-3 py-3">نسبة الفوز</th>
                <th className="px-3 py-3">أقصى جائزة</th>
                <th className="px-3 py-3">الجاكبوت</th>
                <th className="px-3 py-3 text-center">تفعيل</th>
                <th className="px-3 py-3">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cards.map((c) => {
                const isEditing = editId === c.id;
                return (
                  <tr key={c.id} className={isEditing ? "bg-indigo-50" : "hover:bg-slate-50"}>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <input type="number" className={numCls} style={{ width: 60 }} value={editForm.displayOrder}
                          onChange={(e) => setEditForm((f) => ({ ...f, displayOrder: e.target.value }))} />
                      ) : (
                        <span className="text-slate-500">{c.displayOrder}</span>
                      )}
                    </td>

                    <td className="px-3 py-2">
                      {isEditing ? (
                        <input className={iCls} value={editForm.name}
                          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder="اسم البطاقة" />
                      ) : (
                        <div>
                          <div className="font-semibold text-slate-900">{c.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{c.slug}</div>
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-2">
                      {isEditing ? (
                        <input type="number" min="0" step="0.01" className={numCls} style={{ width: 90 }} value={editForm.buyPriceSKZ}
                          onChange={(e) => setEditForm((f) => ({ ...f, buyPriceSKZ: e.target.value }))} />
                      ) : (
                        <span className="font-mono text-slate-800">{parseFloat(c.buyPriceSKZ).toLocaleString()}</span>
                      )}
                    </td>

                    <td className="px-3 py-2">
                      {isEditing ? (
                        <input type="number" min="0" max="1" step="0.01" className={numCls} style={{ width: 80 }} value={editForm.winRate}
                          onChange={(e) => setEditForm((f) => ({ ...f, winRate: e.target.value }))} />
                      ) : (
                        <span className="font-mono text-slate-800">
                          {(parseFloat(c.winRate) * 100).toFixed(1)}%
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-2">
                      {isEditing ? (
                        <input type="number" min="0" step="1" className={numCls} style={{ width: 100 }} value={editForm.maxPrizeSKZ}
                          onChange={(e) => setEditForm((f) => ({ ...f, maxPrizeSKZ: e.target.value }))} />
                      ) : (
                        <span className="font-mono text-slate-800">{parseFloat(c.maxPrizeSKZ).toLocaleString()}</span>
                      )}
                    </td>

                    <td className="px-3 py-2">
                      {isEditing ? (
                        <input type="number" min="0" step="1" className={numCls} style={{ width: 110 }} value={editForm.jackpotValueSKZ}
                          onChange={(e) => setEditForm((f) => ({ ...f, jackpotValueSKZ: e.target.value }))} />
                      ) : (
                        <span className="font-mono font-semibold text-amber-700">{parseFloat(c.jackpotValueSKZ).toLocaleString()}</span>
                      )}
                    </td>

                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => toggleMut.mutate({ id: c.id, isActive: !c.isActive })}
                        disabled={toggleMut.isPending}
                        className={`transition ${c.isActive ? "text-emerald-600 hover:text-emerald-700" : "text-slate-400 hover:text-slate-600"}`}
                        title={c.isActive ? "إيقاف" : "تفعيل"}
                      >
                        {c.isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                      </button>
                    </td>

                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <>
                            <button onClick={() => saveEdit(c.id)} disabled={patchMut.isPending}
                              className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200">
                              <Check size={14} />
                            </button>
                            <button onClick={() => setEditId(null)}
                              className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(c)}
                              className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => { if (confirm(`حذف "${c.name}"؟`)) deleteMut.mutate(c.id); }}
                              className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100">
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create new card row */}
      {creating && (
        <div className="mt-4 bg-white border-2 border-indigo-300 rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-4">إضافة بطاقة جديدة</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">الاسم</label>
              <input className={iCls} value={createForm.name} placeholder="مثال: Crystal Card"
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">الـ Slug (فريد)</label>
              <input className={iCls} value={createForm.slug} placeholder="crystal" dir="ltr"
                onChange={(e) => setCreateForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">الترتيب</label>
              <input type="number" className={numCls} value={createForm.displayOrder}
                onChange={(e) => setCreateForm((f) => ({ ...f, displayOrder: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">السعر (SKZ)</label>
              <input type="number" min="0" step="0.01" className={numCls} value={createForm.buyPriceSKZ}
                onChange={(e) => setCreateForm((f) => ({ ...f, buyPriceSKZ: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">نسبة الفوز (0-1)</label>
              <input type="number" min="0" max="1" step="0.01" className={numCls} value={createForm.winRate}
                onChange={(e) => setCreateForm((f) => ({ ...f, winRate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">أقصى جائزة (SKZ)</label>
              <input type="number" min="0" className={numCls} value={createForm.maxPrizeSKZ}
                onChange={(e) => setCreateForm((f) => ({ ...f, maxPrizeSKZ: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">الجاكبوت (SKZ)</label>
              <input type="number" min="0" className={numCls} value={createForm.jackpotValueSKZ}
                onChange={(e) => setCreateForm((f) => ({ ...f, jackpotValueSKZ: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">الوصف (اختياري)</label>
              <input className={iCls} value={createForm.description} placeholder="وصف مختصر"
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={submitCreate} disabled={createMut.isPending || !createForm.name || !createForm.slug}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl">
              {createMut.isPending ? "جارٍ الإضافة…" : "إضافة"}
            </button>
            <button onClick={() => { setCreating(false); setCreateForm(EMPTY_FORM); }}
              className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded-xl">
              إلغاء
            </button>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-500">
        {cards.length} بطاقة مسجّلة · {cards.filter((c) => c.isActive).length} مفعّلة.
        استخدم أيقونة التبديل لإيقاف/تفعيل بطاقة فوراً، وأيقونة القلم لتعديل الأسعار.
      </p>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type SuperLink } from "@/lib/api";

export default function LinksPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "links"],
    queryFn: () => api.get<{ data: SuperLink[] }>("/superadmin/links"),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ key: "", label: "", url: "", category: "general", notes: "" });

  const addMut = useMutation({
    mutationFn: () => api.post<SuperLink>("/superadmin/links", { ...form, isActive: true }),
    onSuccess: () => {
      setOpen(false); setForm({ key: "", label: "", url: "", category: "general", notes: "" });
      qc.invalidateQueries({ queryKey: ["superadmin", "links"] });
    },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">🔗 الروابط الخارجية و CDN</h1>
          <p className="text-slate-500 mt-1">قاعدة بيانات الروابط المستخدمة عبر كل البوتات (مرجع موحّد)</p>
        </div>
        <button onClick={() => setOpen((v) => !v)}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold">
          + رابط جديد
        </button>
      </header>

      {open && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="المفتاح (key)">
            <input className={cls} dir="ltr" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="مثل: support_channel" />
          </Field>
          <Field label="التصنيف">
            <select className={cls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="general">عام</option>
              <option value="cdn">CDN / أصول</option>
              <option value="social">قنوات اجتماعية</option>
              <option value="support">دعم</option>
              <option value="legal">قانوني</option>
              <option value="api">API خارجي</option>
            </select>
          </Field>
          <Field label="العنوان"><input className={cls} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></Field>
          <Field label="URL"><input className={cls} dir="ltr" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" /></Field>
          <Field label="ملاحظات (اختياري)"><input className={cls} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="md:col-span-2 flex gap-2">
            <button onClick={() => addMut.mutate()} disabled={addMut.isPending || !form.key || !form.label || !form.url}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-40">
              {addMut.isPending ? "…" : "حفظ"}
            </button>
            <button onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-slate-600">إلغاء</button>
            {addMut.isError && <span className="text-red-600 text-sm self-center">{(addMut.error as Error).message}</span>}
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? <div className="py-10 text-center text-slate-400">جارٍ التحميل…</div>
        : (data?.data ?? []).length === 0 ? <div className="py-10 text-center text-slate-400">لا توجد روابط بعد — ابدأ بإضافة رابط جديد.</div>
        : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-4 py-2 text-right">المفتاح</th>
                <th className="px-4 py-2 text-right">العنوان</th>
                <th className="px-4 py-2 text-right">التصنيف</th>
                <th className="px-4 py-2 text-right">URL</th>
                <th className="px-4 py-2 text-right">الحالة</th>
                <th className="px-4 py-2 text-right">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data!.data.map((l) => <LinkRow key={l.id} link={l} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function LinkRow({ link }: { link: SuperLink }) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ label: link.label, url: link.url, category: link.category, notes: link.notes ?? "" });

  const saveMut = useMutation({
    mutationFn: () => api.patch<SuperLink>(`/superadmin/links/${link.id}`, form),
    onSuccess: () => { setEdit(false); qc.invalidateQueries({ queryKey: ["superadmin", "links"] }); },
  });
  const toggleMut = useMutation({
    mutationFn: () => api.patch<SuperLink>(`/superadmin/links/${link.id}`, { isActive: !link.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["superadmin", "links"] }),
  });
  const delMut = useMutation({
    mutationFn: () => api.del<{ ok: true }>(`/superadmin/links/${link.id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["superadmin", "links"] }),
  });

  if (edit) {
    return (
      <tr className="bg-slate-50">
        <td className="px-4 py-2 font-mono text-xs text-slate-500" dir="ltr">{link.key}</td>
        <td className="px-4 py-2"><input className={cls} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></td>
        <td className="px-4 py-2">
          <select className={cls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="general">عام</option><option value="cdn">CDN</option><option value="social">اجتماعي</option>
            <option value="support">دعم</option><option value="legal">قانوني</option><option value="api">API</option>
          </select>
        </td>
        <td className="px-4 py-2"><input className={cls} dir="ltr" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></td>
        <td className="px-4 py-2 text-xs text-slate-500">—</td>
        <td className="px-4 py-2">
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="text-emerald-600 hover:underline text-sm font-semibold ml-2">حفظ</button>
          <button onClick={() => setEdit(false)} className="text-slate-500 text-sm">إلغاء</button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-2 font-mono text-xs text-slate-700" dir="ltr">{link.key}</td>
      <td className="px-4 py-2 text-slate-800">{link.label}</td>
      <td className="px-4 py-2 text-xs"><span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{link.category}</span></td>
      <td className="px-4 py-2 text-xs">
        <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline truncate inline-block max-w-xs" dir="ltr">{link.url}</a>
      </td>
      <td className="px-4 py-2">
        <button onClick={() => toggleMut.mutate()} className={`text-xs px-2 py-0.5 rounded-full ${link.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
          {link.isActive ? "نشط" : "موقوف"}
        </button>
      </td>
      <td className="px-4 py-2">
        <button onClick={() => setEdit(true)} className="text-indigo-600 hover:underline text-sm ml-2">تعديل</button>
        <button onClick={() => { if (confirm(`حذف ${link.key}؟`)) delMut.mutate(); }} className="text-red-600 hover:underline text-sm">حذف</button>
      </td>
    </tr>
  );
}

const cls = "w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-indigo-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-xs font-semibold text-slate-600 mb-1">{label}</span>{children}</label>;
}

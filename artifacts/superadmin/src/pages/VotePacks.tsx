import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";

interface VotePack {
  id: number;
  name: string;
  description: string | null;
  votes: number;
  bonusVotes: number;
  priceSkz: string;
  bonusFileUrl: string | null;
  bonusFileName: string | null;
  bonusDescription: string | null;
  coverUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export default function VotePacksPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "vote-packs"],
    queryFn: () => api.get<VotePack[]>("/superadmin/contests/packs"),
  });
  const packs = data ?? [];

  const [showCreate, setShowCreate] = useState(false);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["superadmin", "vote-packs"] });

  return (
    <div className="p-8 max-w-7xl mx-auto" dir="rtl">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">باقات التصويت — SOUQRATES STAGE</h1>
          <p className="text-slate-500 mt-1">
            باقات قابلة لإعادة الاستخدام. كل باقة تمنح <b>عدد أصوات</b> + <b>أصوات إضافية</b> اختيارية. يمكن إرفاق <b>ملف مكافأة</b> (مثلًا PDF كتاب) ليتحوّل الباقة إلى عرض حُزمة.
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="px-5 py-2.5 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600 shadow">
          + باقة جديدة
        </button>
      </header>

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">جارٍ التحميل…</div>
      ) : packs.length === 0 ? (
        <div className="text-sm text-slate-400 bg-white border border-dashed border-slate-200 rounded-xl p-8 text-center">
          لا توجد باقات. أنشئ باقتك الأولى لبدء البيع.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {packs.map((p) => <PackCard key={p.id} p={p} onChanged={invalidate} />)}
        </div>
      )}

      {showCreate && (
        <PackModal
          mode="create"
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); invalidate(); }}
        />
      )}
    </div>
  );
}

function PackCard({ p, onChanged }: { p: VotePack; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);

  const toggleMut = useMutation({
    mutationFn: () => api.patch(`/superadmin/contests/packs/${p.id}`, { isActive: !p.isActive }),
    onSuccess: onChanged,
  });
  const deleteMut = useMutation({
    mutationFn: () => api.del(`/superadmin/contests/packs/${p.id}`),
    onSuccess: onChanged,
    onError: () => alert("تعذّر الحذف (قد تكون الباقة مستخدَمة في عمليات شراء سابقة)"),
  });

  return (
    <>
      <div className={`bg-white border rounded-2xl shadow-sm overflow-hidden ${p.isActive ? "border-slate-200" : "border-slate-200 opacity-60"}`}>
        {p.coverUrl ? (
          <img src={p.coverUrl} alt="" className="w-full h-28 object-cover" />
        ) : (
          <div className="w-full h-28 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold">◈</div>
        )}
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${p.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
              {p.isActive ? "متاحة" : "متوقفة"}
            </span>
            <span className="text-xs text-slate-400 font-mono" dir="ltr">#{p.id}</span>
          </div>
          <div className="font-bold text-slate-900">{p.name}</div>
          <div className="text-xs text-slate-500 mt-1">{p.description || "—"}</div>

          <div className="grid grid-cols-3 gap-2 mt-3 text-center">
            <div className="bg-emerald-50 rounded p-2">
              <div className="text-base font-bold text-emerald-700">{p.votes}</div>
              <div className="text-[10px] text-emerald-600">صوت</div>
            </div>
            <div className="bg-amber-50 rounded p-2">
              <div className="text-base font-bold text-amber-700">+{p.bonusVotes}</div>
              <div className="text-[10px] text-amber-600">إضافي</div>
            </div>
            <div className="bg-indigo-50 rounded p-2">
              <div className="text-base font-bold text-indigo-700">{parseFloat(p.priceSkz).toFixed(2)}</div>
              <div className="text-[10px] text-indigo-600">SKZ</div>
            </div>
          </div>

          {p.bonusFileUrl && (
            <div className="mt-3 bg-purple-50 border border-purple-200 rounded-lg p-2 text-xs">
              <div className="font-bold text-purple-800">يتضمّن مكافأة</div>
              <div className="text-purple-700 truncate">{p.bonusFileName || "ملف"}</div>
              {p.bonusDescription && <div className="text-purple-600 text-[11px] mt-1">{p.bonusDescription}</div>}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button onClick={() => setEditing(true)} className="flex-1 text-xs py-1.5 rounded bg-slate-100 hover:bg-slate-200 font-semibold">تعديل</button>
            <button onClick={() => toggleMut.mutate()} disabled={toggleMut.isPending} className="flex-1 text-xs py-1.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold">
              {p.isActive ? "إيقاف" : "تفعيل"}
            </button>
            <button onClick={() => { if (confirm("حذف الباقة؟")) deleteMut.mutate(); }} disabled={deleteMut.isPending} className="text-xs py-1.5 px-2 rounded bg-rose-100 hover:bg-rose-200 text-rose-700">حذف</button>
          </div>
        </div>
      </div>
      {editing && (
        <PackModal mode="edit" pack={p} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onChanged(); }} />
      )}
    </>
  );
}

function PackModal({ mode, pack, onClose, onSaved }: { mode: "create" | "edit"; pack?: VotePack; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(pack?.name ?? "");
  const [description, setDescription] = useState(pack?.description ?? "");
  const [votes, setVotes] = useState(pack?.votes ?? 10);
  const [bonusVotes, setBonusVotes] = useState(pack?.bonusVotes ?? 0);
  const [priceSkz, setPriceSkz] = useState(pack?.priceSkz ?? "5");
  const [coverUrl, setCoverUrl] = useState(pack?.coverUrl ?? "");
  const [bonusFileUrl, setBonusFileUrl] = useState(pack?.bonusFileUrl ?? "");
  const [bonusFileName, setBonusFileName] = useState(pack?.bonusFileName ?? "");
  const [bonusDescription, setBonusDescription] = useState(pack?.bonusDescription ?? "");
  const [sortOrder, setSortOrder] = useState(pack?.sortOrder ?? 0);
  const [isActive, setIsActive] = useState(pack?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        votes,
        bonusVotes,
        priceSkz: String(priceSkz),
        coverUrl: coverUrl.trim() || null,
        bonusFileUrl: bonusFileUrl.trim() || null,
        bonusFileName: bonusFileName.trim() || null,
        bonusDescription: bonusDescription.trim() || null,
        sortOrder,
        isActive,
      };
      return mode === "create"
        ? api.post("/superadmin/contests/packs", payload)
        : api.patch(`/superadmin/contests/packs/${pack!.id}`, payload);
    },
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : "تعذّر الحفظ"),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir="rtl">
        <h3 className="text-xl font-bold mb-4">{mode === "create" ? "+ باقة جديدة" : "تعديل الباقة"}</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="الاسم"><input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300" placeholder="باقة الذهب" /></Field>
          <Field label="ترتيب العرض"><input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-slate-300" /></Field>
          <Field label="عدد الأصوات"><input type="number" min={1} value={votes} onChange={(e) => setVotes(parseInt(e.target.value) || 1)} className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono" /></Field>
          <Field label="أصوات إضافية (مكافأة)"><input type="number" min={0} value={bonusVotes} onChange={(e) => setBonusVotes(parseInt(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono" /></Field>
          <Field label="السعر (SKZ)"><input value={priceSkz} onChange={(e) => setPriceSkz(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono" dir="ltr" placeholder="5.00" /></Field>
          <Field label="حالة الباقة">
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white cursor-pointer">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              <span>{isActive ? "متاحة للبيع" : "متوقفة"}</span>
            </label>
          </Field>
        </div>
        <Field label="الوصف الموجز">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-300" placeholder="نص قصير يظهر على بطاقة الباقة" />
        </Field>
        <Field label="رابط صورة الغلاف (اختياري)">
          <input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm" dir="ltr" placeholder="https://…" />
        </Field>

        <div className="mt-4 mb-2 p-4 bg-purple-50 border border-purple-200 rounded-xl">
          <div className="font-bold text-purple-800 mb-2">مكافأة الحُزمة (اختياري)</div>
          <div className="text-xs text-purple-700 mb-3">عند ملء رابط الملف، تصبح الباقة عرض «حُزمة»: المستخدم يحصل على الأصوات + يمكنه تنزيل الملف (مثلًا PDF كتاب).</div>
          <Field label="رابط ملف المكافأة">
            <input value={bonusFileUrl} onChange={(e) => setBonusFileUrl(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-purple-300 font-mono text-sm" dir="ltr" placeholder="https://…/book.pdf" />
          </Field>
          <Field label="اسم الملف الظاهر للمستخدم">
            <input value={bonusFileName} onChange={(e) => setBonusFileName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-purple-300" placeholder="كتاب: أسرار التداول.pdf" />
          </Field>
          <Field label="وصف المكافأة">
            <input value={bonusDescription} onChange={(e) => setBonusDescription(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-purple-300" placeholder="كتاب إلكتروني هدية مع الباقة" />
          </Field>
        </div>

        {error && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded p-2 mb-3">{error}</div>}
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200">إلغاء</button>
          <button onClick={() => mut.mutate()} disabled={!name.trim() || mut.isPending} className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold disabled:opacity-50">
            {mut.isPending ? "…" : "حفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block mb-3"><div className="text-sm font-semibold text-slate-700 mb-1">{label}</div>{children}</label>;
}

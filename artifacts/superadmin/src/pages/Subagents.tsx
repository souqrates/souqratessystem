import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getToken } from "@/lib/api";
import { Link } from "wouter";

interface SubAgent {
  id: number;
  telegramId: string;
  fullName: string;
  country: string;
  phone: string;
  email: string | null;
  status: "pending" | "approved" | "rejected" | "suspended";
  tierLevel: number | null;
  totalSalesSkz: string;
  totalCustomers: number;
  rejectedReason: string | null;
  createdAt: string;
}

export default function SubagentsPage() {
  const [status, setStatus] = useState("pending");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const q = new URLSearchParams();
  if (status) q.set("status", status);
  if (search) q.set("search", search);

  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "subagents", status, search],
    queryFn: () => api.get<{ data: SubAgent[] }>(`/superadmin/subagents?${q}`),
    refetchInterval: 8000,
  });

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">♛ SOUQRATES SUB-AGENTS</h1>
          <p className="text-slate-500 mt-1">إدارة الشركاء المعتمدين وطلبات الانضمام</p>
        </div>
        <Link href="/subagents/tiers"><a className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl">⚙️ إدارة المراتب</a></Link>
      </header>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4 shadow-sm flex flex-wrap gap-2 items-center">
        {["pending", "approved", "rejected", "suspended", ""].map((s) => (
          <button key={s || "all"} onClick={() => setStatus(s)}
            className={`px-3 py-1.5 text-sm rounded-lg ${status === s ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
            {s === "pending" ? "قيد المراجعة" : s === "approved" ? "معتمد" : s === "rejected" ? "مرفوض" : s === "suspended" ? "موقوف" : "الكل"}
          </button>
        ))}
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم/الدولة/الهاتف"
               className="mr-auto px-3 py-1.5 text-sm border border-slate-200 rounded-lg w-64" />
      </div>

      <div className="grid lg:grid-cols-[1fr_400px] gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="py-10 text-center text-slate-400">جارٍ التحميل…</div>
          ) : (data?.data ?? []).length === 0 ? (
            <div className="py-10 text-center text-slate-400">لا توجد طلبات</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-right">#</th>
                  <th className="px-3 py-2 text-right">الاسم</th>
                  <th className="px-3 py-2 text-right">الدولة</th>
                  <th className="px-3 py-2 text-right">الحالة</th>
                  <th className="px-3 py-2 text-right">المرتبة</th>
                  <th className="px-3 py-2 text-right">المبيعات</th>
                  <th className="px-3 py-2 text-right">العملاء</th>
                  <th className="px-3 py-2 text-right">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {(data?.data ?? []).map((s) => (
                  <tr key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      className={`border-t border-slate-100 cursor-pointer hover:bg-amber-50 ${selectedId === s.id ? "bg-amber-50" : ""}`}>
                    <td className="px-3 py-2">{s.id}</td>
                    <td className="px-3 py-2 font-bold">{s.fullName}</td>
                    <td className="px-3 py-2">{s.country}</td>
                    <td className="px-3 py-2"><StatusBadge status={s.status} /></td>
                    <td className="px-3 py-2">{s.tierLevel ?? "—"}</td>
                    <td className="px-3 py-2 font-bold">{parseFloat(s.totalSalesSkz).toLocaleString()}</td>
                    <td className="px-3 py-2">{s.totalCustomers}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{new Date(s.createdAt).toLocaleDateString("ar-EG")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {selectedId && <DetailPanel id={selectedId} onClose={() => setSelectedId(null)} />}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === "approved" ? "bg-green-100 text-green-700"
    : status === "rejected" ? "bg-red-100 text-red-700"
    : status === "suspended" ? "bg-slate-200 text-slate-700"
    : "bg-amber-100 text-amber-700";
  const label = status === "approved" ? "معتمد" : status === "rejected" ? "مرفوض" : status === "suspended" ? "موقوف" : "قيد المراجعة";
  return <span className={`px-2 py-0.5 text-xs rounded-full font-bold ${cls}`}>{label}</span>;
}

function DetailPanel({ id, onClose }: { id: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "subagent", id],
    queryFn: () => api.get<{ agent: SubAgent & { dob: string; address: string; notes: string | null }; tier: { name: string } | null; sales: Array<{ id: number; customerTelegramId: string; skzAmount: string; createdAt: string }>; wallet: { balanceSkz: string } | null }>(`/superadmin/subagents/${id}`),
  });

  const approve = useMutation({
    mutationFn: () => api.post(`/superadmin/subagents/${id}/approve`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin", "subagents"] }); qc.invalidateQueries({ queryKey: ["superadmin", "subagent", id] }); },
  });
  const reject = useMutation({
    mutationFn: () => api.post(`/superadmin/subagents/${id}/reject`, { reason: reason.trim() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin", "subagents"] }); qc.invalidateQueries({ queryKey: ["superadmin", "subagent", id] }); setReason(""); },
  });
  const suspend = useMutation({
    mutationFn: () => api.post(`/superadmin/subagents/${id}/suspend`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin", "subagents"] }); qc.invalidateQueries({ queryKey: ["superadmin", "subagent", id] }); },
  });
  const recompute = useMutation({
    mutationFn: () => api.post(`/superadmin/subagents/${id}/recompute-tier`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin", "subagent", id] }); },
  });
  const reactivate = useMutation({
    mutationFn: () => api.post(`/superadmin/subagents/${id}/reactivate`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin", "subagents"] }); qc.invalidateQueries({ queryKey: ["superadmin", "subagent", id] }); },
  });
  const saveNotes = useMutation({
    mutationFn: (notes: string) => api.patch(`/superadmin/subagents/${id}/notes`, { notes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin", "subagent", id] }); },
  });

  if (isLoading || !data) return <div className="bg-white rounded-2xl p-6 shadow-sm text-center text-slate-400">جارٍ التحميل…</div>;
  const a = data.agent;
  const token = getToken();
  const photoUrl = `/api/superadmin/subagents/${id}/id-photo${token ? `?_t=${token.slice(0, 8)}` : ""}`;
  // Note: photo is fetched with Authorization header — render via <object> tag that auths through cookie? Use fetch+blob:
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-lg">#{a.id} — {a.fullName}</h3>
        <button onClick={onClose} className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200">✕</button>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs mb-4">
        <Info label="الحالة" value={<StatusBadge status={a.status} />} />
        <Info label="المرتبة" value={data.tier?.name ?? "—"} />
        <Info label="TG ID" value={a.telegramId} />
        <Info label="الدولة" value={a.country} />
        <Info label="الهاتف" value={a.phone} />
        <Info label="البريد" value={a.email ?? "—"} />
        <Info label="تاريخ الميلاد" value={a.dob} />
        <Info label="رصيد المحفظة" value={`${parseFloat(data.wallet?.balanceSkz ?? "0").toLocaleString()} SKZ`} />
      </div>
      <div className="text-xs mb-3">
        <div className="text-slate-500 mb-1">العنوان</div>
        <div className="bg-slate-50 rounded-lg p-2">{a.address}</div>
      </div>
      <div className="text-xs mb-3">
        <div className="text-slate-500 mb-1">صورة بطاقة الهوية</div>
        <AuthedImage src={photoUrl} alt="ID photo" />
      </div>
      {a.rejectedReason && (
        <div className="text-xs mb-3 bg-red-50 border border-red-200 rounded-lg p-2 text-red-700">
          سبب الرفض السابق: {a.rejectedReason}
        </div>
      )}

      <div className="space-y-2 mb-4">
        {a.status === "pending" && (
          <>
            <button onClick={() => approve.mutate()} disabled={approve.isPending}
                    className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-sm disabled:opacity-50">
              ✅ موافقة وإصدار اللوحة
            </button>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)}
                      placeholder="سبب الرفض (مطلوب للرفض)" rows={2}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" />
            <button onClick={() => reject.mutate()} disabled={reject.isPending || !reason.trim()}
                    className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm disabled:opacity-30">
              ❌ رفض الطلب
            </button>
          </>
        )}
        {a.status === "approved" && (
          <>
            <button onClick={() => recompute.mutate()} disabled={recompute.isPending}
                    className="w-full py-2 bg-amber-100 text-amber-700 hover:bg-amber-200 font-bold rounded-xl text-sm">
              ↺ إعادة حساب المرتبة
            </button>
            <button onClick={() => suspend.mutate()} disabled={suspend.isPending}
                    className="w-full py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold rounded-xl text-sm">
              ⊘ تعليق الحساب
            </button>
          </>
        )}
        {(a.status === "suspended" || a.status === "rejected") && (
          <button onClick={() => reactivate.mutate()} disabled={reactivate.isPending}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm disabled:opacity-50">
            ♻️ إعادة تفعيل الحساب
          </button>
        )}
      </div>

      <NotesEditor
        initial={a.notes ?? ""}
        onSave={(v) => saveNotes.mutate(v)}
        isSaving={saveNotes.isPending}
      />

      <div className="text-xs">
        <div className="font-bold text-slate-700 mb-2">آخر {data.sales.length} عمليات بيع</div>
        {data.sales.length === 0 && <div className="text-slate-400 text-center py-3">لا توجد مبيعات</div>}
        {data.sales.map((s) => (
          <div key={s.id} className="flex justify-between border-t border-slate-100 py-1.5">
            <span className="text-slate-500">{s.customerTelegramId}</span>
            <span className="font-bold">{parseFloat(s.skzAmount).toLocaleString()} SKZ</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotesEditor({ initial, onSave, isSaving }: { initial: string; onSave: (v: string) => void; isSaving: boolean }) {
  const [val, setVal] = useState(initial);
  const dirty = val !== initial;
  return (
    <div className="text-xs mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="font-bold text-amber-800">ملاحظات داخلية (لا تظهر للشريك)</div>
        {dirty && (
          <button onClick={() => onSave(val)} disabled={isSaving}
                  className="text-xs px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md disabled:opacity-50">
            حفظ
          </button>
        )}
      </div>
      <textarea value={val} onChange={(e) => setVal(e.target.value)} rows={3}
                placeholder="ملاحظات للفريق فقط…"
                className="w-full px-2 py-1.5 text-sm border border-amber-200 rounded bg-white" />
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-slate-50 rounded-lg p-2">
      <div className="text-slate-500 text-[10px] mb-0.5">{label}</div>
      <div className="font-bold text-slate-800">{value}</div>
    </div>
  );
}

// Auth'd image: fetch via api.get to attach Bearer, then render blob URL
function AuthedImage({ src, alt }: { src: string; alt: string }) {
  const { data } = useQuery({
    queryKey: ["authed-img", src],
    queryFn: async () => {
      const token = getToken();
      const r = await fetch(src.split("?")[0], {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) throw new Error(`img ${r.status}`);
      const blob = await r.blob();
      return URL.createObjectURL(blob);
    },
    staleTime: 5 * 60_000,
  });
  if (!data) return <div className="bg-slate-100 rounded-lg h-48 flex items-center justify-center text-slate-400 text-xs">جارٍ تحميل الصورة…</div>;
  return <img src={data} alt={alt} className="rounded-lg max-h-80 w-full object-contain bg-slate-50 border border-slate-200" />;
}

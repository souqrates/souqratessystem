import { useState } from "react";
import { Link, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Contest } from "./Contests";

interface Contestant {
  id: number;
  contestId: number;
  name: string;
  bio: string | null;
  photoUrl: string | null;
  sortOrder: number;
  voteCount: number;
  isDisqualified: boolean;
  createdAt: string;
}

interface VoteRow {
  id: number;
  contestId: number;
  contestantId: number;
  voterTelegramId: string | number;
  voteCount: number;
  source: "free" | "paid" | string;
  grantId: number | null;
  isVoid: boolean;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
}

export default function ContestDetailPage() {
  const params = useParams<{ id: string }>();
  const contestId = parseInt(params.id, 10);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "contest", contestId],
    queryFn: () => api.get<{ contest: Contest; contestants: Contestant[] }>(`/contests/${contestId}`),
    refetchInterval: 5000,
  });
  const { data: votesData } = useQuery({
    queryKey: ["superadmin", "contest", contestId, "votes"],
    queryFn: () => api.get<{ votes: VoteRow[] }>(`/superadmin/contests/${contestId}/votes?limit=50`),
    refetchInterval: 5000,
  });

  const contest = data?.contest;
  const contestants = (data?.contestants ?? []).slice().sort((a, b) => b.voteCount - a.voteCount);
  const votes = votesData?.votes ?? [];

  const [showAdd, setShowAdd] = useState(false);

  const statusMut = useMutation({
    mutationFn: (status: string) => api.patch(`/superadmin/contests/${contestId}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin", "contest", contestId] });
      qc.invalidateQueries({ queryKey: ["superadmin", "contests"] });
    },
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["superadmin", "contest", contestId] });
    qc.invalidateQueries({ queryKey: ["superadmin", "contest", contestId, "votes"] });
  };

  if (isLoading) return <div className="p-8 text-center text-slate-400" dir="rtl">جارٍ التحميل…</div>;
  if (!contest) return <div className="p-8 text-center text-slate-400" dir="rtl">المسابقة غير موجودة</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto" dir="rtl">
      <Link href="/contests"><a className="text-sm text-indigo-600 hover:underline">← رجوع لقائمة المسابقات</a></Link>

      <header className="mt-4 mb-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-wrap items-start gap-4 justify-between">
          <div className="flex items-center gap-4">
            {contest.coverUrl ? (
              <img src={contest.coverUrl} alt="" className="w-24 h-24 rounded-xl object-cover" />
            ) : (
              <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center text-white text-3xl">★</div>
            )}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  contest.status === "active" ? "bg-emerald-100 text-emerald-700" :
                  contest.status === "draft" ? "bg-slate-200 text-slate-700" : "bg-zinc-100 text-zinc-600"
                }`}>{contest.status === "active" ? "نشطة" : contest.status === "draft" ? "مسوّدة" : "منتهية"}</span>
                <span className="text-xs text-slate-400 font-mono" dir="ltr">#{contest.id}</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900">{contest.title}</h1>
              <p className="text-sm text-slate-500 mt-1">{contest.description || "بدون وصف"}</p>
              <div className="text-sm text-slate-700 mt-2">🗳 إجمالي الأصوات: <b>{contest.totalVotes.toLocaleString("en-US")}</b></div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {contest.status === "draft" && (
              <button onClick={() => statusMut.mutate("active")} disabled={statusMut.isPending} className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50">
                ▶ تفعيل (ستُنهَى أي مسابقة نشطة أخرى)
              </button>
            )}
            {contest.status === "active" && (
              <button onClick={() => { if (confirm("إنهاء المسابقة؟ لا يمكن التراجع.")) statusMut.mutate("ended"); }} disabled={statusMut.isPending} className="px-4 py-2 rounded-lg bg-zinc-700 text-white font-bold hover:bg-zinc-800 disabled:opacity-50">
                🏁 إنهاء المسابقة
              </button>
            )}
          </div>
        </div>
      </header>

      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-slate-900">🏆 لوحة المتسابقين</h2>
          <button onClick={() => setShowAdd(true)} className="px-4 py-2 rounded-lg bg-amber-500 text-white font-bold hover:bg-amber-600 text-sm">+ إضافة متسابق</button>
        </div>
        {contestants.length === 0 ? (
          <div className="text-sm text-slate-400 bg-white border border-dashed border-slate-200 rounded-xl p-6 text-center">لا يوجد متسابقون بعد.</div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <Th>الترتيب</Th>
                  <Th>المتسابق</Th>
                  <Th>الأصوات</Th>
                  <Th>الحالة</Th>
                  <Th>إجراءات</Th>
                </tr>
              </thead>
              <tbody>
                {contestants.map((c, idx) => (
                  <ContestantRow key={c.id} c={c} rank={idx + 1} onChanged={invalidateAll} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-900 mb-3">🧾 آخر 50 صوت (تدقيق)</h2>
        {votes.length === 0 ? (
          <div className="text-sm text-slate-400 bg-white border border-dashed border-slate-200 rounded-xl p-6 text-center">لا توجد أصوات بعد.</div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <Th>#</Th>
                  <Th>المتسابق</Th>
                  <Th>الناخب</Th>
                  <Th>المصدر</Th>
                  <Th>العدد</Th>
                  <Th>الوقت</Th>
                  <Th>إجراء</Th>
                </tr>
              </thead>
              <tbody>
                {votes.map((v) => (
                  <VoteRowEl key={v.id} v={v} contestants={contestants} onChanged={invalidateAll} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showAdd && (
        <AddContestantModal
          contestId={contestId}
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); invalidateAll(); }}
        />
      )}
    </div>
  );
}

function ContestantRow({ c, rank, onChanged }: { c: Contestant; rank: number; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);

  const disqualifyMut = useMutation({
    mutationFn: (val: boolean) => api.patch(`/superadmin/contestants/${c.id}`, { isDisqualified: val }),
    onSuccess: onChanged,
  });
  const deleteMut = useMutation({
    mutationFn: () => api.del(`/superadmin/contestants/${c.id}`),
    onSuccess: onChanged,
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) {
        alert("⚠ هذا المتسابق له أصوات مسجّلة. استخدم زر «استبعاد» للحفاظ على سجل التصويت.");
      } else {
        alert("تعذّر الحذف");
      }
    },
  });

  return (
    <>
      <tr className="border-t border-slate-100 hover:bg-slate-50/60">
        <Td className="font-mono text-lg">{rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`}</Td>
        <Td>
          <div className="flex items-center gap-3">
            {c.photoUrl ? (
              <img src={c.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">👤</div>
            )}
            <div>
              <div className={`font-semibold ${c.isDisqualified ? "text-rose-500 line-through" : "text-slate-900"}`}>{c.name}</div>
              <div className="text-xs text-slate-500 truncate max-w-xs">{c.bio || "—"}</div>
            </div>
          </div>
        </Td>
        <Td className="font-mono font-bold text-emerald-700 text-lg">{c.voteCount.toLocaleString("en-US")}</Td>
        <Td>
          {c.isDisqualified ? (
            <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded">مُستبعَد</span>
          ) : (
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">نشط</span>
          )}
        </Td>
        <Td>
          <div className="flex gap-2">
            <button onClick={() => setEditing(!editing)} className="text-xs text-indigo-600 hover:underline">تعديل</button>
            <button
              onClick={() => disqualifyMut.mutate(!c.isDisqualified)}
              disabled={disqualifyMut.isPending}
              className="text-xs text-amber-600 hover:underline"
            >
              {c.isDisqualified ? "إعادة" : "استبعاد"}
            </button>
            <button
              onClick={() => { if (confirm("حذف نهائي؟ يفشل إذا كان له أصوات.")) deleteMut.mutate(); }}
              disabled={deleteMut.isPending}
              className="text-xs text-rose-600 hover:underline"
            >
              حذف
            </button>
          </div>
        </Td>
      </tr>
      {editing && (
        <tr><td colSpan={5} className="bg-amber-50/40 p-4 border-t border-amber-100">
          <EditContestantForm c={c} onDone={() => { setEditing(false); onChanged(); }} />
        </td></tr>
      )}
    </>
  );
}

function EditContestantForm({ c, onDone }: { c: Contestant; onDone: () => void }) {
  const [name, setName] = useState(c.name);
  const [bio, setBio] = useState(c.bio ?? "");
  const [photoUrl, setPhotoUrl] = useState(c.photoUrl ?? "");
  const [sortOrder, setSortOrder] = useState(c.sortOrder);

  const mut = useMutation({
    mutationFn: () => api.patch(`/superadmin/contestants/${c.id}`, {
      name: name.trim(),
      bio: bio.trim() || null,
      photoUrl: photoUrl.trim() || null,
      sortOrder,
    }),
    onSuccess: onDone,
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3" dir="rtl">
      <Field label="الاسم"><input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-1.5 rounded border border-slate-300" /></Field>
      <Field label="ترتيب العرض"><input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)} className="w-full px-3 py-1.5 rounded border border-slate-300" /></Field>
      <Field label="السيرة الموجزة"><input value={bio} onChange={(e) => setBio(e.target.value)} className="w-full px-3 py-1.5 rounded border border-slate-300" /></Field>
      <Field label="رابط الصورة"><input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} className="w-full px-3 py-1.5 rounded border border-slate-300 font-mono text-xs" dir="ltr" placeholder="https://…" /></Field>
      <div className="md:col-span-2 flex justify-end gap-2">
        <button onClick={onDone} className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-sm">إلغاء</button>
        <button onClick={() => mut.mutate()} disabled={mut.isPending} className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50">
          {mut.isPending ? "…" : "حفظ"}
        </button>
      </div>
    </div>
  );
}

function VoteRowEl({ v, contestants, onChanged }: { v: VoteRow; contestants: Contestant[]; onChanged: () => void }) {
  const cName = contestants.find((c) => c.id === v.contestantId)?.name ?? `#${v.contestantId}`;
  const voidMut = useMutation({
    mutationFn: () => {
      const reason = prompt("سبب الإلغاء؟", "") ?? "";
      return api.post(`/superadmin/contests/votes/${v.id}/void`, { reason });
    },
    onSuccess: onChanged,
    onError: (e) => alert(e instanceof ApiError ? e.message : "تعذّر الإلغاء"),
  });

  return (
    <tr className={`border-t border-slate-100 hover:bg-slate-50/60 ${v.isVoid ? "opacity-50" : ""}`}>
      <Td className="font-mono text-xs text-slate-400" dir="ltr">#{v.id}</Td>
      <Td className="font-semibold">{cName}</Td>
      <Td className="font-mono text-xs" dir="ltr">{String(v.voterTelegramId)}</Td>
      <Td>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${v.source === "free" ? "bg-emerald-100 text-emerald-700" : "bg-indigo-100 text-indigo-700"}`}>
          {v.source === "free" ? "مجاني" : "مدفوع"}
        </span>
      </Td>
      <Td className="font-mono font-bold">{v.voteCount}</Td>
      <Td className="text-xs text-slate-500" dir="ltr">{new Date(v.createdAt).toLocaleString("en-US")}</Td>
      <Td>
        {v.isVoid ? (
          <span className="text-xs text-rose-600" title={v.voidReason ?? ""}>مُلغى</span>
        ) : (
          <button onClick={() => voidMut.mutate()} disabled={voidMut.isPending} className="text-xs text-rose-600 hover:underline">إلغاء</button>
        )}
      </Td>
    </tr>
  );
}

function AddContestantModal({ contestId, onClose, onCreated }: { contestId: number; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () => api.post(`/superadmin/contests/${contestId}/contestants`, {
      name: name.trim(),
      bio: bio.trim() || null,
      photoUrl: photoUrl.trim() || null,
    }),
    onSuccess: onCreated,
    onError: (e) => setError(e instanceof ApiError ? e.message : "تعذّر الإضافة"),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()} dir="rtl">
        <h3 className="text-xl font-bold mb-4">+ متسابق جديد</h3>
        <Field label="الاسم"><input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300" /></Field>
        <Field label="السيرة (اختياري)"><textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-300" /></Field>
        <Field label="رابط الصورة (اختياري)"><input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm" dir="ltr" placeholder="https://…" /></Field>
        {error && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded p-2 mb-3">{error}</div>}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200">إلغاء</button>
          <button onClick={() => mut.mutate()} disabled={!name.trim() || mut.isPending} className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold disabled:opacity-50">
            {mut.isPending ? "…" : "إضافة"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block mb-3"><div className="text-sm font-semibold text-slate-700 mb-1">{label}</div>{children}</label>;
}
function Th({ children }: { children: React.ReactNode }) { return <th className="text-right font-semibold px-4 py-2.5">{children}</th>; }
function Td({ children, className = "", dir }: { children: React.ReactNode; className?: string; dir?: "ltr" | "rtl" }) {
  return <td className={`px-4 py-2.5 ${className}`} dir={dir}>{children}</td>;
}

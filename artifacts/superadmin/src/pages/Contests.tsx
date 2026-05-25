import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";

export interface Contest {
  id: number;
  title: string;
  description: string | null;
  coverUrl: string | null;
  status: "draft" | "active" | "ended" | string;
  startsAt: string | null;
  endsAt: string | null;
  totalVotes: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContestsStats {
  contestsTotal: number;
  contestsActive: number;
  votesTotal: number;
  votesVoided: number;
  votesFree: number;
  votesPaid: number;
  grantsTotal: number;
  revenueSkz: string;
  bot: {
    slug: string;
    name: string;
    commissionRate: string;
    totalVolumeUsdt: string;
    totalCommissionUsdt: string;
  } | null;
}

export default function ContestsPage() {
  const qc = useQueryClient();
  const { data: list, isLoading } = useQuery({
    queryKey: ["superadmin", "contests"],
    queryFn: () => api.get<{ contests: Contest[] }>("/superadmin/contests"),
  });
  const { data: stats } = useQuery({
    queryKey: ["superadmin", "contests", "stats"],
    queryFn: () => api.get<ContestsStats>("/superadmin/contests/stats"),
  });

  const contests = list?.contests ?? [];
  const grouped = useMemo(() => {
    return {
      active: contests.filter((c) => c.status === "active"),
      draft: contests.filter((c) => c.status === "draft"),
      ended: contests.filter((c) => c.status === "ended"),
    };
  }, [contests]);

  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="p-8 max-w-7xl mx-auto" dir="rtl">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">★ مسابقات SOUQRATES STAGE</h1>
          <p className="text-slate-500 mt-1">
            مسابقة واحدة <b>نشطة</b> في كل وقت. كل مستخدم له <b>صوت مجاني واحد يوميًّا</b> (UTC) عبر المنصّة كلّها — والباقي يُشترى عبر باقات.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-5 py-2.5 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600 shadow"
        >
          + مسابقة جديدة
        </button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="إجمالي المسابقات" value={stats?.contestsTotal ?? 0} tone="slate" />
        <Stat label="المسابقات النشطة" value={stats?.contestsActive ?? 0} tone="emerald" />
        <Stat label="إجمالي الأصوات" value={stats?.votesTotal ?? 0} tone="indigo" />
        <Stat label="إيرادات الباقات (SKZ)" value={stats?.revenueSkz ?? "0"} tone="amber" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 text-xs">
        <MiniStat label="أصوات مجانية" value={stats?.votesFree ?? 0} />
        <MiniStat label="أصوات مدفوعة" value={stats?.votesPaid ?? 0} />
        <MiniStat label="أصوات مُلغاة" value={stats?.votesVoided ?? 0} />
        <MiniStat label="نسبة العمولة" value={stats?.bot ? `${(parseFloat(stats.bot.commissionRate) * 100).toFixed(2)}%` : "—"} />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">جارٍ التحميل…</div>
      ) : (
        <>
          <Section title="🔴 نشطة الآن" tone="emerald" contests={grouped.active} empty="لا توجد مسابقة نشطة. أنشئ مسابقة وفعِّلها." />
          <Section title="📝 مسوّدات" tone="slate" contests={grouped.draft} empty="لا توجد مسوّدات." />
          <Section title="🏁 منتهية" tone="zinc" contests={grouped.ended} empty="لا توجد مسابقات منتهية بعد." />
        </>
      )}

      {showCreate && (
        <CreateContestModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["superadmin", "contests"] });
            qc.invalidateQueries({ queryKey: ["superadmin", "contests", "stats"] });
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}

function Section({ title, tone, contests, empty }: { title: string; tone: string; contests: Contest[]; empty: string }) {
  return (
    <section className="mb-8">
      <h2 className={`text-lg font-bold mb-3 text-${tone}-700`}>{title} <span className="text-sm text-slate-400">({contests.length})</span></h2>
      {contests.length === 0 ? (
        <div className="text-sm text-slate-400 bg-white border border-dashed border-slate-200 rounded-xl p-6 text-center">{empty}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contests.map((c) => <ContestCard key={c.id} c={c} />)}
        </div>
      )}
    </section>
  );
}

function ContestCard({ c }: { c: Contest }) {
  return (
    <Link href={`/contests/${c.id}`}>
      <a className="block bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition overflow-hidden">
        {c.coverUrl ? (
          <img src={c.coverUrl} alt="" className="w-full h-32 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <div className="w-full h-32 bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center text-white text-4xl">★</div>
        )}
        <div className="p-4">
          <div className="flex items-center justify-between mb-1">
            <StatusBadge status={c.status} />
            <span className="text-xs text-slate-400 font-mono" dir="ltr">#{c.id}</span>
          </div>
          <div className="font-bold text-slate-900 truncate">{c.title}</div>
          <div className="text-xs text-slate-500 truncate mt-1">{c.description || "—"}</div>
          <div className="flex items-center justify-between mt-3 text-xs text-slate-600">
            <span>🗳 {c.totalVotes.toLocaleString("en-US")} صوت</span>
            <span className="text-indigo-600 font-semibold">إدارة ←</span>
          </div>
        </div>
      </a>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700",
    draft: "bg-slate-200 text-slate-700",
    ended: "bg-zinc-100 text-zinc-600",
  };
  const labels: Record<string, string> = { active: "نشطة", draft: "مسوّدة", ended: "منتهية" };
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${map[status] ?? "bg-slate-100"}`}>{labels[status] ?? status}</span>;
}

function CreateContestModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [status, setStatus] = useState<"draft" | "active">("draft");
  const [error, setError] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () => api.post<Contest>("/superadmin/contests", {
      title: title.trim(),
      description: description.trim() || null,
      coverUrl: coverUrl.trim() || null,
      status,
    }),
    onSuccess: onCreated,
    onError: (e) => setError(e instanceof ApiError ? e.message : "تعذّر الإنشاء"),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()} dir="rtl">
        <h3 className="text-xl font-bold mb-4">★ مسابقة جديدة</h3>
        <Field label="العنوان">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300" placeholder="مثال: ملك الكاميرا — مايو 2026" />
        </Field>
        <Field label="الوصف">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-slate-300" placeholder="وصف موجز للمسابقة…" />
        </Field>
        <Field label="رابط صورة الغلاف (اختياري)">
          <input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm" placeholder="https://…" dir="ltr" />
        </Field>
        <Field label="الحالة">
          <select value={status} onChange={(e) => setStatus(e.target.value as "draft" | "active")} className="w-full px-3 py-2 rounded-lg border border-slate-300">
            <option value="draft">مسوّدة (مخفية)</option>
            <option value="active">نشطة فورًا (ستُنهَى أي مسابقة نشطة أخرى تلقائيًّا)</option>
          </select>
        </Field>
        {error && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded p-2 mb-3">{error}</div>}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200">إلغاء</button>
          <button
            onClick={() => mut.mutate()}
            disabled={!title.trim() || mut.isPending}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold disabled:opacity-50"
          >
            {mut.isPending ? "…" : "إنشاء"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-3">
      <div className="text-sm font-semibold text-slate-700 mb-1">{label}</div>
      {children}
    </label>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-900",
    emerald: "bg-emerald-50 text-emerald-700",
    indigo: "bg-indigo-50 text-indigo-700",
    amber: "bg-amber-50 text-amber-800",
  };
  return (
    <div className={`rounded-2xl p-4 ${tones[tone]}`}>
      <div className="text-2xl font-extrabold">{typeof value === "number" ? value.toLocaleString("en-US") : value}</div>
      <div className="text-xs mt-1 opacity-80">{label}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="text-lg font-bold text-slate-900">{typeof value === "number" ? value.toLocaleString("en-US") : value}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
  );
}

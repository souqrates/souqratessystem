import { useQuery } from "@tanstack/react-query";
import { api, type BotHealth } from "@/lib/api";
import { botMeta } from "@/lib/bots-meta";

type ReadyzResponse = {
  status: "ok" | "degraded" | "down";
  db: { ok: boolean; latencyMs?: number; error?: string };
  pool?: { total: number; idle: number; waiting: number };
  uptimeSec: number;
};

type IntegrationRow = {
  slug: string;
  enabled: boolean;
  lastTestStatus: "ok" | "error" | null;
  lastTestAt: string | null;
  lastTestError: string | null;
};

export default function SystemHealthPage() {
  const readyz = useQuery({
    queryKey: ["health", "readyz"],
    queryFn: async () => {
      const res = await fetch("/api/readyz");
      const data = (await res.json()) as ReadyzResponse;
      return { ...data, httpStatus: res.status };
    },
    refetchInterval: 5000,
  });

  const integrations = useQuery({
    queryKey: ["superadmin", "integrations", "health"],
    queryFn: () => api.get<{ data: IntegrationRow[] }>("/superadmin/integrations"),
    refetchInterval: 15000,
  });

  const botsHealth = useQuery({
    queryKey: ["superadmin", "bots-health"],
    queryFn: () => api.get<{ data: BotHealth[] }>("/superadmin/bots-health"),
    refetchInterval: 10000,
  });

  const r = readyz.data;
  const ints = integrations.data?.data ?? [];
  const bots = botsHealth.data?.data ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto" dir="rtl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">صحة النظام</h1>
        <p className="text-slate-500 mt-1">
          نظرة لحظيّة على قاعدة البيانات، خادم التطبيق، والخدمات الخارجية. يُحدَّث تلقائياً.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card title="حالة الخادم" big={statusLabel(r?.status)}
          tone={toneOf(r?.status)} hint={r ? `Uptime: ${fmtUptime(r.uptimeSec)}` : "—"} />
        <Card title="قاعدة البيانات" big={r?.db.ok ? "متّصلة" : r ? "معطّلة" : "—"}
          tone={r?.db.ok ? "ok" : r ? "error" : "muted"}
          hint={r?.db.ok ? `زمن استجابة: ${r.db.latencyMs}ms` : r?.db.error ?? "—"} />
        <Card title="حوض اتصالات DB" big={r?.pool ? `${r.pool.total - r.pool.idle}/${r.pool.total}` : "—"}
          tone={r?.pool && r.pool.waiting > 0 ? "warn" : "ok"}
          hint={r?.pool ? `مستخدَم/إجمالي · انتظار: ${r.pool.waiting}` : "—"} />
      </div>

      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-800">بوتات تيليغرام</h2>
          <span className="text-xs text-slate-500">
            {bots.filter((b) => b.status === "online").length} متّصل من {bots.length}
          </span>
        </div>
        {botsHealth.isLoading ? (
          <div className="py-8 text-center text-slate-400">جارٍ التحميل…</div>
        ) : bots.length === 0 ? (
          <div className="py-8 text-center text-slate-400">لم يصل أي نبض من البوتات بعد.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {bots.map((b) => {
              const m = botMeta(b.botSlug);
              return (
                <div key={b.botSlug} className="py-3 flex items-center gap-3">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${b.status === "online" ? "bg-emerald-500" : "bg-red-500"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800">{m?.brand ?? b.botSlug}</div>
                    <div className="text-xs text-slate-500">
                      {m?.arName ? `${m.arName} · ` : ""}
                      <span dir="ltr">{b.botSlug}</span>
                      {b.version && <span dir="ltr"> · v{b.version}</span>}
                    </div>
                  </div>
                  <div className="text-left">
                    <div className={`text-sm font-bold ${b.status === "online" ? "text-emerald-600" : "text-red-600"}`}>
                      {b.status === "online" ? "متّصل" : "غير متّصل"}
                    </div>
                    <div className="text-xs text-slate-400">
                      {b.lastSeenAt ? `آخر نبض: ${fmtAge(b.ageSec)}` : "لا يوجد"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-4 text-xs text-slate-500">
          يُعتبر البوت «متّصلاً» إذا وصل نبضه خلال آخر 90 ثانية. تُرسل البوتات نبضاً كل 30 ثانية.
        </p>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-800">الخدمات الخارجية</h2>
          <span className="text-xs text-slate-500">
            {ints.filter((i) => i.enabled).length} مفعّلة من {ints.length}
          </span>
        </div>
        {integrations.isLoading ? (
          <div className="py-8 text-center text-slate-400">جارٍ التحميل…</div>
        ) : ints.length === 0 ? (
          <div className="py-8 text-center text-slate-400">لا توجد تكاملات مضافة بعد.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {ints.map((i) => (
              <div key={i.slug} className="py-3 flex items-center gap-3">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotColor(i)}`} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-800" dir="ltr">{i.slug}</div>
                  <div className="text-xs text-slate-500">
                    {i.enabled ? "مفعّلة" : "معطّلة"}
                    {i.lastTestStatus && (
                      <>
                        {" · آخر اختبار: "}
                        <span className={i.lastTestStatus === "ok" ? "text-emerald-600" : "text-red-600"}>
                          {i.lastTestStatus === "ok" ? "نجح" : "فشل"}
                        </span>
                        {i.lastTestAt && <span dir="ltr"> · {new Date(i.lastTestAt).toLocaleString("ar-EG")}</span>}
                      </>
                    )}
                    {i.lastTestStatus === "error" && i.lastTestError && (
                      <span className="text-red-600"> — {i.lastTestError}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 text-xs text-slate-500">
          لإعادة الاختبار اذهب إلى <code className="bg-slate-100 px-1 rounded">/integrations</code> واضغط «اختبر الاتصال».
        </p>
      </section>
    </div>
  );
}

function Card({ title, big, hint, tone }: { title: string; big: string; hint: string; tone: "ok" | "warn" | "error" | "muted" }) {
  const toneCls: Record<string, string> = {
    ok: "from-emerald-50 to-white border-emerald-200 text-emerald-800",
    warn: "from-amber-50 to-white border-amber-200 text-amber-800",
    error: "from-red-50 to-white border-red-200 text-red-800",
    muted: "from-slate-50 to-white border-slate-200 text-slate-700",
  };
  return (
    <div className={`rounded-2xl border bg-gradient-to-b p-5 shadow-sm ${toneCls[tone]}`}>
      <div className="text-xs font-semibold opacity-70">{title}</div>
      <div className="text-2xl font-bold mt-1">{big}</div>
      <div className="text-xs opacity-70 mt-1">{hint}</div>
    </div>
  );
}

function statusLabel(s?: string) {
  if (s === "ok") return "تعمل";
  if (s === "degraded") return "متدهورة";
  if (s === "down") return "متوقّفة";
  return "—";
}
function toneOf(s?: string): "ok" | "warn" | "error" | "muted" {
  if (s === "ok") return "ok";
  if (s === "degraded") return "warn";
  if (s === "down") return "error";
  return "muted";
}
function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d) return `${d}ي ${h}س`;
  if (h) return `${h}س ${m}د`;
  return `${m}د`;
}
function fmtAge(sec: number): string {
  if (sec < 0) return "الآن";
  if (sec < 60) return `قبل ${sec} ثانية`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `قبل ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} ساعة`;
  return `قبل ${Math.floor(h / 24)} يوم`;
}
function dotColor(i: IntegrationRow): string {
  if (!i.enabled) return "bg-slate-300";
  if (i.lastTestStatus === "ok") return "bg-emerald-500";
  if (i.lastTestStatus === "error") return "bg-red-500";
  return "bg-amber-400";
}

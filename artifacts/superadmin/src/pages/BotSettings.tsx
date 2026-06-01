import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { api, type Bot, type CommissionOverride, type SkzRates, ApiError } from "@/lib/api";
import { botMeta, BOTS } from "@/lib/bots-meta";
import BotTextsEditor from "@/components/BotTextsEditor";

export default function BotSettingsPage() {
  const [, params] = useRoute<{ slug: string }>("/bots/:slug");
  const slug = params?.slug ?? "";
  const meta = botMeta(slug);

  if (!meta) {
    return <div className="p-8" dir="rtl">بوت غير معروف</div>;
  }

  return (
    <div className="p-8 max-w-5xl mx-auto" dir="rtl">
      <header className="flex items-center gap-4 mb-8">
        <div className="text-5xl">{meta.icon}</div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{meta.brand}</h1>
          <p className="text-slate-500 mt-1">{meta.arName} · <code className="text-xs">{slug}</code></p>
        </div>
      </header>

      {slug === "mother-bot" ? <MotherBotPanel /> : <ChildBotPlaceholder slug={slug} brand={meta.brand} arName={meta.arName} />}

      <BotTextsEditor botSlug={slug} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SOUQRATES SYSTEM (mother-bot) — central financial control
// ─────────────────────────────────────────────────────────────────
function MotherBotPanel() {
  const qc = useQueryClient();
  const { data: botsResp } = useQuery({
    queryKey: ["superadmin", "bots"],
    queryFn: () => api.get<{ data: Bot[] }>("/superadmin/bots"),
  });
  const motherBot = botsResp?.data.find((b) => b.slug === "mother-bot");

  return (
    <>
      <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 mb-6">
        <div className="text-sm text-indigo-900">
          <span className="font-semibold">SOUQRATES SYSTEM</span> هو المركز المالي للمنظومة. هنا تتحكم بأسعار صرف SKZ ونسب العمولة لجميع البوتات الفرعية واستثناءات المستخدمين.
        </div>
      </div>

      {motherBot && (
        <BotBasicCard bot={motherBot} onSaved={() => qc.invalidateQueries({ queryKey: ["superadmin", "bots"] })} />
      )}

      <SkzRatesCard />

      <AllBotsCommissionCard
        bots={botsResp?.data ?? []}
        onSaved={() => qc.invalidateQueries({ queryKey: ["superadmin", "bots"] })}
      />

      <OverridesCard />
    </>
  );
}

function ChildBotPlaceholder({ slug, brand, arName }: { slug: string; brand: string; arName: string }) {
  return (
    <Card title="إعدادات خاصة بهذا البوت" subtitle="حدد لي ما تريد التحكم به في هذا البوت بالتحديد">
      <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 text-sm text-amber-900 leading-7">
        لم أُعرّف بعد إعدادات <span className="font-bold">{brand}</span> ({arName}).
        <br />
        النسب المالية وأسعار SKZ والاستثناءات تُدار مركزياً من صفحة <code className="px-1 py-0.5 bg-amber-100 rounded">SOUQRATES SYSTEM</code>.
        <br /><br />
        أخبرني ما الذي تريد إدارته من هنا تحديداً (مثلاً: حدود الرهانات، نصوص الرسائل، حالة الصيانة، أنواع الألعاب…) وسأبنيه.
      </div>
      <div className="mt-4 text-xs text-slate-500">
        slug: <code className="font-mono">{slug}</code>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────
// Reusable cards
// ─────────────────────────────────────────────────────────────────
function BotBasicCard({ bot, onSaved }: { bot: Bot; onSaved: () => void }) {
  const [name, setName] = useState(bot.name);
  const [description, setDescription] = useState(bot.description ?? "");
  const [isActive, setIsActive] = useState(bot.isActive);
  const [botUsername, setBotUsername] = useState((bot as Bot & { botUsername?: string }).botUsername ?? "");
  const [miniAppName, setMiniAppName] = useState((bot as Bot & { miniAppName?: string }).miniAppName ?? "");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    setName(bot.name);
    setDescription(bot.description ?? "");
    setIsActive(bot.isActive);
    setBotUsername((bot as Bot & { botUsername?: string }).botUsername ?? "");
    setMiniAppName((bot as Bot & { miniAppName?: string }).miniAppName ?? "");
  }, [bot.slug, bot.name, bot.description, bot.isActive]);

  const mut = useMutation({
    mutationFn: () =>
      api.patch<Bot>(`/superadmin/bots/${bot.slug}`, {
        name,
        description,
        isActive,
        botUsername,
        miniAppName,
      }),
    onSuccess: () => {
      setMsg({ kind: "ok", text: "تم الحفظ" });
      onSaved();
    },
    onError: (e) => setMsg({ kind: "err", text: e instanceof Error ? e.message : "فشل الحفظ" }),
  });

  const tmeLink = botUsername
    ? miniAppName
      ? `https://t.me/${botUsername}/${miniAppName}`
      : `https://t.me/${botUsername}`
    : null;

  return (
    <Card title="الإعدادات الأساسية" subtitle="اسم البوت ووصفه وحالة التفعيل">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="الاسم"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <label className="flex items-center gap-3 cursor-pointer self-end pb-2">
          <input type="checkbox" className="w-5 h-5 rounded text-indigo-600" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <span className="text-sm text-slate-700">البوت نشط</span>
        </label>
        <div className="md:col-span-2">
          <Field label="الوصف">
            <textarea className={`${inputCls} min-h-[80px]`} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-200 pt-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">رابط Telegram Mini App</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="اسم البوت على تيليغرام (بدون @)">
            <input
              className={inputCls}
              value={botUsername}
              onChange={(e) => setBotUsername(e.target.value.replace(/^@/, ""))}
              placeholder="مثال: SouqratesBot"
              dir="ltr"
            />
          </Field>
          <Field label="اسم الـ Mini App (اختياري)">
            <input
              className={inputCls}
              value={miniAppName}
              onChange={(e) => setMiniAppName(e.target.value)}
              placeholder="مثال: scratchy"
              dir="ltr"
            />
          </Field>
        </div>
        {tmeLink && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-slate-500">الرابط:</span>
            <a href={tmeLink} target="_blank" rel="noopener noreferrer"
              className="text-xs text-indigo-600 hover:underline font-mono break-all">
              {tmeLink}
            </a>
          </div>
        )}
        <p className="text-xs text-slate-400 mt-1">
          يُستخدم هذا الرابط في بوابة البوتات داخل تطبيق SOUQRATES SYSTEM ليفتح البوت مباشرة في تيليغرام.
        </p>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button onClick={() => mut.mutate()} disabled={mut.isPending} className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold">
          {mut.isPending ? "جارٍ الحفظ…" : "حفظ التغييرات"}
        </button>
        {msg && <span className={`text-sm ${msg.kind === "ok" ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</span>}
      </div>
    </Card>
  );
}

function AllBotsCommissionCard({ bots, onSaved }: { bots: Bot[]; onSaved: () => void }) {
  const child = bots.filter((b) => b.slug !== "mother-bot");
  const ordered = BOTS
    .filter((m) => m.slug !== "mother-bot")
    .map((m) => ({ meta: m, bot: child.find((b) => b.slug === m.slug) }));

  return (
    <Card
      title="نسب العمولة لجميع البوتات الفرعية"
      subtitle="نسبة العمولة المركزية المخصومة على كل عملية في كل بوت — يمكن تجاوزها لمستخدم معيّن في جدول الاستثناءات أدناه"
    >
      <div className="space-y-3">
        {ordered.map(({ meta, bot }) => (
          <CommissionRow key={meta.slug} slug={meta.slug} label={meta.brand} sub={meta.arName} icon={meta.icon} bot={bot} onSaved={onSaved} />
        ))}
      </div>
    </Card>
  );
}

function CommissionRow({
  slug,
  label,
  sub,
  icon,
  bot,
  onSaved,
}: {
  slug: string;
  label: string;
  sub: string;
  icon: string;
  bot?: Bot;
  onSaved: () => void;
}) {
  const initial = bot ? (parseFloat(bot.commissionRate) * 100).toFixed(2) : "";
  const [pct, setPct] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (bot) setPct((parseFloat(bot.commissionRate) * 100).toFixed(2));
  }, [bot?.commissionRate]);

  const mut = useMutation({
    mutationFn: () => {
      const rate = parseFloat(pct) / 100;
      if (!Number.isFinite(rate) || rate < 0 || rate > 1) throw new Error("النسبة يجب أن تكون بين 0 و 100");
      return api.patch<Bot>(`/superadmin/bots/${slug}`, { commissionRate: rate.toFixed(4) });
    },
    onSuccess: () => {
      setMsg("✓");
      setTimeout(() => setMsg(null), 1500);
      onSaved();
    },
    onError: (e) => setMsg(e instanceof Error ? e.message : "خطأ"),
  });

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
      <div className="text-2xl">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-slate-900 text-sm">{label}</div>
        <div className="text-xs text-slate-500">{sub}</div>
      </div>
      {!bot ? (
        <span className="text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded">غير مُسجَّل</span>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.01"
              min={0}
              max={100}
              className="w-24 px-3 py-2 rounded-lg border border-slate-300 bg-white text-center"
              value={pct}
              onChange={(e) => setPct(e.target.value)}
            />
            <span className="text-slate-500">%</span>
          </div>
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
            className="px-3 py-2 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold"
          >
            {mut.isPending ? "…" : "حفظ"}
          </button>
          {msg && <span className="text-emerald-600 text-sm font-bold">{msg}</span>}
        </>
      )}
    </div>
  );
}

function SkzRatesCard() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["superadmin", "skz-rates"],
    queryFn: () => api.get<SkzRates>("/settings/skz-rates"),
  });
  const [perUsdt, setPerUsdt] = useState("");
  const [perStar, setPerStar] = useState("");
  const [perTon, setPerTon] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setPerUsdt(data.skzPerUsdt);
      setPerStar(data.skzPerStar);
      setPerTon(data.skzPerTon);
    }
  }, [data]);

  const mut = useMutation({
    mutationFn: () =>
      fetch("/api/settings/skz-rates", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("superadmin_token") ?? ""}`,
        },
        body: JSON.stringify({ skzPerUsdt: perUsdt, skzPerStar: perStar, skzPerTon: perTon }),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({ error: "خطأ" }))).error ?? "خطأ");
        return r.json();
      }),
    onSuccess: () => {
      setMsg("تم تحديث أسعار الصرف");
      qc.invalidateQueries({ queryKey: ["superadmin", "skz-rates"] });
      setTimeout(() => setMsg(null), 3000);
    },
    onError: (e) => setMsg(e instanceof Error ? e.message : "فشل التحديث"),
  });

  return (
    <Card title="أسعار صرف SKZ" subtitle="عملة المنصة الموحدة (SKZ) مقابل العملات الأخرى — تُطبَّق على جميع البوتات">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="SKZ لكل 1 USDT"><input className={inputCls} type="number" step="0.01" value={perUsdt} onChange={(e) => setPerUsdt(e.target.value)} /></Field>
        <Field label="SKZ لكل 1 Star"><input className={inputCls} type="number" step="0.01" value={perStar} onChange={(e) => setPerStar(e.target.value)} /></Field>
        <Field label="SKZ لكل 1 TON"><input className={inputCls} type="number" step="0.01" value={perTon} onChange={(e) => setPerTon(e.target.value)} /></Field>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button onClick={() => mut.mutate()} disabled={mut.isPending} className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold">
          {mut.isPending ? "جارٍ الحفظ…" : "تحديث الأسعار"}
        </button>
        {msg && <span className="text-sm text-emerald-600">{msg}</span>}
      </div>
    </Card>
  );
}

function OverridesCard() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["superadmin", "overrides", "all"],
    queryFn: () => api.get<{ data: CommissionOverride[] }>("/superadmin/commission-overrides"),
  });

  const [tgId, setTgId] = useState("");
  const [botSlug, setBotSlug] = useState("");
  const [pct, setPct] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const addMut = useMutation({
    mutationFn: () => {
      const rate = parseFloat(pct) / 100;
      if (!tgId || !botSlug || !Number.isFinite(rate) || rate < 0 || rate > 1) {
        throw new Error("أدخل Telegram ID وبوت ونسبة بين 0 و 100");
      }
      return api.post<CommissionOverride>("/superadmin/commission-overrides", {
        telegramId: tgId,
        botSlug,
        commissionRate: rate.toFixed(4),
        note,
      });
    },
    onSuccess: () => {
      setMsg({ kind: "ok", text: "تم حفظ الاستثناء" });
      setTgId(""); setPct(""); setNote(""); setBotSlug("");
      qc.invalidateQueries({ queryKey: ["superadmin", "overrides", "all"] });
    },
    onError: (e) => {
      const m = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "فشل الحفظ";
      setMsg({ kind: "err", text: m });
    },
  });

  const delMut = useMutation({
    mutationFn: (id: number) => api.del<{ ok: true }>(`/superadmin/commission-overrides/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["superadmin", "overrides", "all"] }),
  });

  return (
    <Card title="استثناءات العمولة لكل مستخدم" subtitle="نسبة عمولة خاصة لمستخدم معيّن في بوت معيّن — تتجاوز النسبة العامة">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        <Field label="Telegram ID"><input className={inputCls} value={tgId} onChange={(e) => setTgId(e.target.value)} dir="ltr" placeholder="123456789" /></Field>
        <Field label="البوت">
          <select className={inputCls} value={botSlug} onChange={(e) => setBotSlug(e.target.value)}>
            <option value="">— اختر —</option>
            {BOTS.filter((b) => b.slug !== "mother-bot").map((b) => (
              <option key={b.slug} value={b.slug}>{b.brand} ({b.arName})</option>
            ))}
          </select>
        </Field>
        <Field label="النسبة (%)"><input className={inputCls} type="number" step="0.01" min={0} max={100} value={pct} onChange={(e) => setPct(e.target.value)} /></Field>
        <div className="md:col-span-2">
          <Field label="ملاحظة"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: مستخدم VIP" /></Field>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button onClick={() => addMut.mutate()} disabled={addMut.isPending} className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold">
          {addMut.isPending ? "…" : "إضافة / تحديث"}
        </button>
        {msg && <span className={`text-sm ${msg.kind === "ok" ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</span>}
      </div>

      <div className="mt-6">
        <div className="text-sm font-semibold text-slate-700 mb-2">الاستثناءات الحالية ({data?.data.length ?? 0})</div>
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <Th>المستخدم</Th>
                <Th>Telegram ID</Th>
                <Th>البوت</Th>
                <Th>النسبة</Th>
                <Th>ملاحظة</Th>
                <Th>إجراء</Th>
              </tr>
            </thead>
            <tbody>
              {(data?.data ?? []).length === 0 && (
                <tr><td colSpan={6} className="text-center text-slate-400 py-6">لا توجد استثناءات</td></tr>
              )}
              {data?.data.map((o) => {
                const m = botMeta(o.botSlug);
                return (
                  <tr key={o.id} className="border-t border-slate-100">
                    <Td>{o.userFirstName || o.userUsername || "—"}</Td>
                    <Td className="font-mono" dir="ltr">{String(o.telegramId)}</Td>
                    <Td>{m?.brand ?? o.botSlug}</Td>
                    <Td className="font-semibold">{(parseFloat(o.commissionRate) * 100).toFixed(2)}%</Td>
                    <Td className="text-slate-500">{o.note || "—"}</Td>
                    <Td>
                      <button onClick={() => delMut.mutate(o.id)} className="text-red-600 hover:underline text-xs">حذف</button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

// ─── small helpers ──────────────────────────────────────────────
const inputCls = "w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500";

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-500 mt-1">{hint}</span>}
    </label>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-right font-semibold px-4 py-2.5">{children}</th>;
}
function Td({ children, className = "", dir }: { children: React.ReactNode; className?: string; dir?: "ltr" | "rtl" }) {
  return <td className={`px-4 py-2.5 ${className}`} dir={dir}>{children}</td>;
}

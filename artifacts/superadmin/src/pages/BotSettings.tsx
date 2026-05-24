import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { api, type Bot, type CommissionOverride, type SkzRates, ApiError } from "@/lib/api";
import { botMeta } from "@/lib/bots-meta";

export default function BotSettingsPage() {
  const [, params] = useRoute<{ slug: string }>("/bots/:slug");
  const slug = params?.slug ?? "";
  const meta = botMeta(slug);
  const qc = useQueryClient();

  const { data: botsResp } = useQuery({
    queryKey: ["superadmin", "bots"],
    queryFn: () => api.get<{ data: Bot[] }>("/superadmin/bots"),
  });
  const bot = botsResp?.data.find((b) => b.slug === slug);

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
        {bot && (
          <span className={`mr-auto text-xs px-3 py-1.5 rounded-full ${bot.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
            {bot.isActive ? "نشط" : "متوقف"}
          </span>
        )}
      </header>

      {!bot ? (
        <NotRegisteredCard slug={slug} />
      ) : (
        <>
          <BotBasicCard bot={bot} onSaved={() => qc.invalidateQueries({ queryKey: ["superadmin", "bots"] })} />
          {slug === "mother-bot" && <SkzRatesCard />}
          <OverridesCard slug={slug} />
        </>
      )}
    </div>
  );
}

function NotRegisteredCard({ slug }: { slug: string }) {
  return (
    <div className="bg-white border border-amber-300 rounded-2xl p-6">
      <div className="text-amber-700 font-semibold mb-2">هذا البوت غير مُسجَّل في قاعدة البيانات بعد.</div>
      <div className="text-sm text-slate-600">
        أضِفه عبر <code className="px-1 py-0.5 bg-slate-100 rounded">POST /api/bots</code> أو شغّل سكربت seed لإنشاء بوت بـ slug <code className="px-1 py-0.5 bg-slate-100 rounded">{slug}</code>.
      </div>
    </div>
  );
}

function BotBasicCard({ bot, onSaved }: { bot: Bot; onSaved: () => void }) {
  const [name, setName] = useState(bot.name);
  const [description, setDescription] = useState(bot.description ?? "");
  const [ratePct, setRatePct] = useState((parseFloat(bot.commissionRate) * 100).toFixed(2));
  const [isActive, setIsActive] = useState(bot.isActive);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    setName(bot.name);
    setDescription(bot.description ?? "");
    setRatePct((parseFloat(bot.commissionRate) * 100).toFixed(2));
    setIsActive(bot.isActive);
  }, [bot.slug, bot.commissionRate, bot.name, bot.description, bot.isActive]);

  const mut = useMutation({
    mutationFn: async () => {
      const rate = parseFloat(ratePct) / 100;
      if (!Number.isFinite(rate) || rate < 0 || rate > 1) throw new Error("نسبة العمولة يجب أن تكون بين 0 و 100");
      return api.patch<Bot>(`/superadmin/bots/${bot.slug}`, {
        name,
        description,
        commissionRate: rate.toFixed(4),
        isActive,
      });
    },
    onSuccess: () => {
      setMsg({ kind: "ok", text: "تم الحفظ" });
      onSaved();
    },
    onError: (e) => setMsg({ kind: "err", text: e instanceof Error ? e.message : "فشل الحفظ" }),
  });

  return (
    <Card title="الإعدادات الأساسية" subtitle="اسم البوت ونسبة العمولة العامة وحالة التفعيل">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="الاسم"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="نسبة العمولة (%)" hint="مثال: 8.00 تعني 8% من كل عملية إيداع للمستخدم">
          <input className={inputCls} type="number" step="0.01" min={0} max={100} value={ratePct} onChange={(e) => setRatePct(e.target.value)} />
        </Field>
        <div className="md:col-span-2">
          <Field label="الوصف">
            <textarea className={`${inputCls} min-h-[80px]`} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" className="w-5 h-5 rounded text-indigo-600" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <span className="text-sm text-slate-700">البوت نشط</span>
        </label>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={() => mut.mutate()}
          disabled={mut.isPending}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold"
        >
          {mut.isPending ? "جارٍ الحفظ…" : "حفظ التغييرات"}
        </button>
        {msg && (
          <span className={`text-sm ${msg.kind === "ok" ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</span>
        )}
      </div>
    </Card>
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
          // settings/skz-rates uses ADMIN_TOKEN auth (the legacy admin dashboard token).
          // For phase 1 we expose this via the super-admin token by also setting ADMIN_TOKEN
          // to the same value. If you'd rather keep separate tokens, set
          // ADMIN_TOKEN === MASTER_ADMIN_CODE in your environment.
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
    },
    onError: (e) => setMsg(e instanceof Error ? e.message : "فشل التحديث"),
  });

  return (
    <Card title="أسعار صرف SKZ" subtitle="التحكم في عملة المنصة الموحدة (SKZ) مقابل العملات الأخرى">
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

function OverridesCard({ slug }: { slug: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["superadmin", "overrides", slug],
    queryFn: () => api.get<{ data: CommissionOverride[] }>(`/superadmin/commission-overrides?botSlug=${encodeURIComponent(slug)}`),
  });

  const [tgId, setTgId] = useState("");
  const [pct, setPct] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const addMut = useMutation({
    mutationFn: () => {
      const rate = parseFloat(pct) / 100;
      if (!tgId || !Number.isFinite(rate) || rate < 0 || rate > 1) {
        throw new Error("أدخل Telegram ID صحيح ونسبة بين 0 و 100");
      }
      return api.post<CommissionOverride>("/superadmin/commission-overrides", {
        telegramId: tgId,
        botSlug: slug,
        commissionRate: rate.toFixed(4),
        note,
      });
    },
    onSuccess: () => {
      setMsg({ kind: "ok", text: "تم حفظ الاستثناء" });
      setTgId(""); setPct(""); setNote("");
      qc.invalidateQueries({ queryKey: ["superadmin", "overrides", slug] });
    },
    onError: (e) => {
      const m = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "فشل الحفظ";
      setMsg({ kind: "err", text: m });
    },
  });

  const delMut = useMutation({
    mutationFn: (id: number) => api.del<{ ok: true }>(`/superadmin/commission-overrides/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["superadmin", "overrides", slug] }),
  });

  return (
    <Card title="استثناءات العمولة لكل مستخدم" subtitle="حدد نسبة عمولة خاصة لمستخدم معيّن في هذا البوت — تتجاوز النسبة العامة">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <Field label="Telegram ID"><input className={inputCls} value={tgId} onChange={(e) => setTgId(e.target.value)} dir="ltr" placeholder="123456789" /></Field>
        <Field label="نسبة العمولة (%)"><input className={inputCls} type="number" step="0.01" min={0} max={100} value={pct} onChange={(e) => setPct(e.target.value)} /></Field>
        <div className="md:col-span-2">
          <Field label="ملاحظة (اختياري)"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: مستخدم VIP" /></Field>
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
                <Th>النسبة</Th>
                <Th>ملاحظة</Th>
                <Th>إجراء</Th>
              </tr>
            </thead>
            <tbody>
              {(data?.data ?? []).length === 0 && (
                <tr><td colSpan={5} className="text-center text-slate-400 py-6">لا توجد استثناءات</td></tr>
              )}
              {data?.data.map((o) => (
                <tr key={o.id} className="border-t border-slate-100">
                  <Td>{o.userFirstName || o.userUsername || "—"}</Td>
                  <Td className="font-mono" dir="ltr">{String(o.telegramId)}</Td>
                  <Td className="font-semibold">{(parseFloat(o.commissionRate) * 100).toFixed(2)}%</Td>
                  <Td className="text-slate-500">{o.note || "—"}</Td>
                  <Td>
                    <button onClick={() => delMut.mutate(o.id)} className="text-red-600 hover:underline text-xs">حذف</button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

// ── small helpers ──
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

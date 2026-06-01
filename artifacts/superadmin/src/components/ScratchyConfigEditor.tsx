import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import {
  api,
  ApiError,
  type ScratchyConfig,
  type ScratchyTier,
  type ScratchyConfigResponse,
} from "@/lib/api";

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-200 outline-none text-sm";

function clone(c: ScratchyConfig): ScratchyConfig {
  return {
    jackpotBase: c.jackpotBase,
    jackpotMultiplier: c.jackpotMultiplier,
    tiers: c.tiers.map((t) => ({
      ...t,
      prizes: [...t.prizes],
      weights: [...t.weights],
    })),
  };
}

// Win rate = probability the player wins anything (prize > 0).
function tierWinRate(t: ScratchyTier): number {
  let p = 0;
  for (let i = 0; i < t.prizes.length; i++) if (t.prizes[i] > 0) p += t.weights[i] ?? 0;
  return p;
}

// RTP = expected payout per 1 SKZ wagered (Σ prize·weight ÷ cost).
function tierRtp(t: ScratchyTier): number {
  if (t.cost <= 0) return 0;
  let ev = 0;
  for (let i = 0; i < t.prizes.length; i++) ev += (t.prizes[i] ?? 0) * (t.weights[i] ?? 0);
  return ev / t.cost;
}

function weightSum(t: ScratchyTier): number {
  return t.weights.reduce((a, b) => a + (b ?? 0), 0);
}

export default function ScratchyConfigEditor() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["superadmin", "scratchy-config"],
    queryFn: () => api.get<ScratchyConfigResponse>("/superadmin/scratchy-config"),
  });

  const [draft, setDraft] = useState<ScratchyConfig | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (data?.config) setDraft(clone(data.config));
  }, [data]);

  const mut = useMutation({
    mutationFn: (cfg: ScratchyConfig) => api.put<{ config: ScratchyConfig }>("/superadmin/scratchy-config", cfg),
    onSuccess: () => {
      setMsg({ kind: "ok", text: "تم حفظ إعدادات SCRATCHY — تُطبَّق فوراً بدون إعادة تشغيل" });
      qc.invalidateQueries({ queryKey: ["superadmin", "scratchy-config"] });
      setTimeout(() => setMsg(null), 4000);
    },
    onError: (e) => {
      const text =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : "فشل الحفظ";
      setMsg({ kind: "err", text });
    },
  });

  const validation = useMemo(() => {
    if (!draft) return { ok: false, errors: [] as string[] };
    const errors: string[] = [];
    const ids = new Set<string>();
    draft.tiers.forEach((t, idx) => {
      const n = t.label || t.id || `#${idx + 1}`;
      if (ids.has(t.id)) errors.push(`معرّف مكرر: ${t.id}`);
      ids.add(t.id);
      if (t.cost <= 0) errors.push(`${n}: سعر التذكرة يجب أن يكون أكبر من صفر`);
      if (t.prizes.length !== 5 || t.weights.length !== 5)
        errors.push(`${n}: يجب أن يكون لكل فئة 5 جوائز و5 احتمالات`);
      const ws = weightSum(t);
      if (ws <= 0 || ws > 1.0001) errors.push(`${n}: مجموع الاحتمالات يجب أن يكون بين 0 و1 (الحالي ${ws.toFixed(3)})`);
      if (t.prizes.some((p) => p < 0)) errors.push(`${n}: لا يمكن أن تكون الجائزة سالبة`);
      if (t.weights.some((w) => w < 0)) errors.push(`${n}: لا يمكن أن يكون الاحتمال سالباً`);
    });
    if (draft.jackpotBase < 0) errors.push("قاعدة الجاكبوت يجب ألا تكون سالبة");
    if (draft.jackpotMultiplier < 0) errors.push("مُضاعِف الجاكبوت يجب ألا يكون سالباً");
    return { ok: errors.length === 0, errors };
  }, [draft]);

  function patchTier(idx: number, patch: Partial<ScratchyTier>) {
    setDraft((d) => {
      if (!d) return d;
      const tiers = d.tiers.map((t, i) => (i === idx ? { ...t, ...patch } : t));
      return { ...d, tiers };
    });
  }

  function patchArr(idx: number, field: "prizes" | "weights", j: number, value: number) {
    setDraft((d) => {
      if (!d) return d;
      const tiers = d.tiers.map((t, i) => {
        if (i !== idx) return t;
        const arr = [...t[field]];
        arr[j] = value;
        return { ...t, [field]: arr };
      });
      return { ...d, tiers };
    });
  }

  function resetToDefaults() {
    if (data?.defaults) setDraft(clone(data.defaults));
  }

  if (isLoading) {
    return (
      <Card title="اقتصاد SCRATCHY" subtitle="جارٍ التحميل…">
        <div className="h-40 animate-pulse bg-slate-100 rounded-xl" />
      </Card>
    );
  }

  if (isError || !draft) {
    return (
      <Card title="اقتصاد SCRATCHY" subtitle="تعذّر تحميل الإعدادات">
        <div className="bg-rose-50 border border-rose-300 rounded-xl p-4 text-sm text-rose-800">
          تعذّر تحميل إعدادات SCRATCHY. تأكد من تشغيل الخادم وحاول مجدداً.
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="اقتصاد SCRATCHY — التحكم الكامل"
      subtitle="أسعار التذاكر، الجوائز، نسبة الفوز، والجاكبوت. كل تغيير يُطبَّق فوراً على البوت بدون إعادة تشغيل."
    >
      <div className="space-y-5">
        {draft.tiers.map((t, idx) => {
          const wr = tierWinRate(t);
          const rtp = tierRtp(t);
          const ws = weightSum(t);
          return (
            <div key={t.id} className="border border-slate-200 rounded-2xl p-5 bg-slate-50">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl" style={{ minWidth: 32, textAlign: "center" }}>{t.icon}</span>
                  <div>
                    <div className="font-bold text-slate-900">
                      {t.label} <code className="text-xs text-slate-400">{t.id}</code>
                    </div>
                    <div className="text-xs text-slate-500">سعر التذكرة وجدول الجوائز والاحتمالات</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Badge label="نسبة الفوز" value={`${(wr * 100).toFixed(1)}%`} tone="emerald" />
                  <Badge label="عائد اللاعب RTP" value={`${(rtp * 100).toFixed(1)}%`} tone={rtp > 1 ? "rose" : "indigo"} />
                  <Badge label="مجموع الاحتمالات" value={ws.toFixed(3)} tone={ws > 1.0001 ? "rose" : "slate"} />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <Field label="الاسم">
                  <input className={inputCls} value={t.label} onChange={(e) => patchTier(idx, { label: e.target.value })} />
                </Field>
                <Field label="الرمز (أيقونة)">
                  <input className={inputCls} value={t.icon} onChange={(e) => patchTier(idx, { icon: e.target.value })} />
                </Field>
                <Field label="سعر التذكرة (SKZ)">
                  <input
                    className={inputCls}
                    type="number"
                    min={1}
                    value={t.cost}
                    onChange={(e) => patchTier(idx, { cost: Number(e.target.value) })}
                  />
                </Field>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-500 text-xs">
                      <th className="text-right font-medium pb-1 pl-2">#</th>
                      <th className="text-right font-medium pb-1 pl-2">الجائزة (SKZ)</th>
                      <th className="text-right font-medium pb-1">الاحتمال (0–1)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.prizes.map((p, j) => (
                      <tr key={j}>
                        <td className="py-1 pl-2 text-slate-400 text-xs align-middle">{j + 1}</td>
                        <td className="py-1 pl-2">
                          <input
                            className={inputCls}
                            type="number"
                            min={0}
                            value={p}
                            onChange={(e) => patchArr(idx, "prizes", j, Number(e.target.value))}
                          />
                        </td>
                        <td className="py-1">
                          <input
                            className={inputCls}
                            type="number"
                            min={0}
                            max={1}
                            step="0.01"
                            value={t.weights[j]}
                            onChange={(e) => patchArr(idx, "weights", j, Number(e.target.value))}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        <div className="border border-fuchsia-200 rounded-2xl p-5 bg-fuchsia-50">
          <div className="font-bold text-slate-900 mb-1">الجاكبوت</div>
          <p className="text-xs text-slate-500 mb-4">
            الجاكبوت المعروض = القاعدة + (إجمالي مبيعات التذاكر × المُضاعِف).
          </p>
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <Field label="قاعدة الجاكبوت (SKZ)">
              <input
                className={inputCls}
                type="number"
                min={0}
                value={draft.jackpotBase}
                onChange={(e) => setDraft((d) => (d ? { ...d, jackpotBase: Number(e.target.value) } : d))}
              />
            </Field>
            <Field label="مُضاعِف الجاكبوت">
              <input
                className={inputCls}
                type="number"
                min={0}
                step="0.1"
                value={draft.jackpotMultiplier}
                onChange={(e) => setDraft((d) => (d ? { ...d, jackpotMultiplier: Number(e.target.value) } : d))}
              />
            </Field>
          </div>
        </div>

        {!validation.ok && (
          <div className="bg-rose-50 border border-rose-300 rounded-xl p-4 text-sm text-rose-800">
            <div className="font-semibold mb-1">يجب إصلاح ما يلي قبل الحفظ:</div>
            <ul className="list-disc pr-5 space-y-0.5">
              {validation.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => draft && mut.mutate(draft)}
            disabled={mut.isPending || !validation.ok}
            className="px-5 py-2.5 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 text-white font-semibold"
          >
            {mut.isPending ? "جارٍ الحفظ…" : "حفظ إعدادات SCRATCHY"}
          </button>
          <button
            onClick={resetToDefaults}
            type="button"
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium flex items-center gap-2"
          >
            <RotateCcw size={16} /> استعادة الإعدادات الافتراضية
          </button>
          {msg && (
            <span className={`text-sm ${msg.kind === "ok" ? "text-emerald-600" : "text-rose-600"}`}>{msg.text}</span>
          )}
        </div>
      </div>
    </Card>
  );
}

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

function Badge({ label, value, tone }: { label: string; value: string; tone: "emerald" | "indigo" | "rose" | "slate" }) {
  const tones: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    slate: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span className={`px-2 py-1 rounded-lg border ${tones[tone]}`}>
      <span className="opacity-70">{label}:</span> <span className="font-bold">{value}</span>
    </span>
  );
}

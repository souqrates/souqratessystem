import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pause, Play } from "lucide-react";
import { api } from "@/lib/api";

// ─── Types mirroring the backend public view ────────────────────────────
interface AdapterField {
  key: string;
  label: string;
  type: "text" | "password" | "url" | "select";
  required?: boolean;
  secret?: boolean;
  placeholder?: string;
  help?: string;
  default?: string;
  options?: Array<{ value: string; label: string }>;
}

interface IntegrationView {
  slug: string;
  enabled: boolean;
  configured: boolean;
  fields: Record<string, string>;
  fieldMeta: Record<string, { hasValue: boolean; masked?: string }>;
  lastTestAt: string | null;
  lastTestStatus: string | null;
  lastTestError: string | null;
  lastTestMetadata: Record<string, unknown> | null;
  adapter: {
    slug: string;
    name: string;
    brand: string;
    category: string;
    tier: number;
    description: string;
    signupUrl: string;
    docsUrl: string;
    pricing: string;
    fields: AdapterField[];
  };
}

const TIER_LABEL: Record<number, { ar: string; color: string }> = {
  1: { ar: "أساسي — لتحمّل الملايين", color: "bg-rose-100 text-rose-700 border-rose-200" },
  2: { ar: "احترافي", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  3: { ar: "أمان وموثوقية", color: "bg-amber-100 text-amber-700 border-amber-200" },
  4: { ar: "توسعات", color: "bg-slate-100 text-slate-700 border-slate-200" },
};

const CATEGORY_LABEL: Record<string, string> = {
  infra: "بنية تحتية",
  monitoring: "مراقبة",
  comms: "تواصل",
  security: "أمان",
  payments: "مدفوعات",
  analytics: "تحليلات",
  ai: "ذكاء اصطناعي",
  storage: "تخزين",
};

export default function IntegrationsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["superadmin", "integrations"],
    queryFn: () => api.get<{ data: IntegrationView[] }>("/superadmin/integrations"),
  });

  const grouped = useMemo(() => {
    const items = data?.data ?? [];
    const byTier = new Map<number, IntegrationView[]>();
    for (const it of items) {
      const t = it.adapter.tier;
      if (!byTier.has(t)) byTier.set(t, []);
      byTier.get(t)!.push(it);
    }
    return Array.from(byTier.entries()).sort(([a], [b]) => a - b);
  }, [data]);

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">التكاملات الخارجية</h1>
        <p className="text-slate-500 mt-1">
          الصق المفتاح، اضغط "اختبر الاتصال"، فعّل. كل شيء جاهز للملايين.
        </p>
      </header>

      {isLoading && <div className="text-slate-400 py-10 text-center">جارٍ التحميل…</div>}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">
          {(error as Error).message}
        </div>
      )}

      {grouped.map(([tier, items]) => {
        const meta = TIER_LABEL[tier] ?? TIER_LABEL[4]!;
        return (
          <section key={tier} className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-lg font-bold text-slate-800">Tier {tier}</h2>
              <span className={`text-xs px-2.5 py-1 rounded-full border ${meta.color}`}>{meta.ar}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map((it) => (
                <IntegrationCard key={it.slug} item={it} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function IntegrationCard({ item }: { item: IntegrationView }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>(item.fields);

  const status = useMemo(() => {
    if (!item.configured) {
      return { color: "bg-slate-100 text-slate-600 border-slate-200", label: "غير معدّ", icon: "○" };
    }
    if (item.lastTestStatus === "ok" && item.enabled) {
      return { color: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "نشط ومتصل", icon: "●" };
    }
    if (item.lastTestStatus === "ok" && !item.enabled) {
      return { color: "bg-amber-100 text-amber-700 border-amber-200", label: "متصل لكن موقوف", icon: "◐" };
    }
    if (item.lastTestStatus === "failed") {
      return { color: "bg-red-100 text-red-700 border-red-200", label: "فشل الاختبار", icon: "✕" };
    }
    return { color: "bg-slate-100 text-slate-600 border-slate-200", label: "بانتظار الاختبار", icon: "?" };
  }, [item]);

  const saveMut = useMutation({
    mutationFn: (payload: { enabled?: boolean; config?: Record<string, string> }) =>
      api.put<IntegrationView>(`/superadmin/integrations/${item.slug}`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["superadmin", "integrations"] }),
  });

  const testMut = useMutation({
    mutationFn: () =>
      api.post<{ ok: boolean; error: string | null; metadata: unknown; view: IntegrationView }>(
        `/superadmin/integrations/${item.slug}/test`,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["superadmin", "integrations"] }),
  });

  const deleteMut = useMutation({
    mutationFn: () => api.del<{ ok: true }>(`/superadmin/integrations/${item.slug}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["superadmin", "integrations"] }),
  });

  function saveConfig() {
    // Only send fields the admin actually edited (non-empty) or non-secret fields
    // that were present. Secret fields left blank preserve the previous encrypted value.
    const payload: Record<string, string> = {};
    for (const f of item.adapter.fields) {
      const v = fields[f.key] ?? "";
      if (f.secret) {
        if (v) payload[f.key] = v; // only send if admin typed a new secret
      } else {
        payload[f.key] = v;
      }
    }
    saveMut.mutate({ config: payload });
  }

  function toggleEnabled() {
    if (!item.configured) return;
    saveMut.mutate({ enabled: !item.enabled });
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-bold text-slate-900">{item.adapter.name}</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
              {CATEGORY_LABEL[item.adapter.category] ?? item.adapter.category}
            </span>
          </div>
          <p className="text-sm text-slate-600 leading-snug">{item.adapter.description}</p>
        </div>
        <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full border font-semibold ${status.color}`}>
          {status.icon} {status.label}
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-500 mb-3 flex-wrap">
        <a href={item.adapter.signupUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
          ↗ التسجيل
        </a>
        <a href={item.adapter.docsUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
          ↗ التوثيق
        </a>
        <span>·</span>
        <span className="text-slate-600">{item.adapter.pricing}</span>
      </div>

      {item.lastTestAt && (
        <div className={`text-xs rounded-lg px-3 py-2 mb-3 ${item.lastTestStatus === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          آخر اختبار: {new Date(item.lastTestAt).toLocaleString("ar-EG")}
          {item.lastTestStatus === "ok" && item.lastTestMetadata && Object.keys(item.lastTestMetadata).length > 0 && (
            <div className="mt-1 text-[11px] opacity-80 font-mono" dir="ltr">
              {JSON.stringify(item.lastTestMetadata)}
            </div>
          )}
          {item.lastTestStatus === "failed" && item.lastTestError && (
            <div className="mt-1 text-[11px] font-mono" dir="ltr">{item.lastTestError}</div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setOpen((v) => !v)}
          className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
        >
          {open ? "إخفاء" : item.configured ? "تعديل المفاتيح" : "إعداد المفاتيح"}
        </button>
        <button
          onClick={() => testMut.mutate()}
          disabled={!item.configured || testMut.isPending}
          className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-40"
        >
          {testMut.isPending ? "جاري الاختبار…" : "اختبر الاتصال"}
        </button>
        <button
          onClick={toggleEnabled}
          disabled={!item.configured || saveMut.isPending}
          className={`px-3 py-1.5 text-sm rounded-lg font-semibold disabled:opacity-40 ${
            item.enabled
              ? "bg-amber-100 hover:bg-amber-200 text-amber-800"
              : "bg-emerald-600 hover:bg-emerald-500 text-white"
          }`}
        >
          {item.enabled ? <><Pause size={12} className="inline mr-1" />إيقاف</> : <><Play size={12} className="inline mr-1" />تفعيل</>}
        </button>
        {item.configured && (
          <button
            onClick={() => {
              if (confirm(`حذف إعدادات ${item.adapter.name}؟ ستفقد المفاتيح المحفوظة.`)) deleteMut.mutate();
            }}
            className="px-3 py-1.5 text-sm rounded-lg text-red-600 hover:bg-red-50 font-semibold"
          >
            حذف الإعدادات
          </button>
        )}
      </div>

      {open && (
        <div className="mt-4 border-t border-slate-200 pt-4 space-y-3">
          {item.adapter.fields.map((f) => (
            <FieldInput
              key={f.key}
              field={f}
              value={fields[f.key] ?? ""}
              masked={item.fieldMeta[f.key]?.masked}
              hasValue={item.fieldMeta[f.key]?.hasValue ?? false}
              onChange={(v) => setFields({ ...fields, [f.key]: v })}
            />
          ))}
          <div className="flex items-center gap-2">
            <button
              onClick={saveConfig}
              disabled={saveMut.isPending}
              className="px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-40"
            >
              {saveMut.isPending ? "جاري الحفظ…" : "حفظ"}
            </button>
            {saveMut.isError && (
              <span className="text-red-600 text-sm">{(saveMut.error as Error).message}</span>
            )}
            {saveMut.isSuccess && !saveMut.isPending && (
              <span className="text-emerald-600 text-sm">تم الحفظ — اضغط "اختبر الاتصال"</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FieldInput({
  field,
  value,
  masked,
  hasValue,
  onChange,
}: {
  field: AdapterField;
  value: string;
  masked?: string;
  hasValue: boolean;
  onChange: (v: string) => void;
}) {
  const placeholder = field.secret && hasValue ? masked ?? "•••• (محفوظ)" : field.placeholder ?? "";

  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs font-semibold text-slate-700">
          {field.label} {field.required && <span className="text-red-500">*</span>}
        </span>
        {field.secret && hasValue && (
          <span className="text-[10px] text-slate-400">اتركه فارغاً للإبقاء على القيمة المحفوظة</span>
        )}
      </div>
      {field.type === "select" && field.options ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-indigo-500"
        >
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={field.type === "password" ? "password" : "text"}
          value={value}
          dir="ltr"
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-indigo-500 font-mono"
        />
      )}
      {field.help && <div className="text-[11px] text-slate-500 mt-1">{field.help}</div>}
    </label>
  );
}

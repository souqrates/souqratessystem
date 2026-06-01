import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface Tier {
  level: number;
  name: string;
  color: string;
  minSalesSkz: string;
  minCustomers: number;
  discountRate: string;
  perks: string[];
}

export default function SubagentTiersPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "subagent-tiers"],
    queryFn: () => api.get<{ data: Tier[] }>("/superadmin/subagent-tiers"),
  });

  const seed = useMutation({
    mutationFn: () => api.post("/superadmin/subagent-tiers/seed", {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["superadmin", "subagent-tiers"] }),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto" dir="rtl">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">♛ مراتب الشركاء (Sub-Agent Tiers)</h1>
          <p className="text-slate-500 mt-1">سُلّم 7 مراتب — حدّد الحد الأدنى للترقية ونسبة الخصم لكل مرتبة</p>
        </div>
        {(data?.data ?? []).length < 7 && (
          <button onClick={() => seed.mutate()} disabled={seed.isPending}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl">
            زرع المراتب الافتراضية
          </button>
        )}
      </header>

      {isLoading ? (
        <div className="text-center py-10 text-slate-400">جارٍ التحميل…</div>
      ) : (data?.data ?? []).length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center text-amber-700">
          لا توجد مراتب مُعرَّفة. اضغط "زرع المراتب الافتراضية" للبدء.
        </div>
      ) : (
        <div className="space-y-3">
          {(data?.data ?? []).map((tier) => <TierRow key={tier.level} tier={tier} />)}
        </div>
      )}
    </div>
  );
}

function TierRow({ tier }: { tier: Tier }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: tier.name,
    color: tier.color,
    minSalesSkz: tier.minSalesSkz,
    minCustomers: tier.minCustomers,
    discountRate: tier.discountRate,
    perks: tier.perks.join("\n"),
  });
  useEffect(() => {
    setForm({
      name: tier.name, color: tier.color,
      minSalesSkz: tier.minSalesSkz, minCustomers: tier.minCustomers,
      discountRate: tier.discountRate, perks: tier.perks.join("\n"),
    });
  }, [tier]);

  const save = useMutation({
    mutationFn: () => api.put(`/superadmin/subagent-tiers/${tier.level}`, {
      name: form.name,
      color: form.color,
      minSalesSkz: form.minSalesSkz,
      minCustomers: Number(form.minCustomers),
      discountRate: form.discountRate,
      perks: form.perks.split("\n").map((s) => s.trim()).filter(Boolean),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["superadmin", "subagent-tiers"] }),
  });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black"
             style={{ background: form.color }}>{tier.level}</div>
        <div className="flex-1">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                 className="text-lg font-bold border-b border-transparent hover:border-slate-300 focus:border-amber-500 focus:outline-none w-full bg-transparent" />
          <div className="text-xs text-slate-500">المرتبة {tier.level} من 7</div>
        </div>
        <button onClick={() => save.mutate()} disabled={save.isPending}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm disabled:opacity-50">
          {save.isPending ? "…" : "حفظ"}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <Field label="اللون">
          <div className="flex gap-2">
            <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}
                   className="w-10 h-9 rounded border border-slate-200" />
            <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}
                   className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded font-mono" />
          </div>
        </Field>
        <Field label="حد أدنى مبيعات (SKZ)">
          <input value={form.minSalesSkz} onChange={(e) => setForm({ ...form, minSalesSkz: e.target.value })}
                 className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg" />
        </Field>
        <Field label="حد أدنى عملاء">
          <input type="number" value={form.minCustomers} onChange={(e) => setForm({ ...form, minCustomers: Number(e.target.value) })}
                 className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg" />
        </Field>
        <Field label="نسبة الخصم (0..1)">
          <input value={form.discountRate} onChange={(e) => setForm({ ...form, discountRate: e.target.value })}
                 className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg" />
          <div className="text-[10px] text-slate-400 mt-0.5">= {(parseFloat(form.discountRate || "0") * 100).toFixed(2)}%</div>
        </Field>
      </div>

      <Field label="المزايا (سطر لكل ميزة)">
        <textarea value={form.perks} onChange={(e) => setForm({ ...form, perks: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" />
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-bold text-slate-600 mb-1">{label}</div>
      {children}
    </div>
  );
}

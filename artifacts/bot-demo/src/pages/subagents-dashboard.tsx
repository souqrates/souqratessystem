import { useState } from "react";
import { Link } from "wouter";
import { useSubAgentMe, useSubAgentTiers, useSell, useMySales } from "../lib/use-subagent";
import { Loader2, Crown, TrendingUp, Users, Percent, Send, X } from "lucide-react";

export function SubAgentsDashboard() {
  const { data: me, isLoading } = useSubAgentMe();
  const { data: tiers } = useSubAgentTiers();
  const { data: sales } = useMySales();
  const [sellOpen, setSellOpen] = useState(false);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-amber-400" size={32} /></div>;
  }
  if (me?.status !== "approved") {
    return (
      <div className="px-4 pt-8 text-center space-y-3" dir="rtl">
        <p className="text-sm text-white/60">اللوحة متاحة بعد الموافقة على طلبك.</p>
        <Link href="/subagents">
          <a className="inline-block px-6 py-2 rounded-xl bg-white/10 text-sm">العودة</a>
        </Link>
      </div>
    );
  }

  const agent = me.agent!;
  const tier = me.tier;
  const wallet = me.wallet;
  const skzBalance = wallet ? parseFloat(wallet.balanceSkz) : 0;
  const totalSales = parseFloat(agent.totalSalesSkz);
  // Next-tier progress
  const sortedTiers = (tiers?.data ?? []).filter(Boolean) as NonNullable<typeof tiers>["data"];
  const nextTier = sortedTiers.find((t) => t && agent.tierLevel != null && t.level === agent.tierLevel + 1);

  return (
    <div className="px-4 pt-4 pb-8 space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider">لوحة الشريك</div>
          <div className="text-base font-bold">{agent.fullName}</div>
        </div>
        {tier && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
               style={{ background: `${tier.color}22`, color: tier.color, border: `1px solid ${tier.color}55` }}>
            <Crown size={12} /> {tier.name}
          </div>
        )}
      </div>

      <div className="rounded-3xl p-5 relative overflow-hidden"
           style={{ background: "linear-gradient(135deg, #D4AF37 0%, #b8941f 100%)", boxShadow: "0 12px 32px rgba(212,175,55,0.35)" }}>
        <div className="text-white/80 text-[11px] font-bold uppercase tracking-wider mb-1">رصيدي للبيع</div>
        <div className="text-4xl font-black text-white">{skzBalance.toLocaleString()} <span className="text-lg font-bold opacity-70">SKZ</span></div>
        <button onClick={() => setSellOpen(true)}
                className="mt-4 w-full bg-white/20 hover:bg-white/30 backdrop-blur py-3 rounded-2xl text-white font-bold flex items-center justify-center gap-2">
          <Send size={16} /> بيع SKZ لعميل
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat icon={<TrendingUp size={16} />} value={totalSales.toLocaleString()} label="إجمالي المبيعات" />
        <Stat icon={<Users size={16} />} value={String(agent.totalCustomers)} label="عملاؤك" />
        <Stat icon={<Percent size={16} />} value={tier ? `${(parseFloat(tier.discountRate) * 100).toFixed(1)}%` : "-"} label="خصمك" />
      </div>

      {nextTier && (
        <div className="glass-card rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white/80">المرتبة التالية: {nextTier.name}</span>
            <span className="text-white/50">{(parseFloat(nextTier.discountRate) * 100).toFixed(1)}% خصم</span>
          </div>
          <Progress current={totalSales} target={parseFloat(nextTier.minSalesSkz)} label="مبيعات" />
          <Progress current={agent.totalCustomers} target={nextTier.minCustomers} label="عملاء" />
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-bold text-white/80">آخر المبيعات</h3>
        {(sales?.data ?? []).length === 0 && (
          <div className="text-xs text-white/40 text-center py-6">لا توجد مبيعات بعد. ابدأ بأول عملية بيع ✦</div>
        )}
        {(sales?.data ?? []).slice(0, 10).map((s) => (
          <div key={s.id} className="glass-card rounded-xl p-3 flex items-center justify-between text-xs">
            <div>
              <div className="font-bold">عميل {s.customerMasked}</div>
              <div className="text-white/40 text-[10px]">{new Date(s.createdAt).toLocaleString("ar-EG")}</div>
            </div>
            <div className="font-black text-amber-400">{parseFloat(s.skzAmount).toLocaleString()} SKZ</div>
          </div>
        ))}
      </div>

      {sellOpen && <SellModal onClose={() => setSellOpen(false)} maxSkz={skzBalance} />}
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="glass-card rounded-2xl p-3 text-center space-y-1">
      <div className="inline-flex w-8 h-8 rounded-lg items-center justify-center bg-amber-500/20 text-amber-400">{icon}</div>
      <div className="font-black text-sm">{value}</div>
      <div className="text-[10px] text-white/50">{label}</div>
    </div>
  );
}

function Progress({ current, target, label }: { current: number; target: number; label: string }) {
  const pct = Math.min(100, target > 0 ? (current / target) * 100 : 100);
  return (
    <div>
      <div className="flex justify-between text-[10px] text-white/60 mb-1">
        <span>{label}</span>
        <span>{current.toLocaleString()} / {target.toLocaleString()}</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-amber-500 to-amber-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SellModal({ onClose, maxSkz }: { onClose: () => void; maxSkz: number }) {
  const sell = useSell();
  const [tg, setTg] = useState("");
  const [amt, setAmt] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<null | { sold: number; newBal: string }>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const amount = parseFloat(amt);
    if (!/^\d+$/.test(tg)) { setErr("معرّف تيليغرام يجب أن يكون أرقاماً فقط"); return; }
    if (!Number.isFinite(amount) || amount <= 0) { setErr("أدخل كمية صحيحة"); return; }
    if (amount > maxSkz) { setErr("الكمية تتجاوز رصيدك"); return; }
    try {
      const res = await sell.mutateAsync({
        customerTelegramId: tg, skzAmount: amount, note: note.trim() || undefined,
      });
      setDone({ sold: amount, newBal: res.agentBalanceSkz });
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full max-w-md bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-white/10 p-5 space-y-4" onClick={(e) => e.stopPropagation()} dir="rtl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">♛ بيع SKZ لعميل</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"><X size={16} /></button>
        </div>
        {done ? (
          <div className="space-y-4 text-center py-4">
            <div className="text-5xl">✅</div>
            <div className="font-bold">تم تحويل {done.sold.toLocaleString()} SKZ</div>
            <div className="text-xs text-white/60">رصيدك الجديد: {parseFloat(done.newBal).toLocaleString()} SKZ</div>
            <button onClick={onClose} className="w-full py-3 rounded-2xl bg-amber-500/20 text-amber-300 font-bold">تم</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-xs font-bold text-white/80">معرّف تيليغرام للعميل</label>
              <input value={tg} onChange={(e) => setTg(e.target.value.replace(/\D/g, ""))}
                     placeholder="123456789"
                     className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm" />
              <div className="text-[10px] text-white/40 mt-1">العميل يجب أن يكون مسجلاً في المنصة (راسل البوت الأم)</div>
            </div>
            <div>
              <label className="text-xs font-bold text-white/80">الكمية (SKZ)</label>
              <input type="number" min="1" step="0.01" max={maxSkz} value={amt}
                     onChange={(e) => setAmt(e.target.value)}
                     className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm" />
              <div className="text-[10px] text-white/40 mt-1">الحد الأقصى: {maxSkz.toLocaleString()} SKZ</div>
            </div>
            <div>
              <label className="text-xs font-bold text-white/80">ملاحظة (اختياري)</label>
              <input value={note} onChange={(e) => setNote(e.target.value)}
                     className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm" />
            </div>
            {err && <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-2.5 text-xs text-red-300">{err}</div>}
            <button type="submit" disabled={sell.isPending}
                    className="w-full py-3 rounded-2xl font-bold text-white disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #D4AF37, #b8941f)" }}>
              {sell.isPending ? "جاري التنفيذ…" : "✦ تأكيد البيع"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

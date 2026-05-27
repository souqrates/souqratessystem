import { Link } from "wouter";
import { useSubAgentMe, useSubAgentTiers } from "../lib/use-subagent";
import { Loader2, Crown, TrendingUp, Users, Percent } from "lucide-react";

export function SubAgentsLanding() {
  const { data: me, isLoading } = useSubAgentMe();
  const { data: tiers } = useSubAgentTiers();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-amber-400" size={32} />
      </div>
    );
  }

  const status = me?.status ?? "not_applied";

  return (
    <div className="px-4 pt-4 space-y-5 pb-8" dir="rtl">
      <div className="text-center space-y-2 pt-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl"
             style={{ background: "linear-gradient(135deg, #D4AF37, #b8941f)", boxShadow: "0 8px 32px rgba(212,175,55,0.4)" }}>
          <Crown className="text-white" size={32} />
        </div>
        <h1 className="text-2xl font-black">SOUQRATES SUB-AGENTS</h1>
        <p className="text-sm text-white/60">برنامج الشركاء والموزّعين المعتمدين</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Feature icon={<TrendingUp size={18} />} label="بيع SKZ بالجملة" />
        <Feature icon={<Percent size={18} />} label="خصومات تصاعدية" />
        <Feature icon={<Users size={18} />} label="عملاؤك الخاصون" />
      </div>

      {status === "not_applied" && (
        <Link href="/subagents/apply">
          <a className="block w-full text-center py-4 rounded-2xl font-bold text-base text-white"
             style={{ background: "linear-gradient(135deg, #D4AF37, #b8941f)", boxShadow: "0 8px 24px rgba(212,175,55,0.4)" }}>
            ♛ قدّم طلبك الآن
          </a>
        </Link>
      )}
      {status === "pending" && (
        <Link href="/subagents/pending">
          <a className="block w-full text-center py-4 rounded-2xl font-bold text-base text-white bg-amber-600/80">
            ⏳ طلبك قيد المراجعة
          </a>
        </Link>
      )}
      {status === "approved" && (
        <Link href="/subagents/dashboard">
          <a className="block w-full text-center py-4 rounded-2xl font-bold text-base text-white"
             style={{ background: "linear-gradient(135deg, #D4AF37, #b8941f)" }}>
            ♛ افتح لوحة الشريك
          </a>
        </Link>
      )}
      {status === "rejected" && (
        <div className="space-y-2">
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-sm">
            ❌ لم يتم قبول طلبك. السبب: <span className="font-bold">{me?.agent?.rejectedReason ?? "غير محدد"}</span>
          </div>
          <Link href="/subagents/apply">
            <a className="block w-full text-center py-3 rounded-2xl font-bold text-sm bg-white/10 hover:bg-white/20">
              ✏️ إعادة التقديم
            </a>
          </Link>
        </div>
      )}
      {status === "suspended" && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 text-sm text-center">
          🚫 حسابك معلّق. يرجى التواصل مع الدعم.
        </div>
      )}

      <div className="space-y-3 pt-2">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Crown size={18} className="text-amber-400" /> سُلّم المراتب السبعة
        </h3>
        <div className="space-y-2">
          {(tiers?.data ?? []).map((tier) => tier && (
            <div key={tier.level} className="glass-card rounded-2xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white shrink-0"
                   style={{ background: tier.color }}>
                {tier.level}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm">{tier.name}</div>
                <div className="text-[11px] text-white/50">
                  مبيعات {parseFloat(tier.minSalesSkz).toLocaleString()} SKZ · {tier.minCustomers} عميل
                </div>
              </div>
              <div className="text-amber-400 font-black text-sm">
                {(parseFloat(tier.discountRate) * 100).toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="glass-card rounded-2xl p-3 text-center space-y-1.5">
      <div className="inline-flex w-9 h-9 rounded-xl items-center justify-center bg-amber-500/20 text-amber-400">{icon}</div>
      <div className="text-[10px] font-medium text-white/70 leading-tight">{label}</div>
    </div>
  );
}

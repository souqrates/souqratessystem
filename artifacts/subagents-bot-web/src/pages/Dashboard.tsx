import { useLocation } from "wouter";
import { useGetSubAgentMe, useGetSubAgentTiers } from "@workspace/api-client-react";
import { Wallet, TrendingUp, Users, ArrowUpRight, Award, History, UserCircle, LogOut } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import TierBadge from "@/components/TierBadge";

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { data: me, isLoading: meLoading } = useGetSubAgentMe();
  const { data: tiersData } = useGetSubAgentTiers();

  if (meLoading || !me) return null;

  const agent = me.agent;
  const wallet = me.wallet;
  const currentTier = me.tier;
  const tiers = tiersData?.data || [];

  // Compute next tier
  const nextTier = currentTier 
    ? tiers.find(t => t.level === currentTier.level + 1)
    : tiers.find(t => t.level === 1);

  const totalSales = parseFloat(agent?.totalSalesSkz || "0");
  const totalCustomers = agent?.totalCustomers || 0;
  
  let salesProgress = 100;
  let customersProgress = 100;

  if (nextTier) {
    const minSales = parseFloat(nextTier.minSalesSkz);
    salesProgress = minSales > 0 ? Math.min(100, (totalSales / minSales) * 100) : 100;
    
    const minCust = nextTier.minCustomers;
    customersProgress = minCust > 0 ? Math.min(100, (totalCustomers / minCust) * 100) : 100;
  }

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground flex flex-col">
      {/* Header Profile Area */}
      <div className="bg-primary text-primary-foreground p-6 pt-10 pb-8 rounded-b-3xl shadow-sm">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-xl font-bold">{agent?.fullName}</h1>
            <p className="text-sm text-primary-foreground/70 opacity-90 mt-1 flex items-center gap-1">
              <Award className="w-4 h-4" /> 
              شريك معتمد
            </p>
          </div>
          {currentTier && (
            <TierBadge tier={currentTier} className="shadow-xl ring-2 ring-background/10" />
          )}
        </div>

        {/* Wallet Balance Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/10 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-32 h-32 bg-secondary/20 rounded-full blur-3xl -mr-10 -mt-10" />
          <p className="text-sm font-medium text-white/80 mb-1 flex items-center gap-2">
            <Wallet className="w-4 h-4" /> رصيد SKZ المتاح
          </p>
          <h2 className="text-4xl font-bold text-white tracking-tight" dir="ltr" style={{ textAlign: 'right' }}>
            {parseFloat(wallet?.balanceSkz || "0").toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
        </div>
      </div>

      <div className="px-4 mt-6 space-y-6 flex-1">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => setLocation("/sell")}
            className="bg-secondary text-secondary-foreground hover:bg-secondary/90 h-14 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95"
          >
            <ArrowUpRight className="w-5 h-5" />
            بيع SKZ
          </button>
          <button 
            onClick={() => setLocation("/sales")}
            className="bg-card text-card-foreground border hover:bg-accent/50 h-14 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95"
          >
            <History className="w-5 h-5" />
            سجل المبيعات
          </button>
        </div>

        {/* Progress to next tier */}
        {nextTier && (
          <div className="bg-card rounded-2xl p-5 border shadow-sm">
            <div className="flex justify-between items-end mb-4">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  التقدم للمستوى التالي
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  الترقية إلى <span className="font-bold" style={{ color: nextTier.color }}>{nextTier.name}</span>
                </p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1.5 font-medium">
                  <span>حجم المبيعات</span>
                  <span dir="ltr">{totalSales.toLocaleString()} / {parseFloat(nextTier.minSalesSkz).toLocaleString()} SKZ</span>
                </div>
                <Progress value={salesProgress} className="h-2" />
              </div>
              
              <div>
                <div className="flex justify-between text-xs mb-1.5 font-medium">
                  <span>عدد العملاء</span>
                  <span>{totalCustomers} / {nextTier.minCustomers}</span>
                </div>
                <Progress value={customersProgress} className="h-2" />
              </div>
            </div>
          </div>
        )}

        {/* Current Perks */}
        {currentTier?.perks && currentTier.perks.length > 0 && (
          <div className="bg-card rounded-2xl p-5 border shadow-sm">
            <h3 className="font-bold text-base mb-4">مزايا مستواك الحالي</h3>
            <ul className="space-y-3">
              {currentTier.perks.map((perk, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  </div>
                  <span className="text-muted-foreground leading-relaxed">{perk}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Bottom Nav Stub (Optional, keeping it simple) */}
    </div>
  );
}

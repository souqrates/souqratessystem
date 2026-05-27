import { useEffect } from "react";
import { useLocation } from "wouter";
import { useGetSubAgentMe, useGetSubAgentTiers, getGetSubAgentMeQueryKey } from "@workspace/api-client-react";
import { Loader2, ShieldCheck, ChevronLeft } from "lucide-react";

export default function LandingRouter() {
  const [, setLocation] = useLocation();
  const { data: me, isLoading: meLoading } = useGetSubAgentMe({
    query: {
      retry: false,
      queryKey: getGetSubAgentMeQueryKey(),
    }
  });
  
  const { data: tiersData, isLoading: tiersLoading } = useGetSubAgentTiers();

  useEffect(() => {
    if (meLoading) return;
    
    // Route by status
    if (me?.status === "pending") {
      setLocation("/pending");
    } else if (me?.status === "approved") {
      setLocation("/dashboard");
    } else if (me?.status === "rejected") {
      setLocation("/rejected");
    } else if (me?.status === "suspended") {
      setLocation("/suspended");
    }
    // "not_applied" or error usually falls through to here to show the landing page marketing
  }, [me, meLoading, setLocation]);

  if (meLoading || tiersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const tiers = tiersData?.data || [];

  return (
    <div className="min-h-screen pb-20 bg-background text-foreground flex flex-col">
      <div className="relative w-full h-64 bg-primary text-primary-foreground flex flex-col items-center justify-center p-6 text-center overflow-hidden">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative z-10 space-y-4">
          <ShieldCheck className="w-16 h-16 text-secondary mx-auto" />
          <h1 className="text-3xl font-bold">برنامج شركاء SOUQRATES</h1>
          <p className="text-primary-foreground/80 max-w-sm mx-auto text-sm leading-relaxed">
            بوابة النخبة لبيع وتوزيع أرصدة SKZ. انضم الآن، تدرج في مستويات الشراكة، واحصل على خصومات حصرية ومزايا استثنائية.
          </p>
        </div>
      </div>

      <div className="px-4 py-8 space-y-8 flex-1">
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-center">مستويات الشراكة</h2>
          <div className="space-y-3">
            {tiers.map((tier) => (
              <div 
                key={tier.level}
                className="flex items-center justify-between p-4 rounded-xl bg-card border shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-inner"
                    style={{ backgroundColor: tier.color }}
                  >
                    {tier.level}
                  </div>
                  <div>
                    <h3 className="font-bold text-card-foreground">{tier.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      خصم {(parseFloat(tier.discountRate) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground flex flex-col items-end">
                  <span>مبيعات: {tier.minSalesSkz} SKZ</span>
                  <span>عملاء: {tier.minCustomers}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t">
        <button 
          onClick={() => setLocation("/apply")}
          className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 h-12 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"
        >
          تقديم طلب انضمام
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

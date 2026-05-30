import { useEffect } from "react";
import { useLocation } from "wouter";
import { useGetSubAgentMe, useGetSubAgentTiers, getGetSubAgentMeQueryKey } from "@workspace/api-client-react";
import { Loader2, ShieldCheck, ChevronLeft } from "lucide-react";
import { useT, useLang, setLang } from "@/lib/i18n";

function LangToggle() {
  const [lang] = useLang();
  const next = lang === "ar" ? "en" : "ar";
  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      className="text-xs font-bold px-2.5 py-1 rounded-md border border-primary/30 text-primary-foreground/80 hover:bg-white/10 transition"
    >
      {lang === "ar" ? "EN" : "ع"}
    </button>
  );
}

export default function LandingRouter() {
  const t = useT();
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
    if (me?.status === "pending") {
      setLocation("/pending");
    } else if (me?.status === "approved") {
      setLocation("/dashboard");
    } else if (me?.status === "rejected") {
      setLocation("/rejected");
    } else if (me?.status === "suspended") {
      setLocation("/suspended");
    }
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
        <div className="absolute top-4 right-4">
          <LangToggle />
        </div>
        <div className="relative z-10 space-y-3">
          <ShieldCheck className="w-14 h-14 text-secondary mx-auto" />
          <div className="font-orbitron text-3xl font-black tracking-wide">SOUQRATES</div>
          <h1 className="text-xl font-bold opacity-90">{t("landing.heroTitle")}</h1>
          <p className="text-primary-foreground/75 max-w-sm mx-auto text-sm leading-relaxed">
            {t("landing.heroDesc")}
          </p>
        </div>
      </div>

      <div className="px-4 py-8 space-y-8 flex-1">
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-center">{t("landing.tiersTitle")}</h2>
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
                      {t("landing.tierDiscount", { rate: (parseFloat(tier.discountRate) * 100).toFixed(1) })}
                    </p>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground flex flex-col items-end">
                  <span>{t("landing.tierSales", { n: tier.minSalesSkz })}</span>
                  <span>{t("landing.tierCustomers", { n: tier.minCustomers })}</span>
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
          {t("landing.applyBtn")}
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

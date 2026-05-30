import { useEffect } from "react";
import { useLocation } from "wouter";
import { useGetSubAgentMe, getGetSubAgentMeQueryKey } from "@workspace/api-client-react";
import { Clock, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n";

export default function PendingPage() {
  const t = useT();
  const [, setLocation] = useLocation();
  const { data: me, isLoading } = useGetSubAgentMe({
    query: {
      refetchInterval: 15000,
      queryKey: getGetSubAgentMeQueryKey(),
    }
  });

  useEffect(() => {
    if (!isLoading && me) {
      if (me.status === "approved") setLocation("/dashboard");
      else if (me.status === "rejected") setLocation("/rejected");
      else if (me.status === "suspended") setLocation("/suspended");
      else if (me.status === "not_applied") setLocation("/apply");
    }
  }, [me, isLoading, setLocation]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6 relative">
        <Clock className="w-12 h-12 text-primary absolute" />
        <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin opacity-50" />
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-3">{t("pending.title")}</h1>
      <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">
        {t("pending.desc")}
      </p>

      <div className="mt-12 flex items-center gap-2 text-xs text-muted-foreground/70">
        <Loader2 className="w-3 h-3 animate-spin" />
        {t("pending.autoRefresh")}
      </div>
    </div>
  );
}

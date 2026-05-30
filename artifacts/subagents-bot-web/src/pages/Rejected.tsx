import { useLocation } from "wouter";
import { useGetSubAgentMe } from "@workspace/api-client-react";
import { XCircle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

export default function RejectedPage() {
  const t = useT();
  const [, setLocation] = useLocation();
  const { data: me } = useGetSubAgentMe();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="w-24 h-24 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
        <XCircle className="w-12 h-12 text-destructive" />
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-3">{t("rejected.title")}</h1>

      <div className="bg-card border border-destructive/20 rounded-xl p-4 w-full max-w-sm mb-8 shadow-sm">
        <p className="text-sm font-medium text-destructive mb-1">{t("rejected.reasonLabel")}</p>
        <p className="text-sm text-foreground">
          {me?.agent?.rejectedReason || t("rejected.noReason")}
        </p>
      </div>

      <Button
        onClick={() => setLocation("/apply")}
        className="w-full max-w-sm h-12 gap-2 font-bold"
      >
        <RefreshCcw className="w-5 h-5" />
        {t("rejected.reapplyBtn")}
      </Button>
    </div>
  );
}

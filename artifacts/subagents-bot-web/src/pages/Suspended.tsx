import { AlertOctagon } from "lucide-react";
import { useT } from "@/lib/i18n";

export default function SuspendedPage() {
  const t = useT();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="w-24 h-24 bg-amber-500/10 rounded-full flex items-center justify-center mb-6">
        <AlertOctagon className="w-12 h-12 text-amber-500" />
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-3">{t("suspended.title")}</h1>
      <p className="text-muted-foreground text-sm max-w-xs leading-relaxed mb-8">
        {t("suspended.desc")}
      </p>

      <a
        href="https://t.me/souqrates_support"
        target="_blank"
        rel="noreferrer"
        className="text-primary font-bold text-sm hover:underline"
      >
        {t("suspended.contactBtn")}
      </a>
    </div>
  );
}

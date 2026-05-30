import { useState } from "react";
import { useLocation } from "wouter";
import { useSellSubAgent, useGetSubAgentMe, getGetSubAgentMeQueryKey, getGetSubAgentSalesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Send, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

export default function SellPage() {
  const t = useT();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const sellMutation = useSellSubAgent();
  const { data: me } = useGetSubAgentMe();

  const [form, setForm] = useState({
    customerTelegramId: "",
    skzAmount: "",
    note: "",
  });

  const [successData, setSuccessData] = useState<{
    soldSkz: number;
    agentBalanceSkz?: string;
    totalSalesSkz?: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerTelegramId || !form.skzAmount) return;

    const amount = parseFloat(form.skzAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t("sell.err.invalidAmount"));
      return;
    }

    try {
      const res = await sellMutation.mutateAsync({
        data: {
          customerTelegramId: form.customerTelegramId,
          skzAmount: amount,
          note: form.note || undefined,
        }
      });

      queryClient.invalidateQueries({ queryKey: getGetSubAgentMeQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetSubAgentSalesQueryKey() });

      setSuccessData(res as typeof successData);
      toast.success(t("sell.toast.success"));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : undefined;
      toast.error(msg || t("sell.err.generic"));
    }
  };

  if (successData) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="w-12 h-12 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">{t("sell.success.title")}</h1>
        <p className="text-muted-foreground mb-8">
          {t("sell.success.desc", { n: successData.soldSkz })}
        </p>

        <div className="w-full max-w-sm bg-card border rounded-xl p-5 space-y-3 mb-8 shadow-sm text-right">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("sell.success.remaining")}</span>
            <span className="font-bold" dir="ltr">
              {parseFloat(successData.agentBalanceSkz || "0").toLocaleString()} SKZ
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("sell.success.totalSales")}</span>
            <span className="font-bold" dir="ltr">
              {parseFloat(successData.totalSalesSkz || "0").toLocaleString()} SKZ
            </span>
          </div>
        </div>

        <Button
          onClick={() => setLocation("/dashboard")}
          className="w-full max-w-sm h-12 font-bold"
        >
          {t("sell.success.backBtn")}
        </Button>
      </div>
    );
  }

  const balance = parseFloat(me?.wallet?.balanceSkz || "0");

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="bg-card border-b p-4 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <button
          onClick={() => setLocation("/dashboard")}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-accent transition-colors"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold flex items-center gap-2">
          <Send className="w-5 h-5 text-primary" />
          {t("sell.title")}
        </h1>
      </div>

      <div className="p-4 flex-1">
        <div className="bg-primary text-primary-foreground p-5 rounded-2xl mb-6 shadow-sm">
          <p className="text-sm opacity-90 mb-1">{t("sell.balanceLabel")}</p>
          <h2 className="text-3xl font-bold font-orbitron" dir="ltr">
            {balance.toLocaleString()} <span className="text-lg font-medium">SKZ</span>
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 bg-card p-5 rounded-2xl border shadow-sm">
          <div>
            <label className="block text-sm font-medium mb-1.5">{t("sell.customerIdLabel")}</label>
            <input
              required
              type="number"
              dir="ltr"
              placeholder="123456789"
              className="w-full bg-background border border-input rounded-lg h-12 px-3 outline-none focus:ring-2 focus:ring-primary/20 text-left font-mono"
              value={form.customerTelegramId}
              onChange={e => setForm({ ...form, customerTelegramId: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1.5">{t("sell.customerIdHint")}</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">{t("sell.amountLabel")}</label>
            <input
              required
              type="number"
              dir="ltr"
              step="any"
              min="0.1"
              max={balance}
              placeholder="0.00"
              className="w-full bg-background border border-input rounded-lg h-12 px-3 outline-none focus:ring-2 focus:ring-primary/20 text-left font-mono text-lg"
              value={form.skzAmount}
              onChange={e => setForm({ ...form, skzAmount: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">{t("sell.noteLabel")}</label>
            <input
              type="text"
              maxLength={200}
              placeholder={t("sell.notePh")}
              className="w-full bg-background border border-input rounded-lg h-12 px-3 outline-none focus:ring-2 focus:ring-primary/20"
              value={form.note}
              onChange={e => setForm({ ...form, note: e.target.value })}
            />
          </div>

          <div className="pt-4">
            <Button
              type="submit"
              className="w-full h-12 text-base font-bold bg-secondary text-secondary-foreground hover:bg-secondary/90 gap-2"
              disabled={sellMutation.isPending || !form.customerTelegramId || !form.skzAmount}
            >
              {sellMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {t("sell.confirmBtn")}
                  <Send className="w-4 h-4 rtl:rotate-180" />
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

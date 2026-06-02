import { useState } from "react";
import { useLocation } from "wouter";
import { useApplySubAgent } from "@workspace/api-client-react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

export default function ApplyPage() {
  const t = useT();
  const [, setLocation] = useLocation();
  const applyMutation = useApplySubAgent();

  const [form, setForm] = useState({
    fullName: "",
    dob: "",
    country: "",
    phone: "",
    email: "",
    address: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.dob || !form.country || !form.phone || !form.address) {
      toast.error(t("apply.err.required"));
      return;
    }

    try {
      await applyMutation.mutateAsync({
        data: {
          ...form,
          idPhotoPath: "",
        }
      });
      toast.success(t("apply.success"));
      setLocation("/pending");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : undefined;
      toast.error(msg || t("apply.err.generic"));
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <div className="bg-primary text-primary-foreground p-6 pt-12 pb-8 rounded-b-3xl shadow-sm mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="text-secondary" />
          {t("apply.title")}
        </h1>
        <p className="text-primary-foreground/80 text-sm mt-2">
          {t("apply.subtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="px-4 space-y-5">
        <div className="space-y-4 bg-card p-5 rounded-2xl border shadow-sm">
          <div>
            <label className="block text-sm font-medium mb-1.5">{t("apply.fullName")}</label>
            <input
              required minLength={2} maxLength={120}
              type="text"
              className="w-full bg-background border border-input rounded-lg h-11 px-3 outline-none focus:ring-2 focus:ring-primary/20"
              value={form.fullName}
              onChange={e => setForm({ ...form, fullName: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">{t("apply.dob")}</label>
            <input
              required
              type="date"
              className="w-full bg-background border border-input rounded-lg h-11 px-3 outline-none focus:ring-2 focus:ring-primary/20"
              value={form.dob}
              onChange={e => setForm({ ...form, dob: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">{t("apply.country")}</label>
            <input
              required minLength={2} maxLength={80}
              type="text"
              className="w-full bg-background border border-input rounded-lg h-11 px-3 outline-none focus:ring-2 focus:ring-primary/20"
              value={form.country}
              onChange={e => setForm({ ...form, country: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">{t("apply.phone")}</label>
            <input
              required minLength={5} maxLength={40}
              type="tel"
              dir="ltr"
              placeholder="+971501234567"
              className="w-full bg-background border border-input rounded-lg h-11 px-3 outline-none focus:ring-2 focus:ring-primary/20 text-left"
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">{t("apply.email")}</label>
            <input
              type="email"
              dir="ltr"
              className="w-full bg-background border border-input rounded-lg h-11 px-3 outline-none focus:ring-2 focus:ring-primary/20 text-left"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">{t("apply.address")}</label>
            <textarea
              required minLength={5} maxLength={500} rows={3}
              className="w-full bg-background border border-input rounded-lg py-2 px-3 outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })}
            />
          </div>
        </div>

        <div className="pt-4 pb-8">
          <Button
            type="submit"
            className="w-full h-12 text-base font-bold bg-secondary text-secondary-foreground hover:bg-secondary/90"
            disabled={applyMutation.isPending}
          >
            {applyMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : t("apply.submitBtn")}
          </Button>
        </div>
      </form>
    </div>
  );
}

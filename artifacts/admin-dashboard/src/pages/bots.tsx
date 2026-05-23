import { useState } from "react";
import { useListBots, useCreateBot, getListBotsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Bot as BotIcon, Activity, Percent, Key, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState as useLocalState } from "react";

const BOT_ICONS: Record<string, string> = {
  games: "🎮", video: "🎬", voice: "🎙️", ai: "🤖", store: "🛒", contests: "🏆",
};

function CopyKey({ apiKey }: { apiKey: string }) {
  const [copied, setCopied] = useLocalState(false);
  const short = `${apiKey.slice(0, 8)}...${apiKey.slice(-6)}`;
  return (
    <button
      className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
      onClick={() => {
        navigator.clipboard.writeText(apiKey).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      title="نسخ مفتاح API"
    >
      <Key className="w-3 h-3" />
      {short}
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

export default function Bots() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", slug: "", commissionRate: "0.1" });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: botsList, isLoading } = useListBots();
  const createBot = useCreateBot();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createBot.mutate({ data: formData }, {
      onSuccess: () => {
        toast({ title: "✓ تم تسجيل البوت بنجاح" });
        setIsDialogOpen(false);
        setFormData({ name: "", slug: "", commissionRate: "0.1" });
        queryClient.invalidateQueries({ queryKey: getListBotsQueryKey() });
      },
      onError: (err: any) => {
        toast({
          title: "فشل تسجيل البوت",
          description: err.error ?? "حدث خطأ غير متوقع",
          variant: "destructive",
        });
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">البوتات الفرعية</h1>
          <p className="text-sm text-muted-foreground mt-0.5">إدارة البوتات المسجّلة ونسب عمولاتها</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              تسجيل بوت
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>تسجيل بوت فرعي</DialogTitle>
                <DialogDescription>
                  أضف بوتاً جديداً إلى شبكة البوت الأم. سيتم إنشاء مفتاح API تلقائياً.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="name">اسم البوت</Label>
                  <Input
                    id="name"
                    placeholder="مثال: بوت الألعاب"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    dir="rtl"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="slug">المعرّف (Slug)</Label>
                  <Input
                    id="slug"
                    placeholder="مثال: games_bot"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
                    required
                    dir="ltr"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="commission">نسبة العمولة (0 ← 1)</Label>
                  <Input
                    id="commission"
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={formData.commissionRate}
                    onChange={(e) => setFormData({ ...formData, commissionRate: e.target.value })}
                    required
                    dir="ltr"
                  />
                  <p className="text-xs text-muted-foreground">0.10 = عمولة 10% على جميع المعاملات</p>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                <Button type="submit" disabled={createBot.isPending}>
                  {createBot.isPending ? "جارٍ التسجيل..." : "تسجيل البوت"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Bots grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <Skeleton className="h-5 w-32 mb-1.5" />
                  <Skeleton className="h-3.5 w-20" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, j) => (
                      <div key={j} className="flex justify-between">
                        <Skeleton className="h-3.5 w-20" />
                        <Skeleton className="h-3.5 w-16" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          : botsList?.data.length === 0
          ? (
            <div className="col-span-full py-16 text-center rounded-xl border border-dashed border-border/60 text-muted-foreground">
              <BotIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">لا توجد بوتات مسجّلة</p>
              <p className="text-sm mt-1 opacity-70">انقر "تسجيل بوت" لإضافة أول بوت فرعي</p>
            </div>
          )
          : botsList?.data.map((bot) => {
            const icon = BOT_ICONS[bot.slug.replace(/-bot$|_bot$/i, "")] ?? "🤖";
            return (
              <Card key={bot.id} className="overflow-hidden group hover:border-primary/40 transition-all duration-200">
                <div className={`h-0.5 w-full ${bot.isActive ? "bg-gradient-to-r from-violet-500 to-indigo-500" : "bg-muted"}`} />
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-muted/60 flex items-center justify-center text-xl">
                        {icon}
                      </div>
                      <div>
                        <CardTitle className="text-sm font-bold group-hover:text-primary transition-colors">
                          {bot.name}
                        </CardTitle>
                        <CardDescription className="font-mono text-xs mt-0.5">{bot.slug}</CardDescription>
                      </div>
                    </div>
                    {bot.isActive
                      ? <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">نشط</Badge>
                      : <Badge variant="secondary" className="text-xs">معطّل</Badge>
                    }
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg bg-muted/30 border border-border/40 p-3 space-y-2.5">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Percent className="w-3 h-3" /> العمولة
                      </div>
                      <span className="font-mono font-bold text-sm text-primary">
                        {(parseFloat(bot.commissionRate) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Activity className="w-3 h-3" /> حجم التداول
                      </div>
                      <span className="font-mono text-sm">{formatCurrency(bot.totalVolumeUsdt, "usdt")}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-border/40">
                      <span className="text-xs text-muted-foreground">إجمالي الأرباح</span>
                      <span className="font-mono font-medium text-sm text-primary">
                        {formatCurrency(bot.totalCommissionUsdt, "usdt")}
                      </span>
                    </div>
                  </div>
                  {bot.apiKey && (
                    <div className="mt-2.5 pt-2.5 border-t border-border/40">
                      <CopyKey apiKey={bot.apiKey} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        }
      </div>
    </div>
  );
}

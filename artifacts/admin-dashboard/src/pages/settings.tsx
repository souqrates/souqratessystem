import { useState, useEffect } from "react";
import { useGetAllSettings, useUpdateSettings, useListBots, useUpdateBot } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Zap,
  DollarSign,
  FileText,
  Bot,
  Save,
  CheckCircle,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

function SavedBadge({ saved }: { saved: boolean | null }) {
  if (saved === null) return null;
  return saved ? (
    <span className="flex items-center gap-1 text-xs text-green-400 font-medium">
      <CheckCircle size={12} /> تم الحفظ
    </span>
  ) : (
    <span className="flex items-center gap-1 text-xs text-red-400 font-medium">
      <AlertCircle size={12} /> فشل الحفظ
    </span>
  );
}

function FieldRow({
  label,
  description,
  value,
  onChange,
  type = "text",
  suffix,
  dir = "ltr",
}: {
  label: string;
  description?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  suffix?: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        {description && <span className="text-[11px] text-muted-foreground">{description}</span>}
      </div>
      <div className="relative">
        <Input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          dir={dir}
          className="bg-muted/30 border-border/60"
        />
        {suffix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

export default function Settings() {
  const { data: settings, isLoading: settingsLoading, refetch } = useGetAllSettings();
  const { data: botsData, isLoading: botsLoading } = useListBots();
  const updateSettings = useUpdateSettings();
  const updateBot = useUpdateBot();

  // SKZ Rates state
  const [skz, setSkz] = useState({ perUsdt: "", perStar: "", perTon: "" });
  // Financial state
  const [financial, setFinancial] = useState({
    minDepositUsdt: "", minDepositTon: "", minDepositStars: "",
    minWithdrawalSkz: "", withdrawalFeeUsdtPercent: "", withdrawalFeeTonPercent: "",
    referralBonusPercent: "",
  });
  // Content state
  const [content, setContent] = useState({
    platformName: "", platformTagline: "", welcomeMessage: "",
    supportUsername: "", referralMessage: "",
  });
  // Bot commissions
  const [commissions, setCommissions] = useState<Record<string, { rate: string; active: boolean }>>({});

  // Save states
  const [skzSaved, setSkzSaved] = useState<boolean | null>(null);
  const [financialSaved, setFinancialSaved] = useState<boolean | null>(null);
  const [contentSaved, setContentSaved] = useState<boolean | null>(null);
  const [botSaved, setBotSaved] = useState<Record<string, boolean | null>>({});

  // Populate from API
  useEffect(() => {
    if (!settings) return;
    setSkz({
      perUsdt: settings.skzRates.skzPerUsdt,
      perStar: settings.skzRates.skzPerStar,
      perTon: settings.skzRates.skzPerTon,
    });
    setFinancial({
      minDepositUsdt: settings.financial.minDepositUsdt,
      minDepositTon: settings.financial.minDepositTon,
      minDepositStars: settings.financial.minDepositStars,
      minWithdrawalSkz: settings.financial.minWithdrawalSkz,
      withdrawalFeeUsdtPercent: settings.financial.withdrawalFeeUsdtPercent,
      withdrawalFeeTonPercent: settings.financial.withdrawalFeeTonPercent,
      referralBonusPercent: settings.financial.referralBonusPercent,
    });
    setContent({
      platformName: settings.content.platformName,
      platformTagline: settings.content.platformTagline,
      welcomeMessage: settings.content.welcomeMessage,
      supportUsername: settings.content.supportUsername,
      referralMessage: settings.content.referralMessage,
    });
  }, [settings]);

  useEffect(() => {
    if (!botsData?.data) return;
    const map: Record<string, { rate: string; active: boolean }> = {};
    for (const bot of botsData.data) {
      map[bot.slug] = {
        rate: String(Math.round(parseFloat(String(bot.commissionRate)) * 100)),
        active: bot.isActive,
      };
    }
    setCommissions(map);
  }, [botsData]);

  const handleSaveSection = async (section: "skz" | "financial" | "content") => {
    let payload: Record<string, string> = {};
    if (section === "skz") {
      payload = { skzPerUsdt: skz.perUsdt, skzPerStar: skz.perStar, skzPerTon: skz.perTon };
    } else if (section === "financial") {
      payload = {
        minDepositUsdt: financial.minDepositUsdt,
        minDepositTon: financial.minDepositTon,
        minDepositStars: financial.minDepositStars,
        minWithdrawalSkz: financial.minWithdrawalSkz,
        withdrawalFeeUsdtPercent: financial.withdrawalFeeUsdtPercent,
        withdrawalFeeTonPercent: financial.withdrawalFeeTonPercent,
        referralBonusPercent: financial.referralBonusPercent,
      };
    } else {
      payload = {
        platformName: content.platformName,
        platformTagline: content.platformTagline,
        welcomeMessage: content.welcomeMessage,
        supportUsername: content.supportUsername,
        referralMessage: content.referralMessage,
      };
    }

    try {
      await updateSettings.mutateAsync({ data: payload });
      await refetch();
      if (section === "skz") { setSkzSaved(true); setTimeout(() => setSkzSaved(null), 3000); }
      else if (section === "financial") { setFinancialSaved(true); setTimeout(() => setFinancialSaved(null), 3000); }
      else { setContentSaved(true); setTimeout(() => setContentSaved(null), 3000); }
    } catch {
      if (section === "skz") { setSkzSaved(false); setTimeout(() => setSkzSaved(null), 3000); }
      else if (section === "financial") { setFinancialSaved(false); setTimeout(() => setFinancialSaved(null), 3000); }
      else { setContentSaved(false); setTimeout(() => setContentSaved(null), 3000); }
    }
  };

  const handleSaveBot = async (slug: string) => {
    const botData = commissions[slug];
    if (!botData) return;
    const rateDecimal = (parseFloat(botData.rate) / 100).toFixed(4);
    try {
      await updateBot.mutateAsync({ slug, data: { commissionRate: rateDecimal, isActive: botData.active } });
      setBotSaved((prev) => ({ ...prev, [slug]: true }));
      setTimeout(() => setBotSaved((prev) => ({ ...prev, [slug]: null })), 3000);
    } catch {
      setBotSaved((prev) => ({ ...prev, [slug]: false }));
      setTimeout(() => setBotSaved((prev) => ({ ...prev, [slug]: null })), 3000);
    }
  };

  if (settingsLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">الإعدادات</h1>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-40 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">الإعدادات</h1>
          <p className="text-sm text-muted-foreground mt-1">
            جميع التعديلات تنعكس فوراً على البوتات
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw size={14} />
          تحديث
        </Button>
      </div>

      <Tabs defaultValue="skz">
        <TabsList className="w-full grid grid-cols-4 mb-6">
          <TabsTrigger value="skz" className="gap-2 text-xs sm:text-sm">
            <Zap size={14} /> معدلات SKZ
          </TabsTrigger>
          <TabsTrigger value="financial" className="gap-2 text-xs sm:text-sm">
            <DollarSign size={14} /> الحدود والرسوم
          </TabsTrigger>
          <TabsTrigger value="bots" className="gap-2 text-xs sm:text-sm">
            <Bot size={14} /> عمولات البوتات
          </TabsTrigger>
          <TabsTrigger value="content" className="gap-2 text-xs sm:text-sm">
            <FileText size={14} /> النصوص
          </TabsTrigger>
        </TabsList>

        {/* SKZ RATES TAB */}
        <TabsContent value="skz">
          <Card className="border-purple-500/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-purple-400" />
                  <CardTitle>معدلات صرف SKZ</CardTitle>
                </div>
                <SavedBadge saved={skzSaved} />
              </div>
              <CardDescription>
                كم وحدة SKZ تعادل كل عملة حقيقية. تتأثر جميع عمليات الإيداع فوراً.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-5 sm:grid-cols-3">
                <FieldRow
                  label="1 USDT = ? SKZ"
                  description="دولار تيثر"
                  value={skz.perUsdt}
                  onChange={(v) => setSkz((p) => ({ ...p, perUsdt: v }))}
                  type="number"
                  suffix="SKZ"
                />
                <FieldRow
                  label="1 Star ⭐ = ? SKZ"
                  description="نجمة تيليغرام"
                  value={skz.perStar}
                  onChange={(v) => setSkz((p) => ({ ...p, perStar: v }))}
                  type="number"
                  suffix="SKZ"
                />
                <FieldRow
                  label="1 TON = ? SKZ"
                  description="تون كوين"
                  value={skz.perTon}
                  onChange={(v) => setSkz((p) => ({ ...p, perTon: v }))}
                  type="number"
                  suffix="SKZ"
                />
              </div>

              {/* Live preview */}
              <div className="rounded-xl bg-purple-950/20 border border-purple-500/10 p-4">
                <p className="text-xs font-bold text-purple-300 mb-3">معاينة مباشرة — ماذا سيحصل المستخدم؟</p>
                <div className="grid grid-cols-3 gap-3 text-center text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">10 USDT =</p>
                    <p className="font-black text-purple-400">{(10 * (parseFloat(skz.perUsdt) || 0)).toLocaleString()} SKZ</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">100 Stars =</p>
                    <p className="font-black text-yellow-400">{(100 * (parseFloat(skz.perStar) || 0)).toLocaleString()} SKZ</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">1 TON =</p>
                    <p className="font-black text-blue-400">{(1 * (parseFloat(skz.perTon) || 0)).toLocaleString()} SKZ</p>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => handleSaveSection("skz")}
                disabled={updateSettings.isPending}
                className="gap-2 bg-purple-600 hover:bg-purple-700"
              >
                <Save size={14} />
                {updateSettings.isPending ? "جاري الحفظ..." : "حفظ معدلات SKZ"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FINANCIAL TAB */}
        <TabsContent value="financial">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-400" />
                  <CardTitle>الحدود الدنيا والرسوم</CardTitle>
                </div>
                <SavedBadge saved={financialSaved} />
              </div>
              <CardDescription>
                حدود الإيداع والسحب ورسوم الشبكة ونسبة الإحالة.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">حدود الإيداع الدنيا</p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <FieldRow label="أقل إيداع USDT" value={financial.minDepositUsdt} onChange={(v) => setFinancial((p) => ({ ...p, minDepositUsdt: v }))} type="number" suffix="USDT" />
                  <FieldRow label="أقل إيداع TON" value={financial.minDepositTon} onChange={(v) => setFinancial((p) => ({ ...p, minDepositTon: v }))} type="number" suffix="TON" />
                  <FieldRow label="أقل إيداع Stars" value={financial.minDepositStars} onChange={(v) => setFinancial((p) => ({ ...p, minDepositStars: v }))} type="number" suffix="⭐" />
                </div>
              </div>

              <div className="h-px bg-border" />

              <div>
                <p className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">السحب والرسوم</p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <FieldRow label="أقل سحب" value={financial.minWithdrawalSkz} onChange={(v) => setFinancial((p) => ({ ...p, minWithdrawalSkz: v }))} type="number" suffix="SKZ" />
                  <FieldRow label="رسوم السحب USDT" value={financial.withdrawalFeeUsdtPercent} onChange={(v) => setFinancial((p) => ({ ...p, withdrawalFeeUsdtPercent: v }))} type="number" suffix="%" />
                  <FieldRow label="رسوم السحب TON" value={financial.withdrawalFeeTonPercent} onChange={(v) => setFinancial((p) => ({ ...p, withdrawalFeeTonPercent: v }))} type="number" suffix="%" />
                </div>
              </div>

              <div className="h-px bg-border" />

              <div>
                <p className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">نظام الإحالة</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldRow label="نسبة عمولة الإحالة" description="من أرباح الصديق المُحال" value={financial.referralBonusPercent} onChange={(v) => setFinancial((p) => ({ ...p, referralBonusPercent: v }))} type="number" suffix="%" />
                </div>
              </div>

              <Button onClick={() => handleSaveSection("financial")} disabled={updateSettings.isPending} className="gap-2">
                <Save size={14} />
                {updateSettings.isPending ? "جاري الحفظ..." : "حفظ الإعدادات المالية"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* BOTS COMMISSIONS TAB */}
        <TabsContent value="bots">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary" />
                <CardTitle>عمولات البوتات الفرعية</CardTitle>
              </div>
              <CardDescription>
                نسبة العمولة التي تقتطعها المنصة من كل عملية كسب في البوت. يُحدَّث فوراً.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {botsLoading ? (
                <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
              ) : (
                <div className="space-y-3">
                  {botsData?.data.map((bot) => {
                    const c = commissions[bot.slug] ?? { rate: "10", active: true };
                    return (
                      <div key={bot.slug} className="flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-muted/10">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-sm">{bot.name}</p>
                            <Badge variant={c.active ? "default" : "secondary"} className="text-[10px]">
                              {c.active ? "نشط" : "متوقف"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{bot.slug}</p>
                        </div>

                        <div className="flex items-center gap-3">
                          <Switch
                            checked={c.active}
                            onCheckedChange={(val) =>
                              setCommissions((p) => ({ ...p, [bot.slug]: { ...c, active: val } }))
                            }
                          />
                          <div className="relative w-24">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={c.rate}
                              onChange={(e) =>
                                setCommissions((p) => ({ ...p, [bot.slug]: { ...c, rate: e.target.value } }))
                              }
                              className="pr-7 text-right bg-muted/30 text-sm h-9"
                            />
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleSaveBot(bot.slug)}
                            disabled={updateBot.isPending}
                            className="gap-1.5 h-9"
                            variant={botSaved[bot.slug] === true ? "outline" : "default"}
                          >
                            {botSaved[bot.slug] === true ? (
                              <><CheckCircle size={12} className="text-green-400" /> تم</>
                            ) : (
                              <><Save size={12} /> حفظ</>
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONTENT TAB */}
        <TabsContent value="content">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-400" />
                  <CardTitle>نصوص المنصة</CardTitle>
                </div>
                <SavedBadge saved={contentSaved} />
              </div>
              <CardDescription>
                النصوص التي يراها المستخدمون داخل البوت — تُحدَّث فوراً.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldRow
                  label="اسم المنصة"
                  value={content.platformName}
                  onChange={(v) => setContent((p) => ({ ...p, platformName: v }))}
                  dir="rtl"
                />
                <FieldRow
                  label="شعار المنصة (Tagline)"
                  value={content.platformTagline}
                  onChange={(v) => setContent((p) => ({ ...p, platformTagline: v }))}
                  dir="rtl"
                />
              </div>

              <FieldRow
                label="اسم مستخدم الدعم"
                description="بدون @ في البداية"
                value={content.supportUsername}
                onChange={(v) => setContent((p) => ({ ...p, supportUsername: v }))}
              />

              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium">رسالة الترحيب</Label>
                <p className="text-[11px] text-muted-foreground">تُرسل للمستخدم عند بدء البوت</p>
                <Textarea
                  value={content.welcomeMessage}
                  onChange={(e) => setContent((p) => ({ ...p, welcomeMessage: e.target.value }))}
                  rows={3}
                  dir="rtl"
                  className="bg-muted/30 border-border/60 resize-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium">نص دعوة الإحالة</Label>
                <p className="text-[11px] text-muted-foreground">يُشارَك عند الضغط على "مشاركة الرابط"</p>
                <Textarea
                  value={content.referralMessage}
                  onChange={(e) => setContent((p) => ({ ...p, referralMessage: e.target.value }))}
                  rows={3}
                  dir="rtl"
                  className="bg-muted/30 border-border/60 resize-none"
                />
              </div>

              <Button onClick={() => handleSaveSection("content")} disabled={updateSettings.isPending} className="gap-2">
                <Save size={14} />
                {updateSettings.isPending ? "جاري الحفظ..." : "حفظ النصوص"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

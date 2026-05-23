import { useGetStatsOverview, useGetAllSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { Users, Percent, ArrowUpFromLine, Bot, Zap, TrendingUp, TrendingDown, RefreshCw, Activity, DollarSign, Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  trendLabel,
  gradient,
  isLoading,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  gradient: string;
  isLoading: boolean;
}) {
  return (
    <Card className={`metric-card relative overflow-hidden border-white/[0.06] ${gradient}`}>
      <div className="absolute inset-0 noise-bg pointer-events-none" />
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs font-medium text-muted-foreground/80 tracking-wide">{label}</p>
          <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center flex-shrink-0">
            <Icon size={15} className="text-white/60" />
          </div>
        </div>
        {isLoading ? (
          <Skeleton className="h-9 w-32 mb-1" />
        ) : (
          <p className="text-3xl font-black tracking-tight text-foreground/95 mb-1 font-mono">
            {value}
          </p>
        )}
        <div className="flex items-center gap-2">
          {sub && !isLoading && (
            <span className="text-xs text-muted-foreground/60">{sub}</span>
          )}
          {trend && trendLabel && !isLoading && (
            <span className={`flex items-center gap-0.5 text-xs font-medium ${
              trend === "up" ? "text-emerald-400" : trend === "down" ? "text-rose-400" : "text-muted-foreground"
            }`}>
              {trend === "up" ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {trendLabel}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RateRow({ label, sub, value, isLoading }: { label: string; sub: string; value?: string; isLoading: boolean }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0 group">
      <div>
        <p className="text-sm font-medium text-foreground/90">{label}</p>
        <p className="text-xs text-muted-foreground/60 mt-0.5">{sub}</p>
      </div>
      {isLoading ? (
        <Skeleton className="h-5 w-20" />
      ) : (
        <div className="flex items-center gap-1.5 bg-violet-500/10 rounded-lg px-3 py-1.5 border border-violet-500/15">
          <Zap size={10} className="text-violet-400" />
          <span className="font-bold text-sm text-violet-300">{value ?? "—"}</span>
          <span className="text-[10px] text-violet-400/60 font-medium">SKZ</span>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading } = useGetStatsOverview();
  const { data: settings } = useGetAllSettings();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setTimeout(() => setRefreshing(false), 800);
  };

  const platformName = settings?.content?.platformName ?? "البوت الأم";

  return (
    <div className="space-y-7 max-w-7xl">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-violet-400/80 bg-violet-500/10 rounded-full px-2.5 py-0.5 border border-violet-500/15">
              {platformName}
            </span>
            <span className="w-1 h-1 rounded-full bg-emerald-400 pulse-soft" />
            <span className="text-xs text-muted-foreground/60">مباشر</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            نظرة عامة
          </h1>
          <p className="text-sm text-muted-foreground/70 mt-0.5">
            العملة الأساسية:{" "}
            <span className="gradient-text-violet font-bold">SKZ</span>
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 text-xs text-muted-foreground/60 hover:text-foreground transition-colors bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-lg px-3 py-2"
        >
          <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
          تحديث
        </button>
      </div>

      {/* Primary KPI grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="حجم SKZ الإجمالي"
          value={`${Number(stats?.totalVolumeSkz || 0).toLocaleString()}`}
          sub={`≈ $${(Number(stats?.totalVolumeSkz || 0) / Number(stats?.skzRates?.skzPerUsdt || 100)).toFixed(0)} USDT`}
          icon={Zap}
          gradient="bg-gradient-to-br from-violet-950/60 to-card"
          isLoading={isLoading}
        />
        <StatCard
          label="إجمالي المستخدمين"
          value={`${(stats?.totalUsers || 0).toLocaleString()}`}
          icon={Users}
          gradient="bg-gradient-to-br from-sky-950/50 to-card"
          isLoading={isLoading}
        />
        <StatCard
          label="عمولات المنصة"
          value={`${Number(stats?.totalCommissionsSkz || 0).toLocaleString()}`}
          sub={formatCurrency(stats?.totalCommissionsUsdt || "0", "usdt") + " USDT"}
          icon={Percent}
          gradient="bg-gradient-to-br from-amber-950/40 to-card"
          isLoading={isLoading}
        />
        <StatCard
          label="سحوبات معلقة"
          value={`${stats?.pendingWithdrawals || 0}`}
          sub={stats?.pendingWithdrawals ? "تحتاج مراجعة" : "لا يوجد"}
          icon={ArrowUpFromLine}
          trend={stats?.pendingWithdrawals ? "down" : "neutral"}
          trendLabel={stats?.pendingWithdrawals ? "معلق" : undefined}
          gradient="bg-gradient-to-br from-rose-950/40 to-card"
          isLoading={isLoading}
        />
      </div>

      {/* Second row */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* SKZ Exchange Rates */}
        <Card className="border-white/[0.06] bg-card overflow-hidden">
          <CardHeader className="pb-1 pt-5 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground/90">
                <div className="w-5 h-5 rounded-md bg-violet-500/20 flex items-center justify-center">
                  <Zap size={11} className="text-violet-400" />
                </div>
                معدلات صرف SKZ
              </CardTitle>
              <Link href="/settings" className="text-[10px] text-violet-400/70 hover:text-violet-400 transition-colors">
                تعديل →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <RateRow label="1 USDT" sub="دولار تيثر" value={stats?.skzRates?.skzPerUsdt} isLoading={isLoading} />
            <RateRow label="1 Star ⭐" sub="نجمة تيليغرام" value={stats?.skzRates?.skzPerStar} isLoading={isLoading} />
            <RateRow label="1 TON" sub="تون كوين" value={stats?.skzRates?.skzPerTon} isLoading={isLoading} />
            <p className="text-[10px] text-muted-foreground/40 mt-3">
              آخر تحديث يتم من الإعدادات ← معدلات SKZ
            </p>
          </CardContent>
        </Card>

        {/* Activity today */}
        <Card className="border-white/[0.06] bg-card overflow-hidden">
          <CardHeader className="pb-1 pt-5 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground/90">
              <div className="w-5 h-5 rounded-md bg-sky-500/20 flex items-center justify-center">
                <Activity size={11} className="text-sky-400" />
              </div>
              نشاط المنصة
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-0">
            {[
              { label: "معاملات اليوم", value: stats?.todayTransactions || 0, color: "text-foreground" },
              { label: "بوتات نشطة", value: stats?.activeBots || 0, color: "text-emerald-400" },
              { label: "حجم USDT الكلي", value: formatCurrency(stats?.totalVolumeUsdt || "0", "usdt"), color: "text-sky-400" },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0">
                <span className="text-sm text-muted-foreground/70">{item.label}</span>
                {isLoading ? (
                  <Skeleton className="h-5 w-16" />
                ) : (
                  <span className={`font-bold text-sm font-mono ${item.color}`}>{item.value}</span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Bots overview */}
        <Card className="border-white/[0.06] bg-card overflow-hidden">
          <CardHeader className="pb-1 pt-5 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground/90">
                <div className="w-5 h-5 rounded-md bg-blue-500/20 flex items-center justify-center">
                  <Bot size={11} className="text-blue-400" />
                </div>
                شبكة البوتات
              </CardTitle>
              <Link href="/bots" className="text-[10px] text-blue-400/70 hover:text-blue-400 transition-colors">
                إدارة →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {[
              { emoji: "🎮", name: "الألعاب", slug: "games-bot" },
              { emoji: "🎬", name: "الفيديو", slug: "video-bot" },
              { emoji: "🎙", name: "الصوت", slug: "voice-bot" },
              { emoji: "🤖", name: "الذكاء الاصطناعي", slug: "ai-bot" },
              { emoji: "🛒", name: "المتجر", slug: "store-bot" },
              { emoji: "🏆", name: "المسابقات", slug: "contests-bot" },
            ].map((bot) => (
              <div key={bot.slug} className="flex items-center gap-3 py-1.5">
                <span className="text-base">{bot.emoji}</span>
                <span className="text-sm text-foreground/80 flex-1">{bot.name}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Platform info / Architecture */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Financial overview */}
        <Card className="border-white/[0.06] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-950/20 via-transparent to-transparent pointer-events-none" />
          <CardHeader className="pb-2 pt-5 px-5 relative">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground/90">
              <div className="w-5 h-5 rounded-md bg-amber-500/20 flex items-center justify-center">
                <DollarSign size={11} className="text-amber-400" />
              </div>
              الإعدادات المالية الحالية
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 relative grid grid-cols-2 gap-3">
            {[
              { label: "أقل إيداع", value: `${settings?.financial?.minDepositUsdt ?? "5"} USDT`, color: "text-sky-400" },
              { label: "أقل سحب", value: `${settings?.financial?.minWithdrawalSkz ?? "100"} SKZ`, color: "text-violet-400" },
              { label: "رسوم USDT", value: `${settings?.financial?.withdrawalFeeUsdtPercent ?? "2"}%`, color: "text-amber-400" },
              { label: "عمولة الإحالة L1", value: `${settings?.financial?.referralBonusPercent ?? "5"}%`, color: "text-emerald-400" },
            ].map((item, i) => (
              <div key={i} className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-3">
                <p className="text-[11px] text-muted-foreground/60 mb-1">{item.label}</p>
                <p className={`text-lg font-black font-mono ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* SKZ Architecture */}
        <Card className="border-white/[0.06] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/20 via-transparent to-transparent pointer-events-none" />
          <CardHeader className="pb-2 pt-5 px-5 relative">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground/90">
              <div className="w-5 h-5 rounded-md bg-violet-500/20 flex items-center justify-center">
                <TrendingUp size={11} className="text-violet-400" />
              </div>
              معمارية SKZ
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 relative">
            <div className="flex items-start gap-0 mt-2">
              {[
                { step: "01", label: "الإيداع", desc: "USDT / Stars / TON", color: "bg-sky-500", textColor: "text-sky-400" },
                { step: "→", label: "", desc: "", color: "", textColor: "text-muted-foreground/30", isArrow: true },
                { step: "02", label: "تحويل SKZ", desc: "بالمعدل الحالي", color: "bg-violet-500", textColor: "text-violet-400" },
                { step: "→", label: "", desc: "", color: "", textColor: "text-muted-foreground/30", isArrow: true },
                { step: "03", label: "6 بوتات", desc: "تعمل بـ SKZ فقط", color: "bg-emerald-500", textColor: "text-emerald-400" },
              ].map((item, i) =>
                item.isArrow ? (
                  <div key={i} className="flex items-center justify-center w-8 pt-3 flex-shrink-0">
                    <span className="text-muted-foreground/30 text-lg">→</span>
                  </div>
                ) : (
                  <div key={i} className="flex-1 text-center">
                    <div className={`w-7 h-7 rounded-lg ${item.color}/20 border border-white/[0.06] flex items-center justify-center mx-auto mb-2`}>
                      <span className={`text-[10px] font-black ${item.textColor}`}>{item.step}</span>
                    </div>
                    <p className={`text-xs font-bold ${item.textColor} mb-1`}>{item.label}</p>
                    <p className="text-[10px] text-muted-foreground/50 leading-relaxed">{item.desc}</p>
                  </div>
                )
              )}
            </div>

            {/* Referral bonus info */}
            <div className="mt-5 rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Star size={12} className="text-emerald-400" />
                <p className="text-xs font-bold text-emerald-400">نظام الإحالة المتعدد</p>
              </div>
              <div className="flex items-center gap-3 text-center">
                {[
                  { level: "L1", pct: settings?.financial?.referralBonusPercent ?? "5", color: "text-emerald-400" },
                  { level: "L2", pct: settings?.financial?.referralL2Percent ?? "2", color: "text-sky-400" },
                  { level: "L3", pct: settings?.financial?.referralL3Percent ?? "1", color: "text-violet-400" },
                ].map((r) => (
                  <div key={r.level} className="flex-1">
                    <p className={`text-lg font-black ${r.color} font-mono`}>{r.pct}%</p>
                    <p className="text-[10px] text-muted-foreground/50">{r.level}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useGetStatsOverview } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { Users, Activity, Percent, ArrowUpFromLine, Bot, Zap, TrendingUp, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

function SkzRateCard({
  rate,
  label,
  sub,
  isLoading,
}: {
  rate: string | undefined;
  label: string;
  sub: string;
  isLoading: boolean;
}) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border/40 last:border-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
      {isLoading ? (
        <Skeleton className="h-5 w-20" />
      ) : (
        <span className="font-bold text-purple-400">{rate ?? "—"} SKZ</span>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading } = useGetStatsOverview();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setTimeout(() => setRefreshing(false), 800);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">نظرة عامة على المنصة</h1>
          <p className="text-sm text-muted-foreground mt-1">العملة الأساسية: <span className="text-purple-400 font-bold">SKZ</span></p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          تحديث
        </button>
      </div>

      {/* SKZ Primary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-purple-500/20 bg-gradient-to-br from-purple-950/30 to-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي حجم SKZ</CardTitle>
            <Zap className="w-4 h-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div>
                <div className="text-2xl font-bold text-purple-400">
                  {Number(stats?.totalVolumeSkz || 0).toLocaleString()} SKZ
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  ≈ ${(Number(stats?.totalVolumeSkz || 0) / Number(stats?.skzRates?.skzPerUsdt || 100)).toFixed(2)} USDT
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي المستخدمين</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{stats?.totalUsers.toLocaleString() || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-purple-500/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">عمولات SKZ</CardTitle>
            <Percent className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div>
                <div className="text-2xl font-bold text-purple-400">
                  {Number(stats?.totalCommissionsSkz || 0).toLocaleString()} SKZ
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  ≈ {formatCurrency(stats?.totalCommissionsUsdt || "0", "usdt")} USDT
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">طلبات سحب معلقة</CardTitle>
            <ArrowUpFromLine className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">
                {stats?.pendingWithdrawals || 0}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* SKZ Exchange Rates */}
        <Card className="border-purple-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-400" />
              معدلات صرف SKZ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <SkzRateCard
              rate={stats?.skzRates?.skzPerUsdt}
              label="1 USDT ="
              sub="دولار تيثر"
              isLoading={isLoading}
            />
            <SkzRateCard
              rate={stats?.skzRates?.skzPerStar}
              label="1 Star ⭐ ="
              sub="نجمة تيليغرام"
              isLoading={isLoading}
            />
            <SkzRateCard
              rate={stats?.skzRates?.skzPerTon}
              label="1 TON ="
              sub="تون كوين"
              isLoading={isLoading}
            />
            <p className="text-[10px] text-muted-foreground pt-2">
              يمكن تعديل المعدلات عبر API: PUT /api/settings/skz-rates
            </p>
          </CardContent>
        </Card>

        {/* Today */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              نشاط اليوم
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">عدد المعاملات</span>
              {isLoading ? (
                <Skeleton className="h-5 w-16" />
              ) : (
                <span className="font-bold">{stats?.todayTransactions || 0}</span>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">حجم USDT</span>
              {isLoading ? (
                <Skeleton className="h-5 w-24" />
              ) : (
                <span className="font-medium text-primary">{formatCurrency(stats?.totalVolumeUsdt || "0", "usdt")}</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Network */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Bot className="w-4 h-4 text-muted-foreground" />
              الشبكة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">البوتات الفرعية النشطة</span>
              {isLoading ? (
                <Skeleton className="h-5 w-12" />
              ) : (
                <span className="font-bold text-green-400">{stats?.activeBots || 0}</span>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">إجمالي حجم USDT</span>
              {isLoading ? (
                <Skeleton className="h-5 w-24" />
              ) : (
                <span className="font-medium">{formatCurrency(stats?.totalVolumeUsdt || "0", "usdt")}</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SKZ Architecture Info */}
      <Card className="border-purple-500/20 bg-purple-950/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            معمارية SKZ — العملة الداخلية
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm text-center">
            {[
              { step: "1", label: "الإيداع", desc: "المستخدم يودع USDT / Stars / TON" },
              { step: "→", label: "التحويل", desc: "البوت الأم يحول للـ SKZ بالمعدل الحالي" },
              { step: "2", label: "التشغيل", desc: "جميع البوتات الفرعية تعمل بـ SKZ فقط" },
            ].map((item, i) => (
              <div key={i} className="space-y-2">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 font-bold flex items-center justify-center mx-auto text-sm">
                  {item.step}
                </div>
                <p className="font-semibold text-purple-300">{item.label}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

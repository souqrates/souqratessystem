import { useState } from "react";
import { useGetUserByTelegramId } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import { Search, Wallet as WalletIcon, ArrowDownToLine, ArrowUpFromLine, CircleDollarSign, Star, Gem } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Wallets() {
  const [searchInput, setSearchInput] = useState("");
  const [telegramId, setTelegramId] = useState("");

  const { data: userWithWallet, isLoading, isError } = useGetUserByTelegramId(telegramId, {
    query: { enabled: !!telegramId, queryKey: ["wallet", telegramId] },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) setTelegramId(searchInput.trim());
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">المحافظ</h1>
        <p className="text-sm text-muted-foreground mt-0.5">البحث عن أرصدة المستخدمين وسجلاتهم المالية</p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-5">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="أدخل معرّف تليغرام..."
                className="pr-9 text-right"
                dir="rtl"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={!searchInput.trim()}>
              بحث
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      )}

      {/* Not found */}
      {isError && !isLoading && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="pt-6 flex flex-col items-center text-center py-10">
            <WalletIcon className="h-12 w-12 text-destructive mb-3 opacity-40" />
            <p className="font-medium text-destructive">المستخدم غير موجود</p>
            <p className="text-sm text-muted-foreground mt-1">لا توجد محفظة للمعرف: <span className="font-mono">{telegramId}</span></p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {userWithWallet && !isLoading && !isError && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* User details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">بيانات المستخدم</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {[
                  { label: "الاسم", value: `${userWithWallet.user.firstName} ${userWithWallet.user.lastName ?? ""}` },
                  { label: "اسم المستخدم", value: userWithWallet.user.username ? `@${userWithWallet.user.username}` : "—" },
                  { label: "معرّف تليغرام", value: userWithWallet.user.telegramId, mono: true },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between items-center py-2.5 border-b border-border/50 last:border-0">
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    <span className={`font-medium text-sm ${row.mono ? "font-mono" : ""}`}>{row.value}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center py-2.5">
                  <span className="text-sm text-muted-foreground">الحالة</span>
                  <div className="flex gap-2">
                    {userWithWallet.user.isBlocked
                      ? <Badge variant="destructive" className="text-xs">محظور</Badge>
                      : <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">نشط</Badge>
                    }
                    {userWithWallet.user.isPremium && (
                      <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs">Premium</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Balances */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">الأرصدة</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {[
                  { label: "USDT", value: formatCurrency(userWithWallet.wallet.balanceUsdt, "usdt"), icon: CircleDollarSign, color: "text-emerald-400" },
                  { label: "TON", value: formatCurrency(userWithWallet.wallet.balanceTon, "ton"), icon: Gem, color: "text-sky-400" },
                  { label: "Stars ⭐", value: formatCurrency(userWithWallet.wallet.balanceStars, "stars"), icon: Star, color: "text-amber-400" },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between items-center py-2.5 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <row.icon className={`w-3.5 h-3.5 ${row.color}`} />
                      {row.label}
                    </div>
                    <span className={`font-bold font-mono text-sm ${row.color}`}>{row.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Totals */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-400 font-medium mb-1">إجمالي المكتسب</p>
                <p className="text-2xl font-bold text-emerald-400">{formatCurrency(userWithWallet.wallet.totalEarned, "usdt")}</p>
              </div>
              <ArrowDownToLine className="h-7 w-7 text-emerald-400/40" />
            </div>
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-sky-400 font-medium mb-1">إجمالي المسحوب</p>
                <p className="text-2xl font-bold text-sky-400">{formatCurrency(userWithWallet.wallet.totalWithdrawn, "usdt")}</p>
              </div>
              <ArrowUpFromLine className="h-7 w-7 text-sky-400/40" />
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!telegramId && !isLoading && (
        <div className="rounded-xl border border-dashed border-border/60 py-16 flex flex-col items-center text-center text-muted-foreground">
          <WalletIcon className="h-12 w-12 mb-3 opacity-20" />
          <p className="font-medium">ابحث عن مستخدم</p>
          <p className="text-sm mt-1 opacity-70">أدخل معرّف تليغرام للاطلاع على بيانات محفظته</p>
        </div>
      )}
    </div>
  );
}

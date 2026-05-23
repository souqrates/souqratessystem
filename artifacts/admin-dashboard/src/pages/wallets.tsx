import { useState } from "react";
import { useGetUserByTelegramId } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import { Search, Wallet as WalletIcon, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Wallets() {
  const [searchInput, setSearchInput] = useState("");
  const [telegramId, setTelegramId] = useState("");

  const { data: userWithWallet, isLoading, isError } = useGetUserByTelegramId(telegramId, {
    query: { enabled: !!telegramId, queryKey: ["wallet", telegramId] }
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setTelegramId(searchInput.trim());
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Wallet Lookup</h1>
        <p className="text-muted-foreground">Look up user balances and financial history by Telegram ID.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Enter Telegram ID..."
                className="pl-9"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={!searchInput.trim()}>
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {isError && (
        <Card className="border-destructive">
          <CardContent className="pt-6 flex flex-col items-center text-center">
            <WalletIcon className="h-12 w-12 text-destructive mb-4 opacity-50" />
            <p className="text-lg font-medium">User not found</p>
            <p className="text-muted-foreground">No wallet found for Telegram ID: {telegramId}</p>
          </CardContent>
        </Card>
      )}

      {userWithWallet && !isLoading && !isError && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>User Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">{userWithWallet.user.firstName} {userWithWallet.user.lastName}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted-foreground">Username</span>
                  <span className="font-medium">{userWithWallet.user.username ? `@${userWithWallet.user.username}` : "N/A"}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted-foreground">Telegram ID</span>
                  <span className="font-mono text-sm">{userWithWallet.user.telegramId}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">Status</span>
                  <div>
                    {userWithWallet.user.isBlocked ? (
                      <Badge variant="destructive">Blocked</Badge>
                    ) : (
                      <Badge variant="default" className="bg-emerald-500/10 text-emerald-500">Active</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Balances</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted-foreground">USDT</span>
                  <span className="font-bold text-primary">{formatCurrency(userWithWallet.wallet.balanceUsdt, "usdt")}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted-foreground">TON</span>
                  <span className="font-bold">{formatCurrency(userWithWallet.wallet.balanceTon, "ton")}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">Stars</span>
                  <span className="font-bold text-yellow-500">{formatCurrency(userWithWallet.wallet.balanceStars, "stars")}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="bg-emerald-950/20 border-emerald-900/50">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-emerald-500 mb-1">Total Earned</p>
                  <p className="text-2xl font-bold text-emerald-400">{formatCurrency(userWithWallet.wallet.totalEarned, "usdt")}</p>
                </div>
                <ArrowDownToLine className="h-8 w-8 text-emerald-500 opacity-50" />
              </CardContent>
            </Card>
            
            <Card className="bg-blue-950/20 border-blue-900/50">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-500 mb-1">Total Withdrawn</p>
                  <p className="text-2xl font-bold text-blue-400">{formatCurrency(userWithWallet.wallet.totalWithdrawn, "usdt")}</p>
                </div>
                <ArrowUpFromLine className="h-8 w-8 text-blue-500 opacity-50" />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

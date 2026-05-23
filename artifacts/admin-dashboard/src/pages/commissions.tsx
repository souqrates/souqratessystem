import { useState } from "react";
import { useListCommissions, useListBots } from "@workspace/api-client-react";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Percent, TrendingUp } from "lucide-react";

export default function Commissions() {
  const [page, setPage] = useState(1);
  const [botSlug, setBotSlug] = useState<string>("");
  const [userIdFilter, setUserIdFilter] = useState("");

  const { data: bots } = useListBots();
  const parsedUserId = userIdFilter ? parseInt(userIdFilter, 10) : undefined;

  const { data: commissions, isLoading } = useListCommissions({
    page, limit: 20,
    ...(botSlug && botSlug !== "all" ? { botSlug } : {}),
    ...(parsedUserId && !isNaN(parsedUserId) ? { userId: parsedUserId } : {}),
  });

  const totalCommission = commissions?.data.reduce(
    (sum, c) => sum + parseFloat(c.commissionAmount), 0
  ) ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">سجل العمولات</h1>
          <p className="text-sm text-muted-foreground mt-0.5">أرباح البوت الأم من البوتات الفرعية</p>
        </div>
        <div className="flex gap-3">
          <Input
            placeholder="فلتر بمعرّف المستخدم"
            value={userIdFilter}
            onChange={(e) => { setUserIdFilter(e.target.value); setPage(1); }}
            className="w-[160px] text-right"
            dir="rtl"
            type="number"
          />
          <Select value={botSlug} onValueChange={(v) => { setBotSlug(v); setPage(1); }}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="كل البوتات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل البوتات</SelectItem>
              {bots?.data.map(bot => (
                <SelectItem key={bot.slug} value={bot.slug}>{bot.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary card */}
      {commissions && commissions.data.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">إجمالي العمولات في هذه الصفحة</p>
              <p className="font-bold text-primary">{formatCurrency(totalCommission.toFixed(2), "usdt")}</p>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">{commissions.total} سجل إجمالاً</div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-right text-muted-foreground font-medium text-xs">التاريخ</TableHead>
              <TableHead className="text-right text-muted-foreground font-medium text-xs">البوت</TableHead>
              <TableHead className="text-right text-muted-foreground font-medium text-xs">المبلغ الإجمالي</TableHead>
              <TableHead className="text-right text-muted-foreground font-medium text-xs">نسبة العمولة</TableHead>
              <TableHead className="text-right text-muted-foreground font-medium text-xs text-primary">العمولة المحصّلة</TableHead>
              <TableHead className="text-right text-muted-foreground font-medium text-xs">الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i} className="border-border">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : commissions?.data.length === 0
              ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-32 text-muted-foreground">
                    <Percent className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    لا توجد عمولات
                  </TableCell>
                </TableRow>
              )
              : commissions?.data.map((comm) => (
                <TableRow key={comm.id} className="border-border hover:bg-white/[0.02] transition-colors">
                  <TableCell className="text-sm text-muted-foreground">{formatDate(comm.createdAt)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs bg-muted/40">{comm.botSlug}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{formatCurrency(comm.grossAmount, comm.currency)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {(parseFloat(comm.commissionRate) * 100).toFixed(1)}%
                  </TableCell>
                  <TableCell className="font-mono font-bold text-primary text-sm">
                    +{formatCurrency(comm.commissionAmount, comm.currency)}
                  </TableCell>
                  <TableCell>
                    {comm.status === "collected"
                      ? <Badge className="bg-primary/15 text-primary border-primary/20 text-xs">محصّلة</Badge>
                      : <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs">قيد الانتظار</Badge>
                    }
                  </TableCell>
                </TableRow>
              ))
            }
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          عرض {commissions?.data.length ?? 0} من أصل {commissions?.total ?? 0} عمولة
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || isLoading}>
            السابق
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={!commissions || commissions.data.length < commissions.limit || isLoading}>
            التالي
          </Button>
        </div>
      </div>
    </div>
  );
}

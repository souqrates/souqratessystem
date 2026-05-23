import { useState } from "react";
import { useListTransactions } from "@workspace/api-client-react";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRightLeft, TrendingUp, TrendingDown } from "lucide-react";

export default function Transactions() {
  const [page, setPage] = useState(1);
  const [type, setType] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  const { data: transactions, isLoading } = useListTransactions({
    page, limit: 20,
    ...(type && type !== "all" ? { type } : {}),
    ...(status && status !== "all" ? { status } : {}),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">المعاملات المالية</h1>
          <p className="text-sm text-muted-foreground mt-0.5">سجل كامل لجميع عمليات الإيداع والسحب</p>
        </div>
        <div className="flex gap-3">
          <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="كل الأنواع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأنواع</SelectItem>
              <SelectItem value="credit">إيداع</SelectItem>
              <SelectItem value="debit">سحب</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="كل الحالات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="completed">مكتملة</SelectItem>
              <SelectItem value="pending">قيد الانتظار</SelectItem>
              <SelectItem value="failed">فاشلة</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-right text-muted-foreground font-medium text-xs">التاريخ</TableHead>
              <TableHead className="text-right text-muted-foreground font-medium text-xs">المعرّف / المرجع</TableHead>
              <TableHead className="text-right text-muted-foreground font-medium text-xs">النوع</TableHead>
              <TableHead className="text-right text-muted-foreground font-medium text-xs">المبلغ</TableHead>
              <TableHead className="text-right text-muted-foreground font-medium text-xs">المصدر</TableHead>
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
              : transactions?.data.length === 0
              ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-32 text-muted-foreground">
                    <ArrowRightLeft className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    لا توجد معاملات
                  </TableCell>
                </TableRow>
              )
              : transactions?.data.map((tx) => (
                <TableRow key={tx.id} className="border-border hover:bg-white/[0.02] transition-colors">
                  <TableCell className="text-sm text-muted-foreground">{formatDate(tx.createdAt)}</TableCell>
                  <TableCell>
                    <div className="font-mono text-xs text-muted-foreground">{tx.id}</div>
                    {tx.referenceId && (
                      <div className="text-xs text-muted-foreground/50 truncate max-w-[100px]" title={tx.referenceId}>
                        {tx.referenceId}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {tx.type === "credit"
                      ? <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs gap-1">
                          <TrendingUp className="w-3 h-3" />إيداع
                        </Badge>
                      : <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-xs gap-1">
                          <TrendingDown className="w-3 h-3" />سحب
                        </Badge>
                    }
                  </TableCell>
                  <TableCell>
                    <span className={`font-mono font-bold ${tx.type === "credit" ? "text-emerald-400" : "text-rose-400"}`}>
                      {tx.type === "credit" ? "+" : "-"}{formatCurrency(tx.amount, tx.currency)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {tx.sourceBot
                      ? <Badge variant="outline" className="font-mono text-xs bg-muted/40">{tx.sourceBot}</Badge>
                      : <span className="text-muted-foreground">—</span>
                    }
                  </TableCell>
                  <TableCell>
                    {tx.status === "completed" && <Badge className="bg-primary/15 text-primary border-primary/20 text-xs">مكتملة</Badge>}
                    {tx.status === "pending"   && <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs">قيد الانتظار</Badge>}
                    {tx.status === "failed"    && <Badge variant="destructive" className="text-xs">فاشلة</Badge>}
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
          عرض {transactions?.data.length ?? 0} من أصل {transactions?.total ?? 0} معاملة
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || isLoading}>
            السابق
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={!transactions || transactions.data.length < transactions.limit || isLoading}>
            التالي
          </Button>
        </div>
      </div>
    </div>
  );
}

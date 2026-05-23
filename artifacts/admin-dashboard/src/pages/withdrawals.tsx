import { useState } from "react";
import {
  useListWithdrawals,
  getListWithdrawalsQueryKey,
  getGetStatsOverviewQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Check, X, ArrowUpFromLine, Clock } from "lucide-react";
import { withAdminAuth } from "@/lib/admin-token";

export default function Withdrawals() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("all");

  const [approveId, setApproveId] = useState<number | null>(null);
  const [txHash, setTxHash] = useState("");
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: withdrawals, isLoading } = useListWithdrawals({
    page, limit: 20,
    ...(status && status !== "all" ? { status } : {}),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListWithdrawalsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetStatsOverviewQueryKey() });
  };

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approveId || !txHash) return;
    try {
      const res = await fetch(`/api/withdrawals/${approveId}/approve`, withAdminAuth({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash }),
      }));
      if (!res.ok) throw new Error();
      toast({ title: "✓ تمت الموافقة على طلب السحب" });
      setApproveId(null);
      setTxHash("");
      invalidate();
    } catch {
      toast({ title: "فشل الموافقة على السحب", variant: "destructive" });
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectId || !rejectReason) return;
    try {
      const res = await fetch(`/api/withdrawals/${rejectId}/reject`, withAdminAuth({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      }));
      if (!res.ok) throw new Error();
      toast({ title: "✓ تم رفض طلب السحب" });
      setRejectId(null);
      setRejectReason("");
      invalidate();
    } catch {
      toast({ title: "فشل رفض السحب", variant: "destructive" });
    }
  };

  const pendingCount = withdrawals?.data.filter(w => w.status === "pending").length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">طلبات السحب</h1>
          <p className="text-sm text-muted-foreground mt-0.5">مراجعة ومعالجة طلبات سحب المستخدمين</p>
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="كل الحالات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="pending">قيد الانتظار</SelectItem>
            <SelectItem value="approved">موافق عليها</SelectItem>
            <SelectItem value="rejected">مرفوضة</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Pending banner */}
      {pendingCount > 0 && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-sm text-amber-400 font-medium">
            {pendingCount} طلب{pendingCount > 1 ? "ات" : ""} تنتظر المراجعة في هذه الصفحة
          </p>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-right text-muted-foreground font-medium text-xs">التاريخ</TableHead>
              <TableHead className="text-right text-muted-foreground font-medium text-xs">معرّف المستخدم</TableHead>
              <TableHead className="text-right text-muted-foreground font-medium text-xs">المبلغ</TableHead>
              <TableHead className="text-right text-muted-foreground font-medium text-xs">الصافي</TableHead>
              <TableHead className="text-right text-muted-foreground font-medium text-xs">العنوان</TableHead>
              <TableHead className="text-right text-muted-foreground font-medium text-xs">الحالة</TableHead>
              <TableHead className="text-right text-muted-foreground font-medium text-xs">الإجراء</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i} className="border-border">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : withdrawals?.data.length === 0
              ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-32 text-muted-foreground">
                    <ArrowUpFromLine className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    لا توجد طلبات سحب
                  </TableCell>
                </TableRow>
              )
              : withdrawals?.data.map((w) => (
                <TableRow key={w.id} className="border-border hover:bg-white/[0.02] transition-colors">
                  <TableCell className="text-sm text-muted-foreground">{formatDate(w.createdAt)}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{w.userId}</TableCell>
                  <TableCell className="font-mono text-sm">{formatCurrency(w.amount, w.currency)}</TableCell>
                  <TableCell className="font-mono font-bold text-sm text-primary">{formatCurrency(w.netAmount, w.currency)}</TableCell>
                  <TableCell>
                    <div className="max-w-[160px] truncate font-mono text-xs text-muted-foreground" title={w.address ?? ""}>
                      {w.address ?? "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    {w.status === "approved" && <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">موافق عليه</Badge>}
                    {w.status === "pending"  && <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs">قيد الانتظار</Badge>}
                    {w.status === "rejected" && <Badge variant="destructive" className="text-xs">مرفوض</Badge>}
                  </TableCell>
                  <TableCell>
                    {w.status === "pending" ? (
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-7 p-0 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                          onClick={() => setApproveId(w.id)}
                          title="قبول"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-7 p-0 text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
                          onClick={() => setRejectId(w.id)}
                          title="رفض"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">مُعالَج</span>
                    )}
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
          عرض {withdrawals?.data.length ?? 0} من أصل {withdrawals?.total ?? 0} طلب
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || isLoading}>
            السابق
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={!withdrawals || withdrawals.data.length < withdrawals.limit || isLoading}>
            التالي
          </Button>
        </div>
      </div>

      {/* Approve Dialog */}
      <Dialog open={!!approveId} onOpenChange={(open) => !open && setApproveId(null)}>
        <DialogContent dir="rtl">
          <form onSubmit={handleApprove}>
            <DialogHeader>
              <DialogTitle className="text-emerald-400">الموافقة على السحب</DialogTitle>
              <DialogDescription>
                أدخل رقم هاش المعاملة للتأكيد على أن الأموال قد أُرسلت فعلاً.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="txHash">هاش المعاملة (TxHash)</Label>
              <Input
                id="txHash"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder="0x..."
                className="mt-2 font-mono"
                dir="ltr"
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setApproveId(null)}>إلغاء</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">تأكيد الموافقة</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectId} onOpenChange={(open) => !open && setRejectId(null)}>
        <DialogContent dir="rtl">
          <form onSubmit={handleReject}>
            <DialogHeader>
              <DialogTitle className="text-destructive">رفض طلب السحب</DialogTitle>
              <DialogDescription>
                أدخل سبب الرفض. سيظهر هذا السبب للمستخدم.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="reason">سبب الرفض</Label>
              <Input
                id="reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="مثال: عنوان المحفظة غير صحيح"
                className="mt-2"
                dir="rtl"
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRejectId(null)}>إلغاء</Button>
              <Button type="submit" variant="destructive">تأكيد الرفض</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

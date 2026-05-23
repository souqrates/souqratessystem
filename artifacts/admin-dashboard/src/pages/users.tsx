import { useState } from "react";
import { useListUsers } from "@workspace/api-client-react";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { Search, Users as UsersIcon, ShieldCheck, Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Users() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data: users, isLoading } = useListUsers({ page, limit: 20, search });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">المستخدمون</h1>
          <p className="text-sm text-muted-foreground mt-0.5">إدارة جميع مستخدمي المنصة وحالاتهم</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="بحث بالاسم أو المعرف..."
            className="pr-9 text-right"
            dir="rtl"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "إجمالي المستخدمين", value: users?.total ?? "—", icon: UsersIcon, color: "text-sky-400", bg: "bg-sky-400/10" },
          { label: "مستخدمون نشطون", value: users ? (users.total - (users.data.filter(u => u.isBlocked).length)) : "—", icon: ShieldCheck, color: "text-emerald-400", bg: "bg-emerald-400/10" },
          { label: "Premium", value: users ? users.data.filter(u => u.isPremium).length : "—", icon: Crown, color: "text-amber-400", bg: "bg-amber-400/10" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xl font-bold">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-right text-muted-foreground font-medium text-xs">معرّف تليغرام</TableHead>
              <TableHead className="text-right text-muted-foreground font-medium text-xs">الاسم</TableHead>
              <TableHead className="text-right text-muted-foreground font-medium text-xs">اسم المستخدم</TableHead>
              <TableHead className="text-right text-muted-foreground font-medium text-xs">الحالة</TableHead>
              <TableHead className="text-right text-muted-foreground font-medium text-xs">تاريخ التسجيل</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 7 }).map((_, i) => (
                  <TableRow key={i} className="border-border">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : users?.data.length === 0
              ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-32 text-muted-foreground">
                    <UsersIcon className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    لا يوجد مستخدمون
                  </TableCell>
                </TableRow>
              )
              : users?.data.map((user) => (
                <TableRow key={user.id} className="border-border hover:bg-white/[0.02] transition-colors">
                  <TableCell className="font-mono text-xs text-muted-foreground">{user.telegramId}</TableCell>
                  <TableCell className="font-medium">{user.firstName} {user.lastName || ""}</TableCell>
                  <TableCell className="text-muted-foreground">{user.username ? `@${user.username}` : "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {user.isBlocked
                        ? <Badge variant="destructive" className="text-xs">محظور</Badge>
                        : <Badge className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20 text-xs">نشط</Badge>
                      }
                      {user.isPremium && (
                        <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs">
                          <Crown className="w-2.5 h-2.5 mr-1" />Premium
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{formatDate(user.createdAt)}</TableCell>
                </TableRow>
              ))
            }
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          عرض {users?.data.length ?? 0} من أصل {users?.total ?? 0} مستخدم
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || isLoading}>
            السابق
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={!users || users.data.length < users.limit || isLoading}>
            التالي
          </Button>
        </div>
      </div>
    </div>
  );
}

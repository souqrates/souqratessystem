import { useState } from "react";
import { useListCommissions, useListBots } from "@workspace/api-client-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export default function Commissions() {
  const [page, setPage] = useState(1);
  const [botSlug, setBotSlug] = useState<string>("");
  const [userIdFilter, setUserIdFilter] = useState("");
  
  const { data: bots } = useListBots();
  
  const parsedUserId = userIdFilter ? parseInt(userIdFilter, 10) : undefined;
  
  const { data: commissions, isLoading } = useListCommissions({ 
    page, 
    limit: 20,
    ...(botSlug && botSlug !== "all" ? { botSlug } : {}),
    ...(parsedUserId && !isNaN(parsedUserId) ? { userId: parsedUserId } : {})
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Commissions Ledger</h1>
          <p className="text-muted-foreground mt-1">Track Mother Bot earnings from child bots.</p>
        </div>
        
        <div className="flex gap-4">
          <Input 
            placeholder="Filter by User ID" 
            value={userIdFilter}
            onChange={(e) => setUserIdFilter(e.target.value)}
            className="w-[150px]"
            type="number"
          />
          <Select value={botSlug} onValueChange={setBotSlug}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Bots" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Bots</SelectItem>
              {bots?.data.map(bot => (
                <SelectItem key={bot.slug} value={bot.slug}>{bot.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Bot</TableHead>
              <TableHead>Gross Amount</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead className="text-primary font-bold">Commission</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                </TableRow>
              ))
            ) : commissions?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                  No commissions found.
                </TableCell>
              </TableRow>
            ) : (
              commissions?.data.map((comm) => (
                <TableRow key={comm.id}>
                  <TableCell className="text-muted-foreground text-sm">{formatDate(comm.createdAt)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono bg-muted/50">{comm.botSlug}</Badge>
                  </TableCell>
                  <TableCell className="font-mono">{formatCurrency(comm.grossAmount, comm.currency)}</TableCell>
                  <TableCell className="text-muted-foreground">{(parseFloat(comm.commissionRate) * 100).toFixed(1)}%</TableCell>
                  <TableCell className="font-mono font-bold text-primary">
                    +{formatCurrency(comm.commissionAmount, comm.currency)}
                  </TableCell>
                  <TableCell>
                    {comm.status === 'collected' && <Badge className="bg-primary/20 text-primary hover:bg-primary/30">Collected</Badge>}
                    {comm.status === 'pending' && <Badge variant="secondary" className="text-yellow-500 bg-yellow-500/10">Pending</Badge>}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {commissions?.data.length || 0} of {commissions?.total || 0} commissions
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || isLoading}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={!commissions || commissions.data.length < commissions.limit || isLoading}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

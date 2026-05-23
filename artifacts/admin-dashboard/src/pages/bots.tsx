import { useState } from "react";
import { useListBots, useCreateBot, getListBotsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Bot as BotIcon, Activity, Percent } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Bots() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", slug: "", commissionRate: "0.1" });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: botsList, isLoading } = useListBots();
  const createBot = useCreateBot();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createBot.mutate({ data: formData }, {
      onSuccess: () => {
        toast({ title: "Bot registered successfully" });
        setIsDialogOpen(false);
        setFormData({ name: "", slug: "", commissionRate: "0.1" });
        queryClient.invalidateQueries({ queryKey: getListBotsQueryKey() });
      },
      onError: (err: any) => {
        toast({ 
          title: "Failed to register bot", 
          description: err.error || "An unknown error occurred",
          variant: "destructive" 
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Child Bots</h1>
          <p className="text-muted-foreground mt-1">Manage registered bots and their commission rates.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Register Bot
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Register Child Bot</DialogTitle>
                <DialogDescription>
                  Add a new bot to the Mother Bot network. The bot must already be running to process transactions.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Bot Name</Label>
                  <Input 
                    id="name" 
                    placeholder="e.g. Signal Trader Bot" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="slug">Bot Slug (ID)</Label>
                  <Input 
                    id="slug" 
                    placeholder="e.g. signal_trader" 
                    value={formData.slug}
                    onChange={(e) => setFormData({...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')})}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="commission">Commission Rate</Label>
                  <Input 
                    id="commission" 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    max="1" 
                    value={formData.commissionRate}
                    onChange={(e) => setFormData({...formData, commissionRate: e.target.value})}
                    required
                  />
                  <p className="text-xs text-muted-foreground">0.1 = 10% commission on all transactions</p>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createBot.isPending}>
                  {createBot.isPending ? "Registering..." : "Register Bot"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="pb-4">
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between"><Skeleton className="h-4 w-16" /><Skeleton className="h-4 w-20" /></div>
                  <div className="flex justify-between"><Skeleton className="h-4 w-16" /><Skeleton className="h-4 w-20" /></div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : botsList?.data.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground bg-card border border-border rounded-lg shadow-sm">
            <BotIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg">No bots registered</p>
            <p className="text-sm">Click "Register Bot" to add your first child bot.</p>
          </div>
        ) : (
          botsList?.data.map((bot) => (
            <Card key={bot.id} className="overflow-hidden transition-all hover:border-primary/50 group">
              <div className={`h-1 w-full ${bot.isActive ? 'bg-primary' : 'bg-muted'}`} />
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="group-hover:text-primary transition-colors">{bot.name}</CardTitle>
                    <CardDescription className="font-mono mt-1 text-xs">{bot.slug}</CardDescription>
                  </div>
                  {bot.isActive ? (
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 bg-muted/30 rounded-md p-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center text-muted-foreground text-sm">
                      <Percent className="w-4 h-4 mr-2" />
                      Commission
                    </div>
                    <span className="font-mono font-medium">{(parseFloat(bot.commissionRate) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center text-muted-foreground text-sm">
                      <Activity className="w-4 h-4 mr-2" />
                      Volume
                    </div>
                    <span className="font-mono text-primary font-medium">{formatCurrency(bot.totalVolumeUsdt, "usdt")}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-border/50">
                    <span className="text-sm text-muted-foreground">Total Earned</span>
                    <span className="font-mono font-medium">{formatCurrency(bot.totalCommissionUsdt, "usdt")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

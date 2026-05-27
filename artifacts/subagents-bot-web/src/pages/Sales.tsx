import { useLocation } from "wouter";
import { useGetSubAgentSales } from "@workspace/api-client-react";
import { ArrowRight, History, User } from "lucide-react";
import { format } from "date-fns";

export default function SalesPage() {
  const [, setLocation] = useLocation();
  const { data: salesData, isLoading } = useGetSubAgentSales();

  const sales = salesData?.data || [];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <div className="bg-card border-b p-4 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <button 
          onClick={() => setLocation("/dashboard")}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-accent transition-colors"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          سجل المبيعات
        </h1>
      </div>

      <div className="p-4 flex-1">
        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-20 bg-card rounded-xl border animate-pulse" />
            ))}
          </div>
        ) : sales.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <History className="w-12 h-12 mb-4 opacity-20" />
            <p>لا يوجد مبيعات حتى الآن</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sales.map((sale) => (
              <div key={sale.id} className="bg-card border rounded-xl p-4 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-sm" dir="ltr">{sale.customerMasked}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(sale.createdAt), "dd MMM yyyy, HH:mm")}
                    </p>
                  </div>
                </div>
                <div className="text-left" dir="ltr">
                  <span className="font-bold text-primary">+{parseFloat(sale.skzAmount).toLocaleString()}</span>
                  <span className="text-xs font-medium text-muted-foreground ml-1">SKZ</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

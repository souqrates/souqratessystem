import { Link } from "wouter";
import { useSubAgentMe } from "../lib/use-subagent";
import { Loader2, Clock } from "lucide-react";

export function SubAgentsPending() {
  const { data: me, isLoading, refetch, isFetching } = useSubAgentMe();
  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-amber-400" size={32} /></div>;
  }
  const status = me?.status ?? "not_applied";

  return (
    <div className="px-4 pt-8 pb-8 space-y-5 text-center" dir="rtl">
      {status === "pending" && (
        <>
          <div className="inline-flex w-20 h-20 rounded-full items-center justify-center bg-amber-500/20 mx-auto">
            <Clock className="text-amber-400" size={40} />
          </div>
          <h1 className="text-xl font-black">طلبك قيد المراجعة</h1>
          <p className="text-sm text-white/60 max-w-xs mx-auto">
            فريق SOUQRATES يراجع طلبك حالياً. ستصلك رسالة في تيليغرام فور صدور القرار خلال 24-48 ساعة.
          </p>
          <button onClick={() => refetch()} disabled={isFetching}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold bg-white/10 hover:bg-white/20 disabled:opacity-50">
            {isFetching ? "جاري التحديث…" : "تحديث الحالة"}
          </button>
        </>
      )}
      {status === "approved" && (
        <>
          <div className="text-5xl">🎉</div>
          <h1 className="text-xl font-black">تمّت الموافقة!</h1>
          <Link href="/subagents/dashboard">
            <a className="inline-block px-8 py-3 rounded-2xl font-bold text-white"
               style={{ background: "linear-gradient(135deg, #D4AF37, #b8941f)" }}>
              افتح لوحتك ♛
            </a>
          </Link>
        </>
      )}
      {status === "rejected" && (
        <>
          <div className="text-5xl">❌</div>
          <h1 className="text-xl font-black">لم يتم القبول</h1>
          <p className="text-sm text-white/60">السبب: {me?.agent?.rejectedReason}</p>
          <Link href="/subagents/apply">
            <a className="inline-block px-6 py-2.5 rounded-xl text-sm font-bold bg-white/10">✏️ إعادة التقديم</a>
          </Link>
        </>
      )}
      {status === "not_applied" && (
        <>
          <p className="text-sm text-white/60">لم تقدّم طلباً بعد.</p>
          <Link href="/subagents/apply">
            <a className="inline-block px-6 py-2.5 rounded-xl text-sm font-bold bg-amber-500/20 text-amber-300">قدّم طلبك</a>
          </Link>
        </>
      )}
    </div>
  );
}

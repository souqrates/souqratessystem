import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type SuperWallet, type SuperTransaction, ApiError } from "@/lib/api";

interface UserData {
  user: {
    id: number;
    telegramId: string | number;
    username: string | null;
    firstName: string;
    lastName: string | null;
    isBlocked: boolean | null;
    isPremium: boolean | null;
    createdAt: string;
    languageCode: string | null;
  };
  wallet: SuperWallet | null;
  transactions: SuperTransaction[];
}

export default function UserDetailPage() {
  const [, params] = useRoute<{ telegramId: string }>("/users/:telegramId");
  const tid = params?.telegramId ?? "";
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["superadmin", "user", tid],
    queryFn: () => api.get<UserData>(`/superadmin/users/${tid}`),
    enabled: !!tid,
  });

  const blockMut = useMutation({
    mutationFn: (isBlocked: boolean) => api.patch(`/superadmin/users/${tid}`, { isBlocked }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin", "user", tid] });
      qc.invalidateQueries({ queryKey: ["superadmin", "users"] });
    },
  });

  if (isLoading) return <div className="p-8 text-slate-400" dir="rtl">جارٍ التحميل…</div>;
  if (error) return <div className="p-8 text-red-600" dir="rtl">{(error as ApiError).message}</div>;
  if (!data) return null;

  const { user, wallet, transactions } = data;

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <Link href="/users">
        <a className="text-sm text-indigo-600 hover:underline">← العودة إلى المستخدمين</a>
      </Link>

      <header className="mt-3 mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{user.firstName} {user.lastName ?? ""}</h1>
          <div className="text-slate-500 mt-1 flex flex-wrap items-center gap-3">
            {user.username && <span dir="ltr">@{user.username}</span>}
            <span className="font-mono text-xs" dir="ltr">{String(user.telegramId)}</span>
            <span className="text-xs">{new Date(user.createdAt).toLocaleString("ar-EG")}</span>
            {user.isPremium && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">⭐ بريميوم</span>}
          </div>
        </div>
        <button
          onClick={() => blockMut.mutate(!user.isBlocked)}
          disabled={blockMut.isPending}
          className={`px-4 py-2 rounded-lg text-sm font-semibold ${
            user.isBlocked
              ? "bg-emerald-600 hover:bg-emerald-500 text-white"
              : "bg-red-600 hover:bg-red-500 text-white"
          }`}
        >
          {user.isBlocked ? "إلغاء الحظر" : "حظر المستخدم"}
        </button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="رصيد SKZ" value={Number(wallet?.balanceSkz ?? 0).toFixed(2)} accent="indigo" />
        <StatCard label="نجوم تيليغرام" value={Number(wallet?.balanceStars ?? 0).toFixed(0)} accent="amber" />
        <StatCard label="USDT" value={Number(wallet?.balanceUsdt ?? 0).toFixed(2)} accent="emerald" />
        <StatCard label="TON" value={Number(wallet?.balanceTon ?? 0).toFixed(4)} accent="sky" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <AdjustForm tid={tid} direction="credit" />
        <AdjustForm tid={tid} direction="debit" />
      </div>

      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">آخر المعاملات</h2>
          <span className="text-xs text-slate-500">{transactions.length} معاملة</span>
        </div>
        <TransactionsTable rows={transactions} />
      </section>
    </div>
  );
}

function AdjustForm({ tid, direction }: { tid: string; direction: "credit" | "debit" }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const mut = useMutation({
    mutationFn: () => api.post(`/superadmin/users/${tid}/${direction}`, {
      amountSkz: parseFloat(amount),
      reason: reason.trim(),
    }),
    onSuccess: () => {
      setAmount(""); setReason("");
      setMsg({ type: "ok", text: direction === "credit" ? "تمت إضافة الرصيد ✓" : "تم خصم الرصيد ✓" });
      qc.invalidateQueries({ queryKey: ["superadmin", "user", tid] });
      qc.invalidateQueries({ queryKey: ["superadmin", "users"] });
      qc.invalidateQueries({ queryKey: ["superadmin", "transactions"] });
    },
    onError: (e: ApiError) => setMsg({ type: "err", text: e.message }),
  });

  const isCredit = direction === "credit";
  return (
    <div className={`bg-white border rounded-2xl p-5 shadow-sm ${isCredit ? "border-emerald-200" : "border-red-200"}`}>
      <h3 className={`font-bold mb-3 flex items-center gap-2 ${isCredit ? "text-emerald-700" : "text-red-700"}`}>
        <span>{isCredit ? "💰" : "➖"}</span>
        {isCredit ? "إرسال SKZ يدوياً" : "خصم SKZ يدوياً"}
      </h3>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">المبلغ (SKZ)</label>
          <input
            type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono focus:ring-2 focus:ring-indigo-500" dir="ltr"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">السبب (سيُسجَّل في سجل المعاملات)</label>
          <input
            type="text" value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder={isCredit ? "مثلاً: مكافأة، تعويض…" : "مثلاً: تصحيح، رسوم…"}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          onClick={() => mut.mutate()}
          disabled={mut.isPending || !amount || !reason.trim() || parseFloat(amount) <= 0}
          className={`w-full py-2.5 rounded-lg text-white font-semibold disabled:opacity-40 ${
            isCredit ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"
          }`}
        >
          {mut.isPending ? "…" : (isCredit ? "إضافة الرصيد" : "خصم الرصيد")}
        </button>
        {msg && (
          <div className={`text-sm ${msg.type === "ok" ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  const colors: Record<string, string> = {
    indigo: "from-indigo-500 to-indigo-600",
    amber: "from-amber-500 to-amber-600",
    emerald: "from-emerald-500 to-emerald-600",
    sky: "from-sky-500 to-sky-600",
  };
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-xl font-bold bg-gradient-to-br ${colors[accent]} bg-clip-text text-transparent font-mono`} dir="ltr">{value}</div>
    </div>
  );
}

export function TransactionsTable({ rows }: { rows: SuperTransaction[] }) {
  if (rows.length === 0) {
    return <div className="text-center py-10 text-slate-400">لا توجد معاملات</div>;
  }
  return (
    <table className="w-full text-sm">
      <thead className="bg-slate-50 text-xs text-slate-600 uppercase tracking-wider">
        <tr>
          <th className="px-4 py-2 text-right">#</th>
          <th className="px-4 py-2 text-right">النوع</th>
          <th className="px-4 py-2 text-right">المبلغ</th>
          <th className="px-4 py-2 text-right">العملة</th>
          <th className="px-4 py-2 text-right">المصدر</th>
          <th className="px-4 py-2 text-right">الحالة</th>
          <th className="px-4 py-2 text-right">الوصف</th>
          <th className="px-4 py-2 text-right">التاريخ</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((t) => (
          <tr key={t.id} className="hover:bg-slate-50">
            <td className="px-4 py-2 text-xs text-slate-500 font-mono">{t.id}</td>
            <td className="px-4 py-2 text-slate-800"><TypeBadge type={t.type} /></td>
            <td className="px-4 py-2 font-mono" dir="ltr">{Number(t.amount).toFixed(2)}</td>
            <td className="px-4 py-2 text-xs uppercase text-slate-500">{t.currency}</td>
            <td className="px-4 py-2 text-xs text-slate-600">{t.sourceBot ?? "—"}</td>
            <td className="px-4 py-2"><StatusBadge status={t.status} /></td>
            <td className="px-4 py-2 text-xs text-slate-600 max-w-xs truncate" title={t.description ?? ""}>{t.description ?? "—"}</td>
            <td className="px-4 py-2 text-xs text-slate-500" dir="ltr">{new Date(t.createdAt).toLocaleString("ar-EG")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    admin_credit: "bg-emerald-100 text-emerald-700",
    admin_debit: "bg-red-100 text-red-700",
    deposit: "bg-sky-100 text-sky-700",
    withdrawal: "bg-amber-100 text-amber-700",
    commission: "bg-purple-100 text-purple-700",
    referral_bonus: "bg-pink-100 text-pink-700",
    game_win: "bg-emerald-100 text-emerald-700",
    game_loss: "bg-red-100 text-red-700",
  };
  const cls = map[type] ?? "bg-slate-100 text-slate-700";
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{type}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-emerald-100 text-emerald-700",
    pending: "bg-amber-100 text-amber-700",
    failed: "bg-red-100 text-red-700",
    cancelled: "bg-slate-200 text-slate-700",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${map[status] ?? "bg-slate-100 text-slate-700"}`}>{status}</span>;
}

import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, X, ExternalLink } from "lucide-react";
import { api, type SuperUser, type SuperWallet, type SuperTransaction, ApiError } from "@/lib/api";

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

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedTid, setSelectedTid] = useState<string | null>(null);
  const limit = 50;

  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "users", search, page],
    queryFn: () =>
      api.get<{ data: SuperUser[]; total: number }>(
        `/superadmin/users?page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ""}`,
      ),
  });

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / limit));

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">المستخدمون</h1>
        <p className="text-slate-500 mt-1">بحث وإدارة جميع مستخدمي البوتات — اضغط على أي صف لعرض التفاصيل</p>
      </header>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4 shadow-sm">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="ابحث بالاسم، اليوزرنيم، أو رقم تيليغرام…"
          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-right">المستخدم</th>
              <th className="px-4 py-3 text-right">Telegram ID</th>
              <th className="px-4 py-3 text-right">الرصيد SKZ</th>
              <th className="px-4 py-3 text-right">إجمالي الأرباح</th>
              <th className="px-4 py-3 text-right">الحالة</th>
              <th className="px-4 py-3 text-right">إجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-10 text-slate-400">جارٍ التحميل…</td></tr>
            ) : (data?.data ?? []).length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-slate-400">لا توجد نتائج</td></tr>
            ) : (
              data!.data.map((u) => (
                <tr
                  key={u.id}
                  className={`hover:bg-indigo-50/30 cursor-pointer transition-colors ${
                    selectedTid === String(u.telegramId) ? "bg-indigo-50" : ""
                  }`}
                  onClick={() => setSelectedTid(String(u.telegramId))}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{u.firstName} {u.lastName ?? ""}</div>
                    {u.username && <div className="text-xs text-slate-500" dir="ltr">@{u.username}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700" dir="ltr">{String(u.telegramId)}</td>
                  <td className="px-4 py-3 font-mono text-slate-900">{Number(u.balanceSkz ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-3 font-mono text-slate-500">{Number(u.totalEarnedSkz ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    {u.isBlocked
                      ? <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">محظور</span>
                      : <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">نشط</span>}
                    {u.isPremium && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full mr-1 inline-flex items-center gap-1">
                        <Star size={10} fill="currentColor" /> بريميوم
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setSelectedTid(String(u.telegramId))}
                      className="text-indigo-600 hover:underline font-medium text-sm"
                    >
                      عرض
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
          <span className="text-xs text-slate-500">
            {data?.total ?? 0} مستخدم · صفحة {page} من {totalPages}
          </span>
          <div className="flex gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 text-sm rounded border border-slate-300 disabled:opacity-40">السابق</button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm rounded border border-slate-300 disabled:opacity-40">التالي</button>
          </div>
        </div>
      </div>

      {selectedTid && (
        <UserDetailPanel tid={selectedTid} onClose={() => setSelectedTid(null)} />
      )}
    </div>
  );
}

function UserDetailPanel({ tid, onClose }: { tid: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [adjDir, setAdjDir] = useState<"credit" | "debit">("credit");
  const [adjMsg, setAdjMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

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

  const adjMut = useMutation({
    mutationFn: () =>
      api.post(`/superadmin/users/${tid}/${adjDir}`, {
        amountSkz: parseFloat(amount),
        reason: adjReason.trim(),
      }),
    onSuccess: () => {
      setAmount("");
      setAdjReason("");
      setAdjMsg({ type: "ok", text: adjDir === "credit" ? "تمت إضافة الرصيد" : "تم خصم الرصيد" });
      qc.invalidateQueries({ queryKey: ["superadmin", "user", tid] });
      qc.invalidateQueries({ queryKey: ["superadmin", "users"] });
      qc.invalidateQueries({ queryKey: ["superadmin", "transactions"] });
      setTimeout(() => setAdjMsg(null), 3000);
    },
    onError: (e: ApiError) => {
      setAdjMsg({ type: "err", text: e.message });
    },
  });

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div
        className="fixed top-0 left-0 h-full w-full max-w-md bg-white shadow-2xl z-50 overflow-y-auto flex flex-col"
        dir="rtl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <h2 className="font-bold text-lg text-slate-900">تفاصيل المستخدم</h2>
          <div className="flex items-center gap-3">
            <Link href={`/users/${tid}`}>
              <a className="text-xs text-indigo-600 hover:underline inline-flex items-center gap-1">
                <ExternalLink size={12} /> صفحة كاملة
              </a>
            </Link>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
              <X size={18} />
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="flex-1 flex items-center justify-center text-slate-400">جارٍ التحميل…</div>
        )}
        {error && (
          <div className="flex-1 flex items-center justify-center text-red-500 text-sm px-6 text-center">
            {(error as ApiError).message}
          </div>
        )}

        {data && (() => {
          const { user, wallet, transactions } = data;
          return (
            <div className="flex-1 p-5 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-900 text-lg leading-tight">
                    {user.firstName} {user.lastName ?? ""}
                  </div>
                  <div className="text-sm text-slate-500 flex flex-wrap gap-2 mt-1">
                    {user.username && <span dir="ltr">@{user.username}</span>}
                    <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded" dir="ltr">
                      {String(user.telegramId)}
                    </span>
                    {user.isPremium && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                        <Star size={9} fill="currentColor" /> بريميوم
                      </span>
                    )}
                    {user.isBlocked && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">محظور</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    انضم: {new Date(user.createdAt).toLocaleDateString("ar-EG")}
                  </div>
                </div>
                <button
                  onClick={() => blockMut.mutate(!user.isBlocked)}
                  disabled={blockMut.isPending}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 disabled:opacity-40 ${
                    user.isBlocked
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                      : "bg-red-100 hover:bg-red-200 text-red-700"
                  }`}
                >
                  {blockMut.isPending ? "…" : user.isBlocked ? "إلغاء الحظر" : "حظر"}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "SKZ", value: Number(wallet?.balanceSkz ?? 0).toFixed(2), color: "text-indigo-600" },
                  { label: "نجوم ⭐", value: Number(wallet?.balanceStars ?? 0).toFixed(0), color: "text-amber-600" },
                  { label: "USDT", value: Number(wallet?.balanceUsdt ?? 0).toFixed(2), color: "text-emerald-600" },
                  { label: "TON", value: Number(wallet?.balanceTon ?? 0).toFixed(4), color: "text-sky-600" },
                ].map((b) => (
                  <div key={b.label} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="text-xs text-slate-500 mb-0.5">{b.label}</div>
                    <div className={`font-bold font-mono text-base ${b.color}`} dir="ltr">{b.value}</div>
                  </div>
                ))}
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-white">
                <div className="text-xs font-semibold text-slate-700 mb-3">تعديل رصيد SKZ يدوياً</div>
                <div className="flex gap-1 mb-3">
                  {(["credit", "debit"] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setAdjDir(d)}
                      className={`flex-1 py-1.5 text-xs rounded-lg font-semibold transition ${
                        adjDir === d
                          ? d === "credit" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {d === "credit" ? "+ إضافة SKZ" : "− خصم SKZ"}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  <input
                    type="number" min="0" step="0.01" value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="المبلغ (SKZ)"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 font-mono focus:ring-2 focus:ring-indigo-500"
                    dir="ltr"
                  />
                  <input
                    type="text" value={adjReason}
                    onChange={(e) => setAdjReason(e.target.value)}
                    placeholder={adjDir === "credit" ? "السبب: مكافأة، تعويض…" : "السبب: تصحيح، رسوم…"}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={() => adjMut.mutate()}
                    disabled={adjMut.isPending || !amount || !adjReason.trim() || parseFloat(amount) <= 0}
                    className={`w-full py-2 text-sm rounded-lg text-white font-semibold disabled:opacity-40 ${
                      adjDir === "credit" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"
                    }`}
                  >
                    {adjMut.isPending ? "…" : adjDir === "credit" ? "إضافة الرصيد" : "خصم الرصيد"}
                  </button>
                  {adjMsg && (
                    <div className={`text-xs px-3 py-2 rounded-lg ${adjMsg.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                      {adjMsg.text}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-700 mb-2">
                  آخر المعاملات{transactions.length > 0 ? ` (${transactions.length})` : ""}
                </div>
                {transactions.length === 0 ? (
                  <div className="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-xl">لا توجد معاملات</div>
                ) : (
                  <div className="space-y-1.5">
                    {transactions.slice(0, 10).map((t) => (
                      <div key={t.id} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-slate-800 truncate">{t.description ?? t.type}</div>
                          <div className="text-slate-400 mt-0.5">
                            {new Date(t.createdAt).toLocaleDateString("ar-EG")} · {t.type}
                          </div>
                        </div>
                        <div
                          className={`font-mono font-semibold mr-3 shrink-0 ${
                            Number(t.amount) >= 0 ? "text-emerald-600" : "text-red-600"
                          }`}
                          dir="ltr"
                        >
                          {Number(t.amount) >= 0 ? "+" : ""}{Number(t.amount).toFixed(2)}{" "}
                          <span className="text-slate-400 font-normal">{t.currency}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </>
  );
}

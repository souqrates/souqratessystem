import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api, type SuperUser } from "@/lib/api";

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
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
        <p className="text-slate-500 mt-1">بحث وإدارة جميع مستخدمي البوتات</p>
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
                <tr key={u.id} className="hover:bg-slate-50">
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
                    {u.isPremium && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full mr-1">⭐ بريميوم</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/users/${u.telegramId}`}>
                      <a className="text-indigo-600 hover:underline font-medium">عرض</a>
                    </Link>
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
    </div>
  );
}

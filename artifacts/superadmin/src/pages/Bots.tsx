import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ExternalLink, Settings } from "lucide-react";
import { api, type Bot } from "@/lib/api";
import { botMeta } from "@/lib/bots-meta";

export default function BotsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "bots"],
    queryFn: () => api.get<{ data: Bot[] }>("/superadmin/bots"),
    refetchInterval: 15000,
  });

  const bots = data?.data ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto" dir="rtl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">البوتات</h1>
        <p className="text-slate-500 mt-1">
          قائمة بجميع البوتات المسجّلة — أسمائها على تيليغرام، روابطها، حالتها، وحجم المعاملات.
        </p>
      </header>

      {isLoading ? (
        <div className="py-20 text-center text-slate-400">جارٍ التحميل…</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-right">
                <th className="px-4 py-3 font-semibold text-slate-700">البوت</th>
                <th className="px-4 py-3 font-semibold text-slate-700">اسم Telegram</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Mini App</th>
                <th className="px-4 py-3 font-semibold text-slate-700">رابط t.me</th>
                <th className="px-4 py-3 font-semibold text-slate-700 text-center">الحالة</th>
                <th className="px-4 py-3 font-semibold text-slate-700">حجم المعاملات</th>
                <th className="px-4 py-3 font-semibold text-slate-700">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bots.map((bot) => {
                const meta = botMeta(bot.slug);
                const tmeLink = bot.botUsername
                  ? bot.miniAppName
                    ? `https://t.me/${bot.botUsername}/${bot.miniAppName}`
                    : `https://t.me/${bot.botUsername}`
                  : null;
                return (
                  <tr key={bot.slug} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div
                        className="font-semibold text-slate-900"
                        style={meta?.color ? { color: meta.color } : undefined}
                      >
                        {meta?.brand ?? bot.name}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">{bot.slug}</div>
                    </td>

                    <td className="px-4 py-3 font-mono text-slate-700 text-xs">
                      {bot.botUsername ? (
                        <span dir="ltr">@{bot.botUsername}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 font-mono text-slate-700 text-xs">
                      {bot.miniAppName ? (
                        <span dir="ltr">{bot.miniAppName}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {tmeLink ? (
                        <a
                          href={tmeLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                          dir="ltr"
                        >
                          {tmeLink.replace("https://", "")}
                          <ExternalLink size={10} />
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">غير مضبوط</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                          bot.isActive
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            bot.isActive ? "bg-emerald-500" : "bg-red-500"
                          }`}
                        />
                        {bot.isActive ? "نشط" : "معطّل"}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-700">
                      <div dir="ltr">
                        <span className="font-mono">
                          {parseFloat(bot.totalVolumeUsdt ?? "0").toLocaleString("en-US", {
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        <span className="text-slate-400 ml-1">USDT</span>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <Link href={`/bots/${bot.slug}`}>
                        <a className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline font-medium">
                          <Settings size={12} />
                          إعدادات
                        </a>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-500">
        لتعديل اسم البوت أو رابط Mini App أو نسبة العمولة، اضغط «إعدادات» بجانب البوت.
      </p>
    </div>
  );
}

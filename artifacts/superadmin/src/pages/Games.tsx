import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface GameStateSlice {
  isVisible: boolean;
  imageUrl: string;
  description: string;
  entryFee: string;
  winAmount: string;
  targetScore: number;
  maxScore: number;
  scorePerCorrect: number;
  scorePerWrong: number;
  texts: Record<string, unknown>;
  params: Record<string, unknown>;
}
export interface GameConfigRow {
  id: number;
  gameId: number;
  name: string;
  emoji: string;
  difficulty: string;
  color: string;
  draft: GameStateSlice;
  published: GameStateSlice;
  hasUnpublishedChanges: boolean;
  updatedAt: string;
  publishedAt: string | null;
}

const DIFF_FILTERS = ["all", "Easy", "Medium", "Hard"] as const;
const VIS_FILTERS = ["all", "visible", "hidden", "draft"] as const;

export default function GamesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "games"],
    queryFn: () => api.get<{ data: GameConfigRow[] }>("/superadmin/games"),
  });

  const [search, setSearch] = useState("");
  const [diff, setDiff] = useState<(typeof DIFF_FILTERS)[number]>("all");
  const [vis, setVis] = useState<(typeof VIS_FILTERS)[number]>("all");

  const games = data?.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return games.filter((g) => {
      if (diff !== "all" && g.difficulty !== diff) return false;
      if (vis === "visible" && !g.published.isVisible) return false;
      if (vis === "hidden" && g.published.isVisible) return false;
      if (vis === "draft" && !g.hasUnpublishedChanges) return false;
      if (q) {
        return (
          g.name.toLowerCase().includes(q) ||
          String(g.gameId).includes(q) ||
          g.published.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [games, search, diff, vis]);

  const stats = useMemo(
    () => ({
      total: games.length,
      visible: games.filter((g) => g.published.isVisible).length,
      hidden: games.filter((g) => !g.published.isVisible).length,
      drafts: games.filter((g) => g.hasUnpublishedChanges).length,
    }),
    [games],
  );

  return (
    <div className="p-8 max-w-7xl mx-auto" dir="rtl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">🎮 إدارة ألعاب SOUQRATES SKILLZ</h1>
        <p className="text-slate-500 mt-1">
          التحكم الكامل في كل لعبة: السعر، المكافأة، السكور، النصوص، الصورة، الظهور — التعديلات تُحفظ كـ <b>مسودة</b> ولا تظهر للمستخدمين إلا بعد <b>النشر</b>.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="إجمالي الألعاب" value={stats.total} color="bg-slate-100 text-slate-900" />
        <Stat label="ظاهرة للمستخدمين" value={stats.visible} color="bg-emerald-50 text-emerald-700" />
        <Stat label="مخفية" value={stats.hidden} color="bg-amber-50 text-amber-700" />
        <Stat label="عليها تعديلات غير منشورة" value={stats.drafts} color="bg-indigo-50 text-indigo-700" />
      </div>

      <section className="bg-white border border-slate-200 rounded-2xl p-4 mb-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <input
            placeholder="بحث بالاسم أو المعرف…"
            className="flex-1 px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white"
            value={diff}
            onChange={(e) => setDiff(e.target.value as typeof diff)}
          >
            {DIFF_FILTERS.map((d) => (
              <option key={d} value={d}>
                {d === "all" ? "كل الصعوبات" : d}
              </option>
            ))}
          </select>
          <select
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white"
            value={vis}
            onChange={(e) => setVis(e.target.value as typeof vis)}
          >
            <option value="all">كل الحالات</option>
            <option value="visible">ظاهرة فقط</option>
            <option value="hidden">مخفية فقط</option>
            <option value="draft">عليها مسودة</option>
          </select>
          <div className="text-sm text-slate-500 md:mr-2">
            النتائج: <span className="font-bold text-slate-900">{filtered.length}</span>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">جارٍ التحميل…</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <Th>#</Th>
                <Th>اللعبة</Th>
                <Th>الصعوبة</Th>
                <Th>سعر الدخول</Th>
                <Th>مكافأة الفوز</Th>
                <Th>سكور الفوز</Th>
                <Th>ظاهرة؟</Th>
                <Th>الحالة</Th>
                <Th>إجراء</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center text-slate-400 py-8">
                    لا توجد ألعاب مطابقة
                  </td>
                </tr>
              )}
              {filtered.map((g) => (
                <GameRow key={g.gameId} g={g} onChanged={() => qc.invalidateQueries({ queryKey: ["superadmin", "games"] })} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function GameRow({ g, onChanged }: { g: GameConfigRow; onChanged: () => void }) {
  const toggleMut = useMutation({
    mutationFn: async (newVisible: boolean) => {
      // Update draft then publish immediately (visibility is critical to be live fast)
      await api.put(`/superadmin/games/${g.gameId}/draft`, {
        isVisible: newVisible,
        imageUrl: g.draft.imageUrl,
        description: g.draft.description,
        entryFee: g.draft.entryFee,
        winAmount: g.draft.winAmount,
        targetScore: g.draft.targetScore,
        maxScore: g.draft.maxScore,
        scorePerCorrect: g.draft.scorePerCorrect,
        scorePerWrong: g.draft.scorePerWrong,
        texts: g.draft.texts,
        params: g.draft.params,
      });
      await api.post(`/superadmin/games/${g.gameId}/publish`);
    },
    onSuccess: onChanged,
  });

  return (
    <tr className="border-t border-slate-100 hover:bg-slate-50/60">
      <Td className="font-mono text-slate-400" dir="ltr">{g.gameId}</Td>
      <Td>
        <div className="flex items-center gap-2">
          <span className="text-xl">{g.emoji}</span>
          <span className="font-semibold text-slate-900">{g.name}</span>
        </div>
      </Td>
      <Td>
        <span className={`text-xs px-2 py-0.5 rounded ${diffPill(g.difficulty)}`}>
          {g.difficulty}
        </span>
      </Td>
      <Td className="font-mono">{Number(g.published.entryFee)} <span className="text-xs text-slate-400">SKZ</span></Td>
      <Td className="font-mono text-emerald-700">{Number(g.published.winAmount)} <span className="text-xs text-slate-400">SKZ</span></Td>
      <Td className="font-mono">{g.published.targetScore || "—"}</Td>
      <Td>
        <button
          onClick={() => toggleMut.mutate(!g.published.isVisible)}
          disabled={toggleMut.isPending}
          className={`px-3 py-1 rounded-full text-xs font-bold transition ${
            g.published.isVisible
              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
              : "bg-slate-200 text-slate-500 hover:bg-slate-300"
          }`}
          title="نقرة واحدة = إخفاء/إظهار فوري للمستخدمين"
        >
          {toggleMut.isPending ? "…" : g.published.isVisible ? "✓ ظاهرة" : "✗ مخفية"}
        </button>
      </Td>
      <Td>
        {g.hasUnpublishedChanges ? (
          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">
            ⚠ مسودة غير منشورة
          </span>
        ) : (
          <span className="text-xs text-emerald-600">منشورة</span>
        )}
      </Td>
      <Td>
        <Link href={`/games/${g.gameId}`}>
          <a className="text-indigo-600 hover:underline text-sm font-semibold">تعديل ←</a>
        </Link>
      </Td>
    </tr>
  );
}

function diffPill(d: string): string {
  if (d === "Easy") return "bg-emerald-100 text-emerald-700";
  if (d === "Hard") return "bg-rose-100 text-rose-700";
  return "bg-amber-100 text-amber-700";
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-2xl p-4 ${color}`}>
      <div className="text-3xl font-extrabold">{value}</div>
      <div className="text-xs mt-1 opacity-80">{label}</div>
    </div>
  );
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-right font-semibold px-4 py-2.5">{children}</th>;
}
function Td({ children, className = "", dir }: { children: React.ReactNode; className?: string; dir?: "ltr" | "rtl" }) {
  return <td className={`px-4 py-2.5 ${className}`} dir={dir}>{children}</td>;
}

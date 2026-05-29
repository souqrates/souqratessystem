import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ── Types ────────────────────────────────────────────────────────────────────
interface PrizeTier { matchCount: number; multiplier: number; label: string; }
interface GameType {
  id: number; slug: string; name: string; nameAr: string;
  description: string; emoji: string; theme: string;
  priceSKZ: string; prizeTiers: PrizeTier[];
  jackpotContributionRate: string; isActive: boolean; sortOrder: number;
}
interface JackpotPool {
  id: number; balanceSkz: string;
  totalContributedSkz: string; totalPaidOutSkz: string;
}
interface LottoDraw {
  id: number; drawNumber: number; status: string;
  winningNumbers: number[] | null; jackpotAmountSkz: string;
  totalEntries: number; totalPaidOutSkz: string;
  opensAt: string; closesAt: string | null; drawnAt: string | null;
  serverSeedHash: string | null;
}
interface LottoEntry {
  id: number; drawId: number; userId: number;
  chosenNumbers: number[]; priceSKZ: string;
  matchCount: number | null; prizeSkz: string | null; isJackpot: boolean | null;
  createdAt: string;
  telegramId: string | null; username: string | null; firstName: string | null;
}
interface DrawEntriesResponse {
  draw: LottoDraw;
  data: LottoEntry[];
  total: number; page: number; limit: number;
  winnersCount: number;
}
interface TopGame {
  gameTypeId: number; name: string; nameAr: string; slug: string;
  count: number; totalRevenue: string; totalPrizes: string; winCount: number;
}
interface SweepStats {
  totalTickets: number; totalWinTickets: number; totalLoseTickets: number;
  winRate: number; totalRevenueSKZ: string; totalPrizesSKZ: string;
  topGames: TopGame[];
  jackpot: JackpotPool;
  recentDraws: LottoDraw[];
}
interface TicketRow {
  ticket: {
    id: number; serverSeedHash: string; serverSeed: string | null;
    clientSeed: string; result: unknown; prizeSkz: string; isWin: boolean;
    priceSKZ: string; status: string; playedAt: string | null; createdAt: string;
  };
  telegramId: string | null;
  username: string | null;
  firstName: string | null;
  gameTypeName: string | null;
  gameTypeNameAr: string | null;
  gameTypeSlug: string | null;
}

// ── API helpers ───────────────────────────────────────────────────────────────
const sweepApi = {
  getStats: () => api.get<SweepStats>("/superadmin/sweep/stats"),
  getGameTypes: () => api.get<{ data: GameType[] }>("/superadmin/sweep/game-types"),
  createGameType: (body: Partial<GameType>) => api.post("/superadmin/sweep/game-types", body),
  updateGameType: (id: number, body: Partial<GameType>) => api.patch(`/superadmin/sweep/game-types/${id}`, body),
  deleteGameType: (id: number) => api.del(`/superadmin/sweep/game-types/${id}`),
  getTickets: (params: string) => api.get<{ data: TicketRow[]; total: number; page: number }>(`/superadmin/sweep/tickets?${params}`),
  getDraws: () => api.get<{ data: LottoDraw[] }>("/superadmin/sweep/lotto/draws"),
  getDrawEntries: (drawId: number, page = 1) =>
    api.get<DrawEntriesResponse>(`/superadmin/sweep/lotto/draws/${drawId}/entries?page=${page}&limit=100`),
  triggerDraw: (drawId?: number) => api.post<{ draw: LottoDraw; winningNumbers: number[]; winners: Array<{ entryId: number; userId: number; matchCount: number; prizeSkz: number }>; totalPaidOut: number; jackpotWon: boolean }>("/superadmin/sweep/lotto/trigger-draw", drawId ? { drawId } : {}),
  openDraw: (closesAt?: string) => api.post("/superadmin/sweep/lotto/open", { closesAt }),
  getJackpot: () => api.get<JackpotPool>("/superadmin/sweep/jackpot"),
  setJackpot: (bal: number) => api.patch("/superadmin/sweep/jackpot", { balanceSkz: bal }),
};

// ── Tab navigation ─────────────────────────────────────────────────────────────
const TABS = ["📊 إحصاءات", "🎲 أنواع الألعاب", "🎟 التذاكر", "🎱 اللوتو"] as const;
type Tab = typeof TABS[number];

export default function SweepPage() {
  const [tab, setTab] = useState<Tab>("🎱 اللوتو");

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          🎰 <span style={{ color: "#f59e0b" }}>SOUQRATES SWEEP</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1">ألعاب الحظ واليانصيب — إدارة الألعاب والتذاكر واللوتو</p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-slate-700 pb-0">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition -mb-px border-b-2 ${
              tab === t
                ? "border-amber-400 text-amber-400 bg-slate-800"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "📊 إحصاءات" && <StatsTab />}
      {tab === "🎲 أنواع الألعاب" && <GameTypesTab />}
      {tab === "🎟 التذاكر" && <TicketsTab />}
      {tab === "🎱 اللوتو" && <LottoTab />}
    </div>
  );
}

// ── Stats Tab ─────────────────────────────────────────────────────────────────
function StatsTab() {
  const { data, isLoading } = useQuery({ queryKey: ["sweep-stats"], queryFn: sweepApi.getStats });
  if (isLoading) return <LoadingSpinner />;
  if (!data) return <div className="text-slate-400">لا توجد بيانات</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="إجمالي التذاكر" value={data.totalTickets.toLocaleString()} icon="🎟" />
        <StatCard label="التذاكر الفائزة" value={data.totalWinTickets.toLocaleString()} icon="🏆" color="text-green-400" />
        <StatCard label="نسبة الفوز" value={`${data.winRate}%`} icon="📊" color="text-blue-400" />
        <StatCard label="الجائزة الكبرى" value={`${parseFloat(data.jackpot.balanceSkz).toLocaleString()} SKZ`} icon="💎" color="text-amber-400" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard label="إجمالي الإيرادات" value={`${parseFloat(data.totalRevenueSKZ).toLocaleString()} SKZ`} icon="💰" />
        <StatCard label="إجمالي الجوائز الموزَّعة" value={`${parseFloat(data.totalPrizesSKZ).toLocaleString()} SKZ`} icon="🎁" />
      </div>

      <div className="bg-slate-800 rounded-xl p-5">
        <h2 className="text-base font-bold text-white mb-4">أكثر الألعاب شعبية</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 border-b border-slate-700">
              <th className="pb-2 text-right">اللعبة</th>
              <th className="pb-2 text-right">عدد التذاكر</th>
              <th className="pb-2 text-right">الإيرادات (SKZ)</th>
              <th className="pb-2 text-right">الجوائز (SKZ)</th>
              <th className="pb-2 text-right">نسبة الفوز</th>
            </tr>
          </thead>
          <tbody>
            {data.topGames.map((g: TopGame) => (
              <tr key={g.gameTypeId} className="border-b border-slate-700/50">
                <td className="py-2 font-medium text-white">{g.nameAr || g.name}</td>
                <td className="py-2 text-slate-300">{g.count.toLocaleString()}</td>
                <td className="py-2 text-slate-300">{parseFloat(g.totalRevenue).toLocaleString()}</td>
                <td className="py-2 text-slate-300">{parseFloat(g.totalPrizes).toLocaleString()}</td>
                <td className="py-2 text-slate-300">
                  {g.count > 0 ? ((g.winCount / g.count) * 100).toFixed(1) : "0"}%
                </td>
              </tr>
            ))}
            {data.topGames.length === 0 && (
              <tr><td colSpan={5} className="py-4 text-center text-slate-500">لا توجد بيانات بعد</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Game Types Tab ─────────────────────────────────────────────────────────────
function GameTypesTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["sweep-game-types"], queryFn: sweepApi.getGameTypes });
  const [editing, setEditing] = useState<GameType | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Partial<GameType>>({});

  const saveMut = useMutation({
    mutationFn: (d: Partial<GameType> & { id?: number }) =>
      d.id ? sweepApi.updateGameType(d.id, d) : sweepApi.createGameType(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sweep-game-types"] });
      setEditing(null); setCreating(false); setForm({});
    },
  });

  const delMut = useMutation({
    mutationFn: sweepApi.deleteGameType,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sweep-game-types"] }),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      sweepApi.updateGameType(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sweep-game-types"] }),
  });

  function startEdit(g: GameType) { setEditing(g); setForm(g); setCreating(false); }
  function startCreate() {
    setCreating(true); setEditing(null);
    setForm({ isActive: true, sortOrder: 0, emoji: "🎰", priceSKZ: "10", prizeTiers: [], jackpotContributionRate: "0.1000" });
  }

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-white">أنواع الألعاب ({data?.data.length ?? 0})</h2>
        <button onClick={startCreate} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold rounded-lg">
          + إضافة لعبة
        </button>
      </div>

      {(creating || editing) && (
        <div className="bg-slate-800 rounded-xl p-5 border border-amber-500/30">
          <h3 className="font-bold text-white mb-4">{creating ? "إضافة لعبة جديدة" : `تعديل: ${editing?.name}`}</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Field label="Slug (معرف اللعبة)" value={form.slug ?? ""} onChange={(v) => setForm({ ...form, slug: v })} disabled={!!editing} />
            <Field label="الاسم بالإنجليزية" value={form.name ?? ""} onChange={(v) => setForm({ ...form, name: v })} />
            <Field label="الاسم بالعربية" value={form.nameAr ?? ""} onChange={(v) => setForm({ ...form, nameAr: v })} />
            <Field label="السعر (SKZ)" value={String(form.priceSKZ ?? "")} onChange={(v) => setForm({ ...form, priceSKZ: v })} />
            <Field label="رمز تعبيري" value={form.emoji ?? ""} onChange={(v) => setForm({ ...form, emoji: v })} />
            <Field label="نسبة الجائزة الكبرى (0.10 = 10%)" value={String(form.jackpotContributionRate ?? "")} onChange={(v) => setForm({ ...form, jackpotContributionRate: v })} />
            <Field label="الترتيب" value={String(form.sortOrder ?? 0)} onChange={(v) => setForm({ ...form, sortOrder: Number(v) })} />
          </div>
          <div className="mb-4">
            <label className="text-xs text-slate-400 block mb-1">جداول الجوائز (JSON)</label>
            <textarea
              rows={4}
              value={JSON.stringify(form.prizeTiers ?? [], null, 2)}
              onChange={(e) => { try { setForm({ ...form, prizeTiers: JSON.parse(e.target.value) as PrizeTier[] }); } catch { /* ignore */ } }}
              className="w-full text-xs font-mono bg-slate-900 text-slate-200 border border-slate-700 rounded-lg p-3 focus:outline-none focus:border-amber-500"
            />
            <p className="text-xs text-slate-500 mt-1">مثال: {"[{\"matchCount\": 3, \"multiplier\": 5, \"label\": \"3 متطابق × 5\"}]"}</p>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setEditing(null); setCreating(false); }} className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg">إلغاء</button>
            <button
              onClick={() => saveMut.mutate({ ...form, id: editing?.id })}
              disabled={saveMut.isPending}
              className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg disabled:opacity-50"
            >
              {saveMut.isPending ? "جارٍ الحفظ…" : "حفظ"}
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {data?.data.map((g: GameType) => (
          <div key={g.id} className="bg-slate-800 rounded-xl p-4 flex items-center gap-4">
            <span className="text-3xl">{g.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">{g.nameAr || g.name}</span>
                <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{g.slug}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${g.isActive ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"}`}>
                  {g.isActive ? "مفعّل" : "معطّل"}
                </span>
              </div>
              <div className="text-sm text-slate-400 mt-0.5">
                السعر: <span className="text-amber-400">{g.priceSKZ} SKZ</span>
                {" · "}{g.prizeTiers.length} مستوى جائزة
                {" · "}جائزة كبرى: {(parseFloat(g.jackpotContributionRate) * 100).toFixed(0)}%
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => toggleMut.mutate({ id: g.id, isActive: !g.isActive })}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium ${g.isActive ? "bg-red-900/40 text-red-400 hover:bg-red-900/70" : "bg-green-900/40 text-green-400 hover:bg-green-900/70"}`}
              >
                {g.isActive ? "إيقاف" : "تفعيل"}
              </button>
              <button onClick={() => startEdit(g)} className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg">تعديل</button>
              <button
                onClick={() => { if (confirm("حذف هذه اللعبة؟")) delMut.mutate(g.id); }}
                className="text-xs px-3 py-1.5 bg-red-900/40 hover:bg-red-900/70 text-red-400 rounded-lg"
              >
                حذف
              </button>
            </div>
          </div>
        ))}
        {data?.data.length === 0 && <EmptyState message="لا توجد ألعاب بعد — أضف أول لعبة" />}
      </div>
    </div>
  );
}

// ── Tickets Tab ────────────────────────────────────────────────────────────────
function TicketsTab() {
  const [page, setPage] = useState(1);
  const [isWin, setIsWin] = useState<"" | "true" | "false">("");

  const params = new URLSearchParams({ page: String(page), limit: "50" });
  if (isWin) params.set("isWin", isWin);

  const { data, isLoading } = useQuery({
    queryKey: ["sweep-tickets", page, isWin],
    queryFn: () => sweepApi.getTickets(params.toString()),
  });

  const rows = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <h2 className="text-base font-bold text-white">سجل التذاكر ({data?.total ?? 0})</h2>
        <select
          value={isWin}
          onChange={(e) => { setIsWin(e.target.value as "" | "true" | "false"); setPage(1); }}
          className="text-sm bg-slate-800 border border-slate-600 text-slate-200 rounded-lg px-3 py-1.5"
        >
          <option value="">الكل</option>
          <option value="true">فائز فقط</option>
          <option value="false">خاسر فقط</option>
        </select>
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <div className="bg-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-slate-400 border-b border-slate-700">
              <tr>
                <th className="px-4 py-3 text-right">#</th>
                <th className="px-4 py-3 text-right">المستخدم</th>
                <th className="px-4 py-3 text-right">اللعبة</th>
                <th className="px-4 py-3 text-right">الدفع</th>
                <th className="px-4 py-3 text-right">الجائزة</th>
                <th className="px-4 py-3 text-right">النتيجة</th>
                <th className="px-4 py-3 text-right">التاريخ</th>
                <th className="px-4 py-3 text-right">التحقق</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: TicketRow) => (
                <tr key={r.ticket.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="px-4 py-2.5 text-slate-400">{r.ticket.id}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-white">{r.firstName ?? "—"}</div>
                    <div className="text-xs text-slate-500">{r.telegramId ?? ""}</div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-300">{r.gameTypeNameAr || r.gameTypeName || "—"}</td>
                  <td className="px-4 py-2.5 text-slate-300">{r.ticket.priceSKZ} SKZ</td>
                  <td className={`px-4 py-2.5 font-medium ${r.ticket.isWin ? "text-green-400" : "text-slate-500"}`}>
                    {r.ticket.isWin ? `${r.ticket.prizeSkz} SKZ` : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${r.ticket.isWin ? "bg-green-900/50 text-green-400" : "bg-slate-700 text-slate-400"}`}>
                      {r.ticket.isWin ? "فائز" : "خاسر"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">
                    {r.ticket.playedAt ? new Date(r.ticket.playedAt).toLocaleString("ar") : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <details className="text-xs">
                      <summary className="cursor-pointer text-slate-400 hover:text-white">عرض البذور</summary>
                      <div className="mt-1 space-y-1 bg-slate-900 p-2 rounded text-[11px] font-mono break-all">
                        <div><span className="text-slate-500">Hash:</span> {r.ticket.serverSeedHash}</div>
                        {r.ticket.serverSeed && <div><span className="text-slate-500">Seed:</span> {r.ticket.serverSeed}</div>}
                        <div><span className="text-slate-500">Client:</span> {r.ticket.clientSeed}</div>
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-slate-500">لا توجد تذاكر بعد</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {(data?.total ?? 0) > 50 && (
        <div className="flex gap-2 justify-center">
          <button disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg disabled:opacity-40">السابق</button>
          <span className="px-4 py-2 text-sm text-slate-400">صفحة {page}</span>
          <button disabled={rows.length < 50} onClick={() => setPage((p) => p + 1)} className="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg disabled:opacity-40">التالي</button>
        </div>
      )}
    </div>
  );
}

// ── Lotto Tab ──────────────────────────────────────────────────────────────────
function LottoTab() {
  const qc = useQueryClient();
  const { data: drawsData, isLoading: drawsLoading } = useQuery({ queryKey: ["sweep-draws"], queryFn: sweepApi.getDraws });
  const { data: jackpot, isLoading: jackpotLoading } = useQuery({ queryKey: ["sweep-jackpot"], queryFn: sweepApi.getJackpot });
  const [jackpotEdit, setJackpotEdit] = useState("");
  const [newDrawClosesAt, setNewDrawClosesAt] = useState("");
  const [selectedDrawId, setSelectedDrawId] = useState<number | null>(null);
  const [entriesPage, setEntriesPage] = useState(1);

  const triggerMut = useMutation({
    mutationFn: (drawId?: number) => sweepApi.triggerDraw(drawId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["sweep-draws"] });
      qc.invalidateQueries({ queryKey: ["sweep-jackpot"] });
      qc.invalidateQueries({ queryKey: ["sweep-stats"] });
      if (selectedDrawId) {
        qc.invalidateQueries({ queryKey: ["sweep-draw-entries", selectedDrawId] });
      }
    },
  });

  const openMut = useMutation({
    mutationFn: () => sweepApi.openDraw(newDrawClosesAt || undefined),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sweep-draws"] }); setNewDrawClosesAt(""); },
  });

  const jackpotMut = useMutation({
    mutationFn: (bal: number) => sweepApi.setJackpot(bal),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sweep-jackpot"] });
      qc.invalidateQueries({ queryKey: ["sweep-stats"] });
      setJackpotEdit("");
    },
  });

  const { data: entriesData, isLoading: entriesLoading } = useQuery({
    queryKey: ["sweep-draw-entries", selectedDrawId, entriesPage],
    queryFn: () => sweepApi.getDrawEntries(selectedDrawId!, entriesPage),
    enabled: selectedDrawId !== null,
  });

  const draws = drawsData?.data ?? [];
  const currentDraw = draws.find((d) => d.status === "open") ?? draws[0] ?? null;

  // Auto-select the current open draw on first load
  if (selectedDrawId === null && currentDraw) {
    setSelectedDrawId(currentDraw.id);
  }

  const selectedDraw = draws.find((d) => d.id === selectedDrawId) ?? null;

  return (
    <div className="space-y-6">
      {/* ── Top stats row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="الجائزة الكبرى الحالية"
          value={`${parseFloat(jackpot?.balanceSkz ?? "0").toLocaleString()} SKZ`}
          icon="💎"
          color="text-amber-400"
        />
        <StatCard
          label="إجمالي تذاكر السحب الحالي"
          value={(currentDraw?.totalEntries ?? 0).toLocaleString()}
          icon="🎫"
          color="text-blue-400"
        />
        <StatCard
          label="حجم الجائزة المجمّعة"
          value={`${(currentDraw ? parseFloat(currentDraw.jackpotAmountSkz) + parseFloat(jackpot?.balanceSkz ?? "0") : 0).toLocaleString()} SKZ`}
          icon="🏆"
          color="text-green-400"
        />
        <StatCard
          label="عدد السحوبات المنجزة"
          value={draws.filter((d) => d.status === "drawn").length.toLocaleString()}
          icon="✅"
        />
      </div>

      {/* ── Jackpot control ── */}
      <div className="bg-slate-800 rounded-xl p-5 border border-amber-500/20">
        <h2 className="font-bold text-white mb-3 flex items-center gap-2">💎 الجائزة الكبرى (Jackpot Pool)</h2>
        {jackpotLoading ? <LoadingSpinner /> : (
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <div className="text-3xl font-bold text-amber-400">{parseFloat(jackpot?.balanceSkz ?? "0").toLocaleString()} SKZ</div>
              <div className="text-xs text-slate-500 mt-0.5">
                إجمالي الإضافات: {parseFloat(jackpot?.totalContributedSkz ?? "0").toLocaleString()} SKZ
                {" · "}إجمالي المدفوع: {parseFloat(jackpot?.totalPaidOutSkz ?? "0").toLocaleString()} SKZ
              </div>
            </div>
            <div className="flex-1 flex items-center gap-2 min-w-48">
              <input
                type="number" min={0} step="0.01"
                placeholder="تعديل الرصيد يدوياً…"
                value={jackpotEdit}
                onChange={(e) => setJackpotEdit(e.target.value)}
                className="flex-1 text-sm bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2"
              />
              <button
                onClick={() => { const v = parseFloat(jackpotEdit); if (!isNaN(v)) jackpotMut.mutate(v); }}
                disabled={jackpotMut.isPending || !jackpotEdit}
                className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg disabled:opacity-50"
              >
                تحديث
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Open new draw ── */}
      <div className="bg-slate-800 rounded-xl p-5">
        <h2 className="font-bold text-white mb-3">🆕 فتح سحب جديد</h2>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-48">
            <label className="text-xs text-slate-400 block mb-1">تاريخ الإغلاق (اختياري)</label>
            <input
              type="datetime-local"
              value={newDrawClosesAt}
              onChange={(e) => setNewDrawClosesAt(e.target.value)}
              className="w-full text-sm bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2"
            />
          </div>
          <button
            onClick={() => openMut.mutate()}
            disabled={openMut.isPending}
            className="px-4 py-2 text-sm bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg disabled:opacity-50 whitespace-nowrap"
          >
            {openMut.isPending ? "جارٍ الفتح…" : "فتح سحب جديد"}
          </button>
        </div>
        {openMut.isError && (
          <p className="text-xs text-red-400 mt-2">{String((openMut.error as Error)?.message ?? "خطأ")}</p>
        )}
      </div>

      {/* ── Draws list with trigger ── */}
      <div className="bg-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-bold text-white">📋 سجل السحوبات</h2>
          <button
            onClick={() => {
              const active = draws.find((d) => d.status === "open" || d.status === "closed");
              if (!active) { alert("لا يوجد سحب قابل للتشغيل"); return; }
              if (confirm(`تشغيل السحب رقم ${active.drawNumber} الآن؟ سيتم توزيع الجوائز فوراً على ${active.totalEntries} مشترك.`)) {
                triggerMut.mutate(active.id);
              }
            }}
            disabled={triggerMut.isPending}
            className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg disabled:opacity-50"
          >
            {triggerMut.isPending ? "⏳ جارٍ السحب…" : "🎱 إجراء السحب الآن"}
          </button>
        </div>

        {/* Draw result banner */}
        {triggerMut.isSuccess && triggerMut.data && (
          <div className="mb-4 bg-gradient-to-l from-purple-900/40 to-green-900/40 border border-purple-700/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🎉</span>
              <span className="font-bold text-white">تم السحب بنجاح!</span>
              {triggerMut.data.jackpotWon && (
                <span className="bg-amber-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">🏆 فاز شخص بالجائزة الكبرى!</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {triggerMut.data.winningNumbers?.map((n: number) => (
                <span key={n} className="w-10 h-10 flex items-center justify-center rounded-full bg-amber-500 text-black font-bold text-sm">
                  {n}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="bg-slate-800/60 rounded-lg p-2 text-center">
                <div className="text-xl font-bold text-green-400">{triggerMut.data.winners?.length ?? 0}</div>
                <div className="text-xs text-slate-400">عدد الفائزين</div>
              </div>
              <div className="bg-slate-800/60 rounded-lg p-2 text-center">
                <div className="text-xl font-bold text-amber-400">{(triggerMut.data.totalPaidOut ?? 0).toLocaleString()}</div>
                <div className="text-xs text-slate-400">SKZ موزَّعة</div>
              </div>
              <div className="bg-slate-800/60 rounded-lg p-2 text-center">
                <div className="text-xl font-bold text-blue-400">{triggerMut.data.draw?.totalEntries ?? 0}</div>
                <div className="text-xs text-slate-400">إجمالي المشتركين</div>
              </div>
            </div>
            {(triggerMut.data.winners?.length ?? 0) > 0 && (
              <div className="mt-3">
                <p className="text-xs text-slate-400 mb-2">الفائزون:</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {triggerMut.data.winners.map((w) => (
                    <div key={w.entryId} className="flex items-center justify-between text-xs bg-slate-800/60 rounded px-2 py-1">
                      <span className="text-slate-300">مشترك #{w.userId}</span>
                      <span className="text-green-400 font-medium">{w.matchCount} أرقام متطابقة</span>
                      <span className="text-amber-400 font-bold">{w.prizeSkz.toLocaleString()} SKZ</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {triggerMut.isError && (
          <div className="mb-4 bg-red-900/30 border border-red-700 rounded-lg p-3 text-sm text-red-300">
            ❌ فشل السحب: {String((triggerMut.error as Error)?.message ?? "خطأ غير معروف")}
          </div>
        )}

        {drawsLoading ? <LoadingSpinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="pb-2 px-2 text-right">#</th>
                  <th className="pb-2 px-2 text-right">الحالة</th>
                  <th className="pb-2 px-2 text-right">الأرقام الفائزة</th>
                  <th className="pb-2 px-2 text-right">المشتركون</th>
                  <th className="pb-2 px-2 text-right">الجائزة الكبرى</th>
                  <th className="pb-2 px-2 text-right">الجوائز المدفوعة</th>
                  <th className="pb-2 px-2 text-right">تاريخ السحب</th>
                  <th className="pb-2 px-2 text-right">الاشتراكات</th>
                </tr>
              </thead>
              <tbody>
                {draws.map((d: LottoDraw) => (
                  <tr
                    key={d.id}
                    className={`border-b border-slate-700/50 transition-colors ${
                      selectedDrawId === d.id ? "bg-slate-700/40" : "hover:bg-slate-700/20"
                    }`}
                  >
                    <td className="py-2.5 px-2 text-slate-300 font-mono font-bold">{d.drawNumber}</td>
                    <td className="py-2.5 px-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        d.status === "open" ? "bg-green-900/50 text-green-400" :
                        d.status === "drawn" ? "bg-blue-900/50 text-blue-400" :
                        d.status === "processing" ? "bg-yellow-900/50 text-yellow-400" :
                        "bg-slate-700 text-slate-400"
                      }`}>
                        {d.status === "open" ? "مفتوح" :
                         d.status === "drawn" ? "منجز" :
                         d.status === "processing" ? "جارٍ السحب" :
                         d.status === "closed" ? "مغلق" : d.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-2">
                      {d.winningNumbers ? (
                        <div className="flex flex-wrap gap-1">
                          {d.winningNumbers.map((n) => (
                            <span key={n} className="w-6 h-6 flex items-center justify-center rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold border border-amber-500/40">
                              {n}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-600 text-xs">لم يُجرَ السحب بعد</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-slate-300 font-medium">{d.totalEntries.toLocaleString()}</td>
                    <td className="py-2.5 px-2 text-slate-300 text-xs">{parseFloat(d.jackpotAmountSkz).toLocaleString()} SKZ</td>
                    <td className="py-2.5 px-2 text-xs">
                      <span className={parseFloat(d.totalPaidOutSkz) > 0 ? "text-green-400 font-medium" : "text-slate-500"}>
                        {parseFloat(d.totalPaidOutSkz).toLocaleString()} SKZ
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-xs text-slate-500">
                      {d.drawnAt ? new Date(d.drawnAt).toLocaleString("ar") : "—"}
                    </td>
                    <td className="py-2.5 px-2">
                      <button
                        onClick={() => {
                          if (selectedDrawId === d.id) {
                            setSelectedDrawId(null);
                          } else {
                            setSelectedDrawId(d.id);
                            setEntriesPage(1);
                          }
                        }}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                          selectedDrawId === d.id
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                            : "bg-slate-700 hover:bg-slate-600 text-slate-300"
                        }`}
                      >
                        {selectedDrawId === d.id ? "إخفاء ▲" : "عرض ▼"}
                      </button>
                    </td>
                  </tr>
                ))}
                {draws.length === 0 && (
                  <tr><td colSpan={8} className="py-8 text-center text-slate-500">لا توجد سحوبات بعد</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Draw entries panel ── */}
      {selectedDrawId !== null && (
        <DrawEntriesPanel
          draw={selectedDraw}
          data={entriesData}
          isLoading={entriesLoading}
          page={entriesPage}
          onPageChange={(p) => setEntriesPage(p)}
        />
      )}
    </div>
  );
}

// ── Draw Entries Panel ─────────────────────────────────────────────────────────
function DrawEntriesPanel({
  draw,
  data,
  isLoading,
  page,
  onPageChange,
}: {
  draw: LottoDraw | null;
  data: DrawEntriesResponse | undefined;
  isLoading: boolean;
  page: number;
  onPageChange: (p: number) => void;
}) {
  const entries = data?.data ?? [];
  const winningNums = draw?.winningNumbers ? new Set(draw.winningNumbers) : null;

  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-600/50">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="font-bold text-white flex items-center gap-2">
            📋 اشتراكات السحب رقم {draw?.drawNumber ?? "—"}
            <span className="text-xs font-normal text-slate-400">
              ({data?.total ?? 0} اشتراك)
            </span>
          </h2>
          {draw?.serverSeedHash && (
            <p className="text-xs text-slate-500 mt-0.5 font-mono break-all">
              Hash: {draw.serverSeedHash}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {data && (
            <>
              <div className="bg-blue-900/30 border border-blue-700/40 rounded-lg px-3 py-1.5 text-center">
                <div className="text-lg font-bold text-blue-400">{data.total}</div>
                <div className="text-xs text-slate-400">إجمالي التذاكر</div>
              </div>
              <div className="bg-green-900/30 border border-green-700/40 rounded-lg px-3 py-1.5 text-center">
                <div className="text-lg font-bold text-green-400">{data.winnersCount}</div>
                <div className="text-xs text-slate-400">الفائزون</div>
              </div>
              <div className="bg-amber-900/30 border border-amber-700/40 rounded-lg px-3 py-1.5 text-center">
                <div className="text-lg font-bold text-amber-400">
                  {data.total > 0 ? parseFloat(((data.winnersCount / data.total) * 100).toFixed(1)) : 0}%
                </div>
                <div className="text-xs text-slate-400">نسبة الفوز</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Winning numbers display */}
      {draw?.winningNumbers && (
        <div className="mb-4 bg-gradient-to-l from-amber-900/20 to-purple-900/20 border border-amber-700/30 rounded-xl p-4">
          <p className="text-xs text-slate-400 mb-2">الأرقام الفائزة:</p>
          <div className="flex flex-wrap gap-2">
            {draw.winningNumbers.map((n) => (
              <span
                key={n}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-amber-500 text-black font-bold text-sm shadow-lg"
              >
                {n}
              </span>
            ))}
          </div>
        </div>
      )}

      {isLoading ? <LoadingSpinner /> : entries.length === 0 ? (
        <EmptyState message="لا توجد اشتراكات في هذا السحب بعد" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400 border-b border-slate-700">
              <tr>
                <th className="pb-2 px-3 text-right">#</th>
                <th className="pb-2 px-3 text-right">المستخدم</th>
                <th className="pb-2 px-3 text-right">الأرقام المختارة</th>
                {draw?.winningNumbers && (
                  <>
                    <th className="pb-2 px-3 text-right">تطابق</th>
                    <th className="pb-2 px-3 text-right">الجائزة</th>
                  </>
                )}
                <th className="pb-2 px-3 text-right">تاريخ الاشتراك</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e: LottoEntry) => {
                const isWinner = (e.matchCount ?? 0) >= 3;
                const isJackpot = e.isJackpot;
                return (
                  <tr
                    key={e.id}
                    className={`border-b border-slate-700/50 ${
                      isJackpot ? "bg-amber-900/20" :
                      isWinner ? "bg-green-900/10" : ""
                    }`}
                  >
                    <td className="py-2.5 px-3 text-slate-500 text-xs">{e.id}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-white text-sm">{e.firstName ?? "—"}</div>
                      <div className="text-xs text-slate-500">
                        {e.username ? `@${e.username}` : e.telegramId ?? ""}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex flex-wrap gap-1">
                        {(e.chosenNumbers ?? []).map((n: number) => {
                          const isMatch = winningNums?.has(n);
                          return (
                            <span
                              key={n}
                              className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold transition ${
                                isMatch
                                  ? "bg-amber-500 text-black shadow-md"
                                  : "bg-slate-700 text-slate-300"
                              }`}
                            >
                              {n}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    {draw?.winningNumbers && (
                      <>
                        <td className="py-2.5 px-3">
                          {e.matchCount !== null ? (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                              e.matchCount === 6 ? "bg-amber-500 text-black" :
                              e.matchCount >= 3 ? "bg-green-900/50 text-green-400" :
                              "bg-slate-700 text-slate-400"
                            }`}>
                              {e.matchCount} ✓
                            </span>
                          ) : "—"}
                        </td>
                        <td className="py-2.5 px-3">
                          {isJackpot ? (
                            <span className="text-xs font-bold text-amber-400">🏆 جائزة كبرى</span>
                          ) : parseFloat(e.prizeSkz ?? "0") > 0 ? (
                            <span className="text-xs font-medium text-green-400">
                              {parseFloat(e.prizeSkz ?? "0").toLocaleString()} SKZ
                            </span>
                          ) : (
                            <span className="text-xs text-slate-600">—</span>
                          )}
                        </td>
                      </>
                    )}
                    <td className="py-2.5 px-3 text-xs text-slate-500">
                      {new Date(e.createdAt).toLocaleString("ar")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {(data?.total ?? 0) > (data?.limit ?? 100) && (
        <div className="flex gap-2 justify-center mt-4">
          <button disabled={page === 1} onClick={() => onPageChange(Math.max(1, page - 1))} className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg disabled:opacity-40">السابق</button>
          <span className="px-4 py-2 text-sm text-slate-400">صفحة {page} من {Math.ceil((data?.total ?? 1) / (data?.limit ?? 100))}</span>
          <button disabled={entries.length < (data?.limit ?? 100)} onClick={() => onPageChange(page + 1)} className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg disabled:opacity-40">التالي</button>
        </div>
      )}
    </div>
  );
}

// ── Shared UI helpers ──────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color = "text-white" }: { label: string; value: string; icon: string; color?: string }) {
  return (
    <div className="bg-slate-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function Field({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div>
      <label className="text-xs text-slate-400 block mb-1">{label}</label>
      <input
        type="text" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
        className="w-full text-sm bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 disabled:opacity-50 focus:outline-none focus:border-amber-500"
      />
    </div>
  );
}

function LoadingSpinner() {
  return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" /></div>;
}

function EmptyState({ message }: { message: string }) {
  return <div className="bg-slate-800 rounded-xl p-8 text-center text-slate-500">{message}</div>;
}

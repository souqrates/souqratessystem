import "./index.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { getActive, type ActivePayload, type Contestant, type VotePack } from "@/lib/api";
import { fmtInt, fmtSkz, pct } from "@/lib/format";

const BOT_USERNAME = "Souqrates_stage_bot";
const POLL_MS = 3000;
const ACTIVITY_WINDOW_MS = 60_000; // rolling 60s window for the live ticker

function BotLink({ children, payload, className }: { children: React.ReactNode; payload?: string; className?: string }) {
  const href = payload
    ? `https://t.me/${BOT_USERNAME}?start=${encodeURIComponent(payload)}`
    : `https://t.me/${BOT_USERNAME}`;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-30 backdrop-blur-xl bg-stage-bg/70 border-b border-stage-line">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-stage-gold to-amber-700 grid place-items-center text-black font-black text-lg shadow-lg">★</div>
          <div className="leading-tight">
            <div className="text-lg font-extrabold tracking-wide text-glow-gold">SOUQRATES STAGE</div>
            <div className="text-[11px] text-stage-mute">مسرح المسابقات والتصويت</div>
          </div>
        </div>
        <BotLink className="btn-primary text-sm hidden sm:inline-flex">افتح البوت</BotLink>
      </div>
    </header>
  );
}

/**
 * Compact activity ticker: shows how many votes arrived in each of the
 * last 12 buckets (~5s buckets over a 60s window). Pure visual signal
 * that "things are happening".
 */
function ActivityTicker({ buckets }: { buckets: number[] }) {
  const max = Math.max(1, ...buckets);
  return (
    <div className="flex items-end gap-0 h-8 px-1" title="نشاط آخر 60 ثانية">
      {buckets.map((v, i) => (
        <span
          key={i}
          className="activity-bar"
          style={{ height: `${Math.max(8, (v / max) * 100)}%`, opacity: v === 0 ? 0.25 : 0.95 }}
        />
      ))}
    </div>
  );
}

function Hero({
  contest,
  totalVotes,
  live,
  votesLastMinute,
  buckets,
}: {
  contest: NonNullable<ActivePayload["contest"]>;
  totalVotes: number;
  live: boolean;
  votesLastMinute: number;
  buckets: number[];
}) {
  return (
    <section className="relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 pt-8 pb-6">
        <div className="panel p-6 md:p-8 glow-gold">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="chip"><span className="pulse-dot" /> {live ? "بث مباشر" : "مسابقة نشطة"}</span>
            {votesLastMinute > 0 && (
              <span className="chip" style={{ background: "rgba(52,211,153,.10)", borderColor: "rgba(52,211,153,.35)", color: "#6ee7b7" }}>
                ⚡ {fmtInt(votesLastMinute)} صوت / آخر دقيقة
              </span>
            )}
            {contest.endsAt && (
              <span className="text-xs text-stage-mute">
                ينتهي: {new Date(contest.endsAt).toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold leading-tight text-glow-gold">
            {contest.title}
          </h1>
          {contest.description && (
            <p className="text-stage-mute mt-3 max-w-3xl leading-relaxed">{contest.description}</p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="px-4 py-2 rounded-xl bg-black/30 border border-stage-line">
              <div className="text-[11px] text-stage-mute">إجمالي الأصوات</div>
              <div className="text-2xl font-extrabold num-anim" key={totalVotes}>{fmtInt(totalVotes)}</div>
            </div>
            <div className="px-4 py-2 rounded-xl bg-black/30 border border-stage-line">
              <div className="text-[11px] text-stage-mute">نشاط لحظي</div>
              <ActivityTicker buckets={buckets} />
            </div>
            <BotLink className="btn-primary" payload="vote">🗳 صَوِّت الآن</BotLink>
            <BotLink className="btn-ghost" payload="packs">🎟 باقات التصويت</BotLink>
          </div>
          <div className="mt-3 text-xs text-stage-mute">🎁 صوت مجاني واحد لكل مستخدم يوميًا — استخدمه قبل أن ينتهي!</div>
        </div>
      </div>
    </section>
  );
}

type RowMeta = {
  rank: number;
  prevRank: number | null;
  voteDelta: number;     // votes gained since last poll
  isNew: boolean;        // never seen before in our session
};

function RankDelta({ meta }: { meta: RowMeta }) {
  if (meta.isNew) return <span className="badge-new">✨ جديد</span>;
  if (meta.prevRank === null) return <span className="delta-flat">—</span>;
  const delta = meta.prevRank - meta.rank; // positive = climbed
  if (delta === 0) return <span className="delta-flat">— ثابت</span>;
  if (delta > 0) return <span className="delta-up">▲ {delta}</span>;
  return <span className="delta-down">▼ {Math.abs(delta)}</span>;
}

function ContestantRow({
  c,
  meta,
  totalVotes,
}: {
  c: Contestant;
  meta: RowMeta;
  totalVotes: number;
}) {
  const p = pct(Number(c.voteCount), totalVotes);
  const medal = meta.rank === 0 ? "🥇" : meta.rank === 1 ? "🥈" : meta.rank === 2 ? "🥉" : `#${meta.rank + 1}`;
  const rankDelta = meta.prevRank !== null ? meta.prevRank - meta.rank : 0;

  // Highlight class chosen by behavior since last poll.
  let flash = "";
  if (rankDelta >= 1) flash = "row-rise";
  else if (rankDelta <= -1) flash = "row-fall";

  return (
    <div
      className={`panel p-4 flex items-center gap-4 row-anim ${meta.rank < 3 ? "glow-gold" : ""} ${flash}`}
      style={{ position: "relative" }}
      key={`flash-${c.id}-${meta.rank}-${meta.voteDelta}`}
    >
      {meta.voteDelta > 0 && (
        <span className="vote-pop" key={`vp-${c.id}-${c.voteCount}`}>+{meta.voteDelta}</span>
      )}
      <div className="w-12 text-center text-xl font-extrabold text-stage-gold tabular-nums">{medal}</div>
      <div className="w-14 h-14 rounded-xl overflow-hidden bg-stage-panel border border-stage-line shrink-0 grid place-items-center text-2xl">
        {c.photoUrl ? (
          <img src={c.photoUrl} alt={c.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <span>🎭</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-bold text-base truncate">{c.name}</h3>
          {c.isDisqualified && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">مستبعد</span>}
          {rankDelta >= 2 && <span className="badge-rising">🔥 صاعد</span>}
          {rankDelta <= -2 && <span className="badge-falling">❄️ هابط</span>}
          <RankDelta meta={meta} />
        </div>
        {c.bio && <p className="text-xs text-stage-mute truncate">{c.bio}</p>}
        <div className="mt-2 bar-track"><div className="bar-fill" style={{ width: `${p}%` }} /></div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-lg font-extrabold num-anim" key={c.voteCount}>{fmtInt(c.voteCount)}</div>
        <div className="text-[11px] text-stage-mute">{p.toFixed(1)}%</div>
      </div>
      <BotLink className="btn-primary text-sm hidden md:inline-flex" payload={`vote_${c.id}`}>صوِّت</BotLink>
    </div>
  );
}

function Leaderboard({
  contestants,
  totalVotes,
  metaById,
}: {
  contestants: Contestant[];
  totalVotes: number;
  metaById: Map<number, RowMeta>;
}) {
  const sorted = useMemo(
    () => [...contestants].sort((a, b) => Number(b.voteCount) - Number(a.voteCount) || a.sortOrder - b.sortOrder),
    [contestants],
  );
  return (
    <section className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-extrabold flex items-center gap-2">🏆 لوحة المتسابقين المباشرة</h2>
        <span className="text-xs text-stage-mute flex items-center gap-2">
          <span className="pulse-dot" /> تحديث كل {POLL_MS / 1000} ثوانٍ
        </span>
      </div>
      {sorted.length === 0 ? (
        <div className="panel p-8 text-center text-stage-mute">لا يوجد متسابقون بعد.</div>
      ) : (
        <div className="grid gap-3">
          {sorted.map((c) => {
            const meta = metaById.get(c.id) ?? { rank: 0, prevRank: null, voteDelta: 0, isNew: true };
            return <ContestantRow key={c.id} c={c} meta={meta} totalVotes={totalVotes} />;
          })}
        </div>
      )}
    </section>
  );
}

function PackCard({ p }: { p: VotePack }) {
  const total = p.votes + (p.bonusVotes || 0);
  return (
    <div className="panel p-5 flex flex-col gap-3 hover:translate-y-[-2px] transition-transform">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-stage-mute">باقة</div>
          <h3 className="text-lg font-extrabold">{p.name}</h3>
        </div>
        {p.bonusFileUrl && (
          <span className="text-[10px] px-2 py-1 rounded-full bg-stage-cyan/20 text-stage-cyan border border-stage-cyan/30">🎁 ملف مكافأة</span>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-black text-stage-gold text-glow-gold">{fmtInt(total)}</span>
        <span className="text-sm text-stage-mute">صوت</span>
        {p.bonusVotes > 0 && (
          <span className="text-[11px] text-stage-green">(+{p.bonusVotes} مكافأة)</span>
        )}
      </div>
      {p.description && <p className="text-xs text-stage-mute">{p.description}</p>}
      {p.bonusDescription && (
        <div className="text-[11px] px-3 py-2 rounded-lg bg-stage-cyan/5 border border-stage-cyan/20 text-stage-cyan">
          🎁 {p.bonusDescription}
        </div>
      )}
      <div className="mt-auto flex items-center justify-between pt-2 border-t border-stage-line">
        <div>
          <div className="text-[10px] text-stage-mute">السعر</div>
          <div className="text-lg font-extrabold">{fmtSkz(p.priceSkz)} <span className="text-xs text-stage-mute">SKZ</span></div>
        </div>
        <BotLink className="btn-primary text-sm" payload={`buy_${p.id}`}>اشترِ الآن</BotLink>
      </div>
    </div>
  );
}

function Packs({ packs }: { packs: VotePack[] }) {
  if (!packs.length) return null;
  return (
    <section className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-extrabold flex items-center gap-2">🎟 باقات التصويت</h2>
        <span className="text-xs text-stage-mute">الدفع برصيد SKZ من البوت الأم</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {packs.map((p) => <PackCard key={p.id} p={p} />)}
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <section className="max-w-3xl mx-auto px-4 py-20 text-center">
      <div className="text-6xl mb-4">🌙</div>
      <h1 className="text-2xl font-extrabold mb-2">لا توجد مسابقة نشطة حاليًّا</h1>
      <p className="text-stage-mute mb-6">ترقّب المسابقة القادمة قريبًا على مسرح SOUQRATES STAGE.</p>
      <BotLink className="btn-primary">افتح البوت لتلقّي الإشعارات</BotLink>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mt-12 border-t border-stage-line">
      <div className="max-w-6xl mx-auto px-4 py-6 text-center text-xs text-stage-mute">
        <div>★ SOUQRATES STAGE — جزء من منظومة SOUQRATES SYSTEM</div>
        <div className="mt-1">جميع المعاملات مالية ومسجّلة وقابلة للتدقيق.</div>
      </div>
    </footer>
  );
}

const BUCKET_COUNT = 12;
const BUCKET_MS = ACTIVITY_WINDOW_MS / BUCKET_COUNT; // 5s

/**
 * Compute per-contestant rank-change + vote-delta metadata for the current
 * snapshot vs the previous one. Pure function — no state.
 */
function buildMeta(
  current: Contestant[],
  prev: { ranks: Map<number, number>; votes: Map<number, number> } | null,
): Map<number, RowMeta> {
  const sorted = [...current].sort(
    (a, b) => Number(b.voteCount) - Number(a.voteCount) || a.sortOrder - b.sortOrder,
  );
  const meta = new Map<number, RowMeta>();
  sorted.forEach((c, idx) => {
    const prevRank = prev?.ranks.get(c.id);
    const prevVotes = prev?.votes.get(c.id);
    meta.set(c.id, {
      rank: idx,
      prevRank: prevRank ?? null,
      voteDelta: prevVotes != null ? Math.max(0, Number(c.voteCount) - prevVotes) : 0,
      isNew: prev !== null && prevVotes == null,
    });
  });
  return meta;
}

export default function App() {
  const [data, setData] = useState<ActivePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Rolling activity buckets: [oldest ... newest]. Re-rendered every tick.
  const [buckets, setBuckets] = useState<number[]>(() => Array(BUCKET_COUNT).fill(0));

  // Per-row metadata (rank delta + vote delta + isNew) computed each tick.
  const [metaById, setMetaById] = useState<Map<number, RowMeta>>(() => new Map());

  // Refs hold non-render state used by the polling loop.
  const timer = useRef<number | null>(null);
  const inFlight = useRef(false);
  const prevSnap = useRef<{ ranks: Map<number, number>; votes: Map<number, number> } | null>(null);
  const activityLog = useRef<Array<{ at: number; votes: number }>>([]);

  useEffect(() => {
    let alive = true;

    const tick = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const d = await getActive();
        if (!alive) return;

        // Compute vote-delta since last successful poll for the ticker.
        const now = Date.now();
        let totalDelta = 0;
        if (prevSnap.current && d.contest) {
          for (const c of d.contestants) {
            const prevV = prevSnap.current.votes.get(c.id);
            if (prevV != null) totalDelta += Math.max(0, Number(c.voteCount) - prevV);
          }
        }
        if (totalDelta > 0) {
          activityLog.current.push({ at: now, votes: totalDelta });
        }
        // Drop old activity entries outside the window.
        const cutoff = now - ACTIVITY_WINDOW_MS;
        activityLog.current = activityLog.current.filter((e) => e.at >= cutoff);

        // Re-bucket the activity log into BUCKET_COUNT slots.
        const newBuckets = Array(BUCKET_COUNT).fill(0);
        for (const e of activityLog.current) {
          const idx = Math.min(
            BUCKET_COUNT - 1,
            Math.floor((e.at - cutoff) / BUCKET_MS),
          );
          newBuckets[idx] += e.votes;
        }

        // Build per-row meta against the previous snapshot.
        const newMeta = buildMeta(d.contestants, prevSnap.current);

        // Update the snapshot for next tick BEFORE committing state.
        const nextRanks = new Map<number, number>();
        const nextVotes = new Map<number, number>();
        [...d.contestants]
          .sort((a, b) => Number(b.voteCount) - Number(a.voteCount) || a.sortOrder - b.sortOrder)
          .forEach((c, idx) => {
            nextRanks.set(c.id, idx);
            nextVotes.set(c.id, Number(c.voteCount));
          });
        prevSnap.current = { ranks: nextRanks, votes: nextVotes };

        setData(d);
        setBuckets(newBuckets);
        setMetaById(newMeta);
        setError(null);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "تعذّر الاتصال");
      } finally {
        inFlight.current = false;
        if (alive) setLoaded(true);
      }
    };
    tick();
    timer.current = window.setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      if (timer.current) window.clearInterval(timer.current);
    };
  }, []);

  const votesLastMinute = useMemo(
    () => buckets.reduce((a, b) => a + b, 0),
    [buckets],
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {!loaded && (
          <div className="max-w-6xl mx-auto px-4 py-20 text-center text-stage-mute">جاري التحميل…</div>
        )}
        {loaded && error && !data && (
          <div className="max-w-6xl mx-auto px-4 py-20 text-center">
            <div className="panel p-6 inline-block">
              <div className="text-stage-red font-bold mb-2">تعذّر الاتصال بالخادم</div>
              <div className="text-xs text-stage-mute">{error}</div>
            </div>
          </div>
        )}
        {loaded && data && !data.contest && <EmptyState />}
        {loaded && data && data.contest && (
          <>
            <Hero
              contest={data.contest}
              totalVotes={Number(data.contest.totalVotes)}
              live={!error}
              votesLastMinute={votesLastMinute}
              buckets={buckets}
            />
            <Leaderboard
              contestants={data.contestants}
              totalVotes={Number(data.contest.totalVotes)}
              metaById={metaById}
            />
            <Packs packs={data.packs} />
          </>
        )}
        {loaded && data && !data.contest && data.packs.length > 0 && (
          <Packs packs={data.packs} />
        )}
      </main>
      <Footer />
    </div>
  );
}

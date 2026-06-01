import "./index.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { Crown, Moon } from "lucide-react";
import { getActive, type ActivePayload, type Contestant, type VotePack } from "@/lib/api";
import { fmtInt, fmtSkz, pct } from "@/lib/format";
import { useLang, useT, t as tt } from "@/lib/i18n";

function LangToggle() {
  const [lang, setLang] = useLang();
  const t = useT();
  const next = lang === "ar" ? "en" : "ar";
  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      className="text-xs font-bold px-2.5 py-1 rounded-md border border-stage-gold/50 text-stage-gold hover:bg-stage-gold/10 transition"
      aria-label={t("langToggle_aria")}
      title={t("langToggle_title")}
    >
      {lang === "ar" ? "EN" : "ع"}
    </button>
  );
}

const BOT_USERNAME = "Souqrates_stage_bot";
const POLL_MS = 3000;
const ACTIVITY_WINDOW_MS = 60_000;       // 60s rolling window for activity ticker
const HISTORY_LEN = 20;                   // last 20 polls (~60s) for sparklines
const EVENT_LIMIT = 18;                   // marquee shows up to N events
const EVENT_TTL_MS = 90_000;              // events fade out of marquee after 90s

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
  const t = useT();
  return (
    <header className="sticky top-0 z-30 backdrop-blur-xl bg-stage-bg/70 border-b border-stage-line">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img
            src={`${import.meta.env.BASE_URL}souqrates-logo.webp`}
            alt="SOUQRATES STAGE"
            className="w-10 h-10 rounded-xl object-cover shadow-lg"
            style={{ border: "1px solid rgba(201,162,39,0.4)" }}
          />
          <div className="leading-tight">
            <div className="text-lg font-extrabold tracking-wide text-glow-gold">{t("app_name")}</div>
            <div className="text-[11px] text-stage-mute">{t("app_tagline")}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LangToggle />
          <BotLink className="btn-primary text-sm hidden sm:inline-flex">{t("open_bot")}</BotLink>
        </div>
      </div>
    </header>
  );
}

// ── Countdown ──────────────────────────────────────────────────
function useCountdown(target: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [target]);
  if (!target) return null;
  const diff = new Date(target).getTime() - now;
  if (Number.isNaN(diff)) return null;
  if (diff <= 0) return { ended: true, d: 0, h: 0, m: 0, s: 0 };
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { ended: false, d, h, m, s };
}

function CountdownPill({ endsAt }: { endsAt: string | null }) {
  const t = useT();
  const c = useCountdown(endsAt);
  if (!c) return null;
  if (c.ended) return <span className="chip" style={{ background: "rgba(248,113,113,.10)", borderColor: "rgba(248,113,113,.35)", color: "#fca5a5" }}>{t("contest_ended")}</span>;
  const urgent = c.d === 0 && c.h < 6;
  const style = urgent
    ? { background: "rgba(248,113,113,.12)", borderColor: "rgba(248,113,113,.40)", color: "#fca5a5" }
    : undefined;
  const cell = (n: number, label: string) => (
    <span className="flex flex-col items-center px-1.5">
      <span className="text-base font-extrabold tabular-nums leading-none">{String(n).padStart(2, "0")}</span>
      <span className="text-[9px] text-stage-mute leading-none mt-0.5">{label}</span>
    </span>
  );
  return (
    <span className="chip" style={style} title={t("countdown_title")}>
      {c.d > 0 && cell(c.d, t("day_full"))}
      {cell(c.h, t("hour_full"))}
      {cell(c.m, t("minute_full"))}
      {cell(c.s, t("second_full"))}
    </span>
  );
}

// ── Activity bars ──────────────────────────────────────────────
function ActivityTicker({ buckets }: { buckets: number[] }) {
  const t = useT();
  const max = Math.max(1, ...buckets);
  return (
    <div className="flex items-end gap-0 h-8 px-1" title={t("activity_title")}>
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

// ── Donut: vote share ──────────────────────────────────────────
function VoteShareDonut({ contestants, total }: { contestants: Contestant[]; total: number }) {
  const t = useT();
  if (total <= 0 || contestants.length === 0) return null;
  const palette = ["#eab308", "#22d3ee", "#ec4899", "#34d399", "#f87171", "#a78bfa", "#fb923c"];
  const sorted = [...contestants].sort((a, b) => Number(b.voteCount) - Number(a.voteCount));
  const radius = 28;
  const c = 2 * Math.PI * radius;
  let acc = 0;
  return (
    <div className="flex items-center gap-3" title={t("donut_title")}>
      <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
        <circle cx="36" cy="36" r={radius} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="10" />
        {sorted.map((c2, i) => {
          const share = Number(c2.voteCount) / total;
          if (share <= 0) return null;
          const dash = share * c;
          const offset = -acc * c;
          acc += share;
          return (
            <circle
              key={c2.id}
              cx="36" cy="36" r={radius}
              fill="none"
              stroke={palette[i % palette.length]}
              strokeWidth="10"
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dasharray .6s ease, stroke-dashoffset .6s ease" }}
            />
          );
        })}
      </svg>
      <div className="flex flex-col gap-0.5 text-[11px]">
        {sorted.slice(0, 3).map((c2, i) => (
          <div key={c2.id} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm" style={{ background: palette[i % palette.length] }} />
            <span className="truncate max-w-[7rem]">{c2.name}</span>
            <span className="text-stage-mute">{pct(Number(c2.voteCount), total).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sparkline (vote-count history) ─────────────────────────────
function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return <svg className="sparkline" width="80" height="24" />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = Math.max(1, max - min);
  const w = 80, h = 24;
  const step = w / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${h - ((v - min) / span) * (h - 4) - 2}`);
  const d = `M ${points.join(" L ")}`;
  const rising = data[data.length - 1] >= data[0];
  const color = rising ? "var(--color-stage-green)" : "var(--color-stage-red)";
  return (
    <svg className="sparkline" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id={`spark-${rising ? "up" : "dn"}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L ${w},${h} L 0,${h} Z`} fill={`url(#spark-${rising ? "up" : "dn"})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Hero ───────────────────────────────────────────────────────
function Hero({
  contest,
  contestants,
  totalVotes,
  live,
  votesLastMinute,
  buckets,
}: {
  contest: NonNullable<ActivePayload["contest"]>;
  contestants: Contestant[];
  totalVotes: number;
  live: boolean;
  votesLastMinute: number;
  buckets: number[];
}) {
  const t = useT();
  return (
    <section className="relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 pt-8 pb-6">
        <div className="panel p-6 md:p-8 heartbeat">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="chip"><span className="pulse-dot" /> {live ? t("live_broadcast") : t("active_contest")}</span>
            <CountdownPill endsAt={contest.endsAt} />
            {votesLastMinute > 0 && (
              <span className="chip" style={{ background: "rgba(52,211,153,.10)", borderColor: "rgba(52,211,153,.35)", color: "#6ee7b7" }}>
                {t("votes_per_minute", { n: fmtInt(votesLastMinute) })}
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold leading-tight text-glow-gold font-orbitron">
            {contest.title}
          </h1>
          {contest.description && (
            <p className="text-stage-mute mt-3 max-w-3xl leading-relaxed">{contest.description}</p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="px-4 py-2 rounded-xl bg-black/30 border border-stage-line">
              <div className="text-[11px] text-stage-mute">{t("total_votes_label")}</div>
              <div className="text-2xl font-extrabold num-anim font-orbitron" key={totalVotes}>{fmtInt(totalVotes)}</div>
            </div>
            <div className="px-4 py-2 rounded-xl bg-black/30 border border-stage-line">
              <div className="text-[11px] text-stage-mute">{t("contestants_label")}</div>
              <div className="text-2xl font-extrabold tabular-nums font-orbitron">{contestants.length}</div>
            </div>
            <div className="px-4 py-2 rounded-xl bg-black/30 border border-stage-line">
              <div className="text-[11px] text-stage-mute">{t("live_activity")}</div>
              <ActivityTicker buckets={buckets} />
            </div>
            <div className="px-4 py-2 rounded-xl bg-black/30 border border-stage-line">
              <div className="text-[11px] text-stage-mute mb-1">{t("vote_distribution")}</div>
              <VoteShareDonut contestants={contestants} total={totalVotes} />
            </div>
            <BotLink className="btn-primary" payload="vote">{t("vote_now_cta")}</BotLink>
            <BotLink className="btn-ghost" payload="packs">{t("vote_packs_cta")}</BotLink>
          </div>
          <div className="mt-3 text-xs text-stage-mute">{t("daily_free_vote_hint")}</div>
        </div>
      </div>
    </section>
  );
}

// ── Podium (top-3) ─────────────────────────────────────────────
function Podium({ top3 }: { top3: Contestant[] }) {
  const t = useT();
  if (top3.length === 0) return null;
  // Display order: 2nd, 1st, 3rd (1st in the middle)
  const order = [top3[1], top3[0], top3[2]].filter(Boolean) as Contestant[];
  return (
    <section className="max-w-6xl mx-auto px-4 pt-2">
      <div className="podium-wrap">
        {order.map((c) => {
          const rank = top3.findIndex((x) => x.id === c.id) + 1;
          const cls = rank === 1 ? "podium-1" : rank === 2 ? "podium-2" : "podium-3";
          const podiumColor = rank === 1 ? "#fbbf24" : rank === 2 ? "#cbd5e1" : "#fdba74";
          return (
            <div key={c.id} className={`podium-col ${cls}`} style={{ color: podiumColor }}>
              {rank === 1 && <span className="podium-crown"><Crown size={18} /></span>}
              <div className="podium-avatar">
                {c.photoUrl ? (
                  <img src={c.photoUrl} alt={c.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-bold text-xl text-stage-mute">{c.name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="text-xl font-extrabold mb-1">#{rank}</div>
              <div className="font-extrabold text-base text-stage-fg truncate">{c.name}</div>
              <div className="mt-1 text-xs text-stage-mute">{fmtInt(c.voteCount)} {t("votes_unit")}</div>
              <BotLink className="btn-primary text-xs mt-3 inline-flex" payload={`vote_${c.id}`}>{t("vote_for_him")}</BotLink>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Marquee ticker ─────────────────────────────────────────────
type Event = { id: string; at: number; kind: "rise" | "fall" | "vote" | "new" | "take1"; text: string };

function Marquee({ events }: { events: Event[] }) {
  const t = useT();
  if (events.length === 0) return null;
  // Duplicate items so the seamless loop has content on both halves.
  const items = [...events, ...events];
  return (
    <div className="marquee" title={t("live_events_title")}>
      <div className="marquee-track">
        {items.map((e, i) => (
          <span key={`${e.id}-${i}`} className={`ev-${e.kind}`}>
            {e.text}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Trending strip (fastest gainer last 60s) ──────────────────
function TrendingStrip({
  contestants,
  voteDeltasLastMinute,
}: {
  contestants: Contestant[];
  voteDeltasLastMinute: Map<number, number>;
}) {
  const t = useT();
  let best: { c: Contestant; gain: number } | null = null;
  for (const c of contestants) {
    const g = voteDeltasLastMinute.get(c.id) ?? 0;
    if (g > 0 && (!best || g > best.gain)) best = { c, gain: g };
  }
  if (!best) return null;
  return (
    <div className="max-w-6xl mx-auto px-4 mt-4">
      <div className="trending-strip">
        <span className="trending-pulse" />
        <span className="text-sm">
          <b>{t("trending_fastest")}</b> {t("now_word")}:
        </span>
        <span className="font-extrabold text-stage-gold">{best.c.name}</span>
        <span className="chip" style={{ background: "rgba(52,211,153,.12)", borderColor: "rgba(52,211,153,.35)", color: "#6ee7b7" }}>
          {t("trending_gain", { n: best.gain })}
        </span>
        <BotLink className="btn-primary text-xs mr-auto" payload={`vote_${best.c.id}`}>{t("vote_with_him")}</BotLink>
      </div>
    </div>
  );
}

// ── Row metadata + RankDelta ──────────────────────────────────
type RowMeta = {
  rank: number;
  prevRank: number | null;
  voteDelta: number;
  isNew: boolean;
};

function RankDelta({ meta }: { meta: RowMeta }) {
  const t = useT();
  if (meta.isNew) return <span className="badge-new">{t("new_badge")}</span>;
  if (meta.prevRank === null) return <span className="delta-flat">—</span>;
  const delta = meta.prevRank - meta.rank;
  if (delta === 0) return <span className="delta-flat">{t("flat_stable")}</span>;
  if (delta > 0) return <span className="delta-up">▲ {delta}</span>;
  return <span className="delta-down">▼ {Math.abs(delta)}</span>;
}

function ContestantRow({
  c,
  meta,
  totalVotes,
  history,
}: {
  c: Contestant;
  meta: RowMeta;
  totalVotes: number;
  history: number[];
}) {
  const t = useT();
  const p = pct(Number(c.voteCount), totalVotes);
  const medal = `#${meta.rank + 1}`;
  const medalColor = meta.rank === 0 ? "#fbbf24" : meta.rank === 1 ? "#cbd5e1" : meta.rank === 2 ? "#fdba74" : undefined;
  const rankDelta = meta.prevRank !== null ? meta.prevRank - meta.rank : 0;

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
      <div className="w-12 text-center text-xl font-extrabold tabular-nums" style={{ color: medalColor ?? "var(--color-stage-mute)" }}>{medal}</div>
      <div className="w-14 h-14 rounded-xl overflow-hidden bg-stage-panel border border-stage-line shrink-0 grid place-items-center text-xl">
        {c.photoUrl ? (
          <img src={c.photoUrl} alt={c.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <span className="font-bold text-stage-mute">{c.name.charAt(0).toUpperCase()}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-bold text-base truncate">{c.name}</h3>
          {c.isDisqualified && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">{t("disqualified")}</span>}
          {rankDelta >= 2 && <span className="badge-rising">{t("rising_badge")}</span>}
          {rankDelta <= -2 && <span className="badge-falling">{t("falling_badge")}</span>}
          <RankDelta meta={meta} />
        </div>
        {c.bio && <p className="text-xs text-stage-mute truncate">{c.bio}</p>}
        <div className="mt-2 bar-track"><div className="bar-fill" style={{ width: `${p}%` }} /></div>
      </div>
      <div className="hidden sm:block shrink-0">
        <Sparkline data={history} />
      </div>
      <div className="text-right shrink-0">
        <div className="text-lg font-extrabold num-anim" key={c.voteCount}>{fmtInt(c.voteCount)}</div>
        <div className="text-[11px] text-stage-mute">{p.toFixed(1)}%</div>
      </div>
      <BotLink className="btn-primary text-sm hidden md:inline-flex" payload={`vote_${c.id}`}>{t("vote_short")}</BotLink>
    </div>
  );
}

function Leaderboard({
  contestants,
  totalVotes,
  metaById,
  historyById,
}: {
  contestants: Contestant[];
  totalVotes: number;
  metaById: Map<number, RowMeta>;
  historyById: Map<number, number[]>;
}) {
  const t = useT();
  const sorted = useMemo(
    () => [...contestants].sort((a, b) => Number(b.voteCount) - Number(a.voteCount) || a.sortOrder - b.sortOrder),
    [contestants],
  );
  return (
    <section className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-extrabold flex items-center gap-2">{t("leaderboard_title")}</h2>
        <span className="text-xs text-stage-mute flex items-center gap-2">
          <span className="pulse-dot" /> {t("refresh_every", { n: POLL_MS / 1000 })}
        </span>
      </div>
      {sorted.length === 0 ? (
        <div className="panel p-8 text-center text-stage-mute">{t("no_contestants_yet")}</div>
      ) : (
        <div className="grid gap-3">
          {sorted.map((c) => {
            const meta = metaById.get(c.id) ?? { rank: 0, prevRank: null, voteDelta: 0, isNew: true };
            const hist = historyById.get(c.id) ?? [Number(c.voteCount)];
            return <ContestantRow key={c.id} c={c} meta={meta} totalVotes={totalVotes} history={hist} />;
          })}
        </div>
      )}
    </section>
  );
}

// ── Packs ──────────────────────────────────────────────────────
function PackCard({ p }: { p: VotePack }) {
  const t = useT();
  const total = p.votes + (p.bonusVotes || 0);
  return (
    <div className="panel p-5 flex flex-col gap-3 hover:translate-y-[-2px] transition-transform">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-stage-mute">{t("pack_label")}</div>
          <h3 className="text-lg font-extrabold">{p.name}</h3>
        </div>
        {p.bonusFileUrl && (
          <span className="text-[10px] px-2 py-1 rounded-full bg-stage-cyan/20 text-stage-cyan border border-stage-cyan/30">{t("bonus_file_badge")}</span>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-black text-stage-gold text-glow-gold font-orbitron">{fmtInt(total)}</span>
        <span className="text-sm text-stage-mute">{t("votes_unit")}</span>
        {p.bonusVotes > 0 && (
          <span className="text-[11px] text-stage-green">{t("bonus_votes_suffix", { n: p.bonusVotes })}</span>
        )}
      </div>
      {p.description && <p className="text-xs text-stage-mute">{p.description}</p>}
      {p.bonusDescription && (
        <div className="text-[11px] px-3 py-2 rounded-lg bg-stage-cyan/5 border border-stage-cyan/20 text-stage-cyan">
          {p.bonusDescription}
        </div>
      )}
      <div className="mt-auto flex items-center justify-between pt-2 border-t border-stage-line">
        <div>
          <div className="text-[10px] text-stage-mute">{t("price_label")}</div>
          <div className="text-lg font-extrabold">{fmtSkz(p.priceSkz)} <span className="text-xs text-stage-mute">SKZ</span></div>
        </div>
        <BotLink className="btn-primary text-sm" payload={`buy_${p.id}`}>{t("buy_now")}</BotLink>
      </div>
    </div>
  );
}

function Packs({ packs }: { packs: VotePack[] }) {
  const t = useT();
  if (!packs.length) return null;
  return (
    <section className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-extrabold flex items-center gap-2">{t("vote_packs_cta")}</h2>
        <span className="text-xs text-stage-mute">{t("pay_with_skz")}</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {packs.map((p) => <PackCard key={p.id} p={p} />)}
      </div>
    </section>
  );
}

// ── Confetti ───────────────────────────────────────────────────
function Confetti({ burstKey }: { burstKey: number }) {
  const pieces = useMemo(() => {
    const colors = ["#eab308", "#22d3ee", "#ec4899", "#34d399", "#f87171", "#a78bfa"];
    return Array.from({ length: 60 }, () => ({
      left: Math.random() * 100,
      bg: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 0.6,
      rot: Math.random() * 360,
      dur: 2 + Math.random() * 1.8,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [burstKey]);
  if (burstKey === 0) return null;
  return (
    <div className="confetti-wrap" key={burstKey} aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            background: p.bg,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            transform: `rotate(${p.rot}deg)`,
          }}
        />
      ))}
    </div>
  );
}

function EmptyState() {
  const t = useT();
  return (
    <section className="max-w-3xl mx-auto px-4 py-20 text-center">
      <div className="mb-6 flex justify-center text-stage-mute"><Moon size={56} strokeWidth={1.5} /></div>
      <h1 className="text-2xl font-extrabold mb-2">{t("empty_title")}</h1>
      <p className="text-stage-mute mb-6">{t("empty_subtitle")}</p>
      <BotLink className="btn-primary">{t("open_bot_notifications")}</BotLink>
    </section>
  );
}

function Footer() {
  const t = useT();
  return (
    <footer className="mt-12 border-t border-stage-line">
      <div className="max-w-6xl mx-auto px-4 py-6 text-center text-xs text-stage-mute">
        <div>{t("footer_brand")}</div>
        <div className="mt-1">{t("footer_legal")}</div>
      </div>
    </footer>
  );
}

const BUCKET_COUNT = 12;
const BUCKET_MS = ACTIVITY_WINDOW_MS / BUCKET_COUNT;

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
  const t = useT();
  const [lang] = useLang();
  const langRef = useRef(lang);
  useEffect(() => { langRef.current = lang; }, [lang]);
  const [data, setData] = useState<ActivePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [buckets, setBuckets] = useState<number[]>(() => Array(BUCKET_COUNT).fill(0));
  const [metaById, setMetaById] = useState<Map<number, RowMeta>>(() => new Map());
  const [historyById, setHistoryById] = useState<Map<number, number[]>>(() => new Map());
  const [events, setEvents] = useState<Event[]>([]);
  const [confettiKey, setConfettiKey] = useState(0);

  const timer = useRef<number | null>(null);
  const inFlight = useRef(false);
  const prevSnap = useRef<{ ranks: Map<number, number>; votes: Map<number, number> } | null>(null);
  const activityLog = useRef<Array<{ at: number; votes: number; cid?: number }>>([]);
  const eventSeq = useRef(0);
  const prevTopId = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;

    const tick = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const d = await getActive();
        if (!alive) return;
        const now = Date.now();

        // Per-contestant vote-delta and event generation.
        let totalDelta = 0;
        const newEventBatch: Event[] = [];
        const nameById = new Map(d.contestants.map((c) => [c.id, c.name]));

        // Rank changes need the NEW sorted order vs prev ranks.
        const sortedNow = [...d.contestants].sort(
          (a, b) => Number(b.voteCount) - Number(a.voteCount) || a.sortOrder - b.sortOrder,
        );

        if (prevSnap.current && d.contest) {
          for (const c of d.contestants) {
            const prevV = prevSnap.current.votes.get(c.id);
            if (prevV != null) {
              const delta = Math.max(0, Number(c.voteCount) - prevV);
              if (delta > 0) {
                totalDelta += delta;
                activityLog.current.push({ at: now, votes: delta, cid: c.id });
                newEventBatch.push({
                  id: `v-${c.id}-${now}-${eventSeq.current++}`,
                  at: now,
                  kind: "vote",
                  text: tt(langRef.current, "event_vote", { n: delta, name: c.name }),
                });
              }
            } else {
              newEventBatch.push({
                id: `n-${c.id}-${now}-${eventSeq.current++}`,
                at: now,
                kind: "new",
                text: tt(langRef.current, "event_new", { name: c.name }),
              });
            }
          }
          // Rank-change events.
          sortedNow.forEach((c, idx) => {
            const prevRank = prevSnap.current!.ranks.get(c.id);
            if (prevRank != null && prevRank !== idx) {
              const moved = prevRank - idx; // +ve up, -ve down
              if (moved >= 1) {
                newEventBatch.push({
                  id: `r-${c.id}-${now}-${eventSeq.current++}`,
                  at: now,
                  kind: idx === 0 ? "take1" : "rise",
                  text: idx === 0
                    ? tt(langRef.current, "event_take1", { name: c.name })
                    : tt(langRef.current, "event_rise", { name: c.name, rank: idx + 1 }),
                });
              } else if (moved <= -2) {
                newEventBatch.push({
                  id: `f-${c.id}-${now}-${eventSeq.current++}`,
                  at: now,
                  kind: "fall",
                  text: tt(langRef.current, "event_fall", { name: c.name, rank: idx + 1 }),
                });
              }
            }
          });
        }

        // Confetti on new #1 takeover.
        const newTopId = sortedNow[0]?.id ?? null;
        if (
          newTopId !== null &&
          prevTopId.current !== null &&
          newTopId !== prevTopId.current
        ) {
          setConfettiKey((k) => k + 1);
        }
        prevTopId.current = newTopId;

        // Drop expired activity entries and re-bucket.
        const cutoff = now - ACTIVITY_WINDOW_MS;
        activityLog.current = activityLog.current.filter((e) => e.at >= cutoff);
        const newBuckets = Array(BUCKET_COUNT).fill(0);
        for (const e of activityLog.current) {
          const idx = Math.min(BUCKET_COUNT - 1, Math.floor((e.at - cutoff) / BUCKET_MS));
          newBuckets[idx] += e.votes;
        }

        // Per-contestant history for sparklines (rolling).
        setHistoryById((prev) => {
          const next = new Map(prev);
          for (const c of d.contestants) {
            const arr = (next.get(c.id) ?? []).slice(-HISTORY_LEN + 1);
            arr.push(Number(c.voteCount));
            next.set(c.id, arr);
          }
          // Drop history for removed contestants.
          for (const id of next.keys()) {
            if (!nameById.has(id)) next.delete(id);
          }
          return next;
        });

        // Merge new events, drop expired, cap length.
        setEvents((prev) => {
          const merged = [...newEventBatch, ...prev].filter((e) => now - e.at <= EVENT_TTL_MS);
          return merged.slice(0, EVENT_LIMIT);
        });

        // Build meta + update snapshot.
        const newMeta = buildMeta(d.contestants, prevSnap.current);
        const nextRanks = new Map<number, number>();
        const nextVotes = new Map<number, number>();
        sortedNow.forEach((c, idx) => {
          nextRanks.set(c.id, idx);
          nextVotes.set(c.id, Number(c.voteCount));
        });
        prevSnap.current = { ranks: nextRanks, votes: nextVotes };

        setData(d);
        setBuckets(newBuckets);
        setMetaById(newMeta);
        setError(null);
        if (totalDelta === 0) {
          // No-op, just keep the variable used for the linter.
        }
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : tt(langRef.current, "connection_failed_short"));
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

  const votesLastMinute = useMemo(() => buckets.reduce((a, b) => a + b, 0), [buckets]);

  // Per-contestant gains in the activity window (for "trending" highlight).
  const voteDeltasLastMinute = useMemo(() => {
    const m = new Map<number, number>();
    // Reading from activityLog ref is fine inside a memo keyed on `buckets`
    // because buckets change every tick (re-derived from the same log).
    for (const e of activityLog.current) {
      if (e.cid == null) continue;
      m.set(e.cid, (m.get(e.cid) ?? 0) + e.votes);
    }
    return m;
  }, [buckets]);

  const sortedContestants = useMemo(() => {
    if (!data) return [];
    return [...data.contestants].sort(
      (a, b) => Number(b.voteCount) - Number(a.voteCount) || a.sortOrder - b.sortOrder,
    );
  }, [data]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <Confetti burstKey={confettiKey} />
      <main className="flex-1">
        {!loaded && (
          <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="panel rounded-2xl overflow-hidden animate-pulse">
                  <div style={{ height: 180, background: 'rgba(255,255,255,0.05)' }} />
                  <div className="p-4" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ height: 14, background: 'rgba(255,255,255,0.07)', borderRadius: 6, width: '75%' }} />
                    <div style={{ height: 10, background: 'rgba(255,255,255,0.04)', borderRadius: 6, width: '50%' }} />
                    <div style={{ height: 32, background: 'rgba(255,255,255,0.06)', borderRadius: 10, marginTop: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {loaded && error && !data && (
          <div className="max-w-6xl mx-auto px-4 py-20 text-center">
            <div className="panel p-6 inline-block">
              <div className="text-stage-red font-bold mb-2">{t("connection_failed")}</div>
              <div className="text-xs text-stage-mute">{error}</div>
            </div>
          </div>
        )}
        {loaded && data && !data.contest && <EmptyState />}
        {loaded && data && data.contest && (
          <>
            <Hero
              contest={data.contest}
              contestants={sortedContestants}
              totalVotes={Number(data.contest.totalVotes)}
              live={!error}
              votesLastMinute={votesLastMinute}
              buckets={buckets}
            />
            {events.length > 0 && (
              <div className="max-w-6xl mx-auto px-4">
                <Marquee events={events} />
              </div>
            )}
            <TrendingStrip
              contestants={sortedContestants}
              voteDeltasLastMinute={voteDeltasLastMinute}
            />
            <Podium top3={sortedContestants.slice(0, 3)} />
            <Leaderboard
              contestants={data.contestants}
              totalVotes={Number(data.contest.totalVotes)}
              metaById={metaById}
              historyById={historyById}
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

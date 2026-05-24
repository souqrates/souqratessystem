import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { GameConfigRow } from "./Games";

// Known well-typed in-game text keys (always editable).
// Extras stored in `texts` JSON remain editable via the "نصوص أخرى" block.
const TEXT_KEYS: { key: string; label: string; multi?: boolean }[] = [
  { key: "title", label: "عنوان اللعبة (داخلي)" },
  { key: "subtitle", label: "العنوان الفرعي" },
  { key: "rules", label: "قواعد اللعبة", multi: true },
  { key: "ctaLabel", label: "زر البدء (CTA)" },
  { key: "winLabel", label: "رسالة الفوز" },
  { key: "loseLabel", label: "رسالة الخسارة" },
];

export default function GameDetailPage() {
  const [, params] = useRoute<{ gameId: string }>("/games/:gameId");
  const gameId = Number(params?.gameId);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "games", gameId],
    queryFn: () => api.get<{ data: GameConfigRow }>(`/superadmin/games/${gameId}`),
    enabled: Number.isInteger(gameId),
  });
  const g = data?.data;

  // Local form state (mirrors draft)
  const [isVisible, setIsVisible] = useState(true);
  const [imageUrl, setImageUrl] = useState("");
  const [description, setDescription] = useState("");
  const [entryFee, setEntryFee] = useState("10");
  const [winAmount, setWinAmount] = useState("30");
  const [targetScore, setTargetScore] = useState("0");
  const [maxScore, setMaxScore] = useState("0");
  const [scorePerCorrect, setScorePerCorrect] = useState("1");
  const [scorePerWrong, setScorePerWrong] = useState("0");
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [extraTextsJson, setExtraTextsJson] = useState("{}");
  const [paramsJson, setParamsJson] = useState("{}");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!g) return;
    const d = g.draft;
    setIsVisible(d.isVisible);
    setImageUrl(d.imageUrl);
    setDescription(d.description);
    setEntryFee(String(d.entryFee));
    setWinAmount(String(d.winAmount));
    setTargetScore(String(d.targetScore));
    setMaxScore(String(d.maxScore));
    setScorePerCorrect(String(d.scorePerCorrect));
    setScorePerWrong(String(d.scorePerWrong));
    const rawTexts = (d.texts ?? {}) as Record<string, unknown>;
    const known: Record<string, string> = {};
    const extras: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rawTexts)) {
      if (TEXT_KEYS.some((t) => t.key === k)) known[k] = String(v ?? "");
      else extras[k] = v;
    }
    setTexts(known);
    setExtraTextsJson(JSON.stringify(extras, null, 2));
    setParamsJson(JSON.stringify(d.params ?? {}, null, 2));
  }, [g?.gameId, g?.updatedAt]);

  const saveDraft = useMutation({
    mutationFn: async () => {
      let extras: Record<string, unknown> = {};
      let params: Record<string, unknown> = {};
      try {
        extras = extraTextsJson.trim() ? JSON.parse(extraTextsJson) : {};
      } catch {
        throw new Error("صيغة JSON خاطئة في «نصوص أخرى»");
      }
      try {
        params = paramsJson.trim() ? JSON.parse(paramsJson) : {};
      } catch {
        throw new Error("صيغة JSON خاطئة في «معاملات إضافية»");
      }
      const mergedTexts = { ...texts, ...extras };
      return api.put<{ data: GameConfigRow }>(`/superadmin/games/${gameId}/draft`, {
        isVisible,
        imageUrl,
        description,
        entryFee,
        winAmount,
        targetScore,
        maxScore,
        scorePerCorrect,
        scorePerWrong,
        texts: mergedTexts,
        params,
      });
    },
    onSuccess: () => {
      setMsg({ kind: "ok", text: "تم حفظ المسودة (لم تظهر للمستخدمين بعد)" });
      qc.invalidateQueries({ queryKey: ["superadmin", "games"] });
      qc.invalidateQueries({ queryKey: ["superadmin", "games", gameId] });
      setTimeout(() => setMsg(null), 4000);
    },
    onError: (e) => setMsg({ kind: "err", text: e instanceof Error ? e.message : "خطأ" }),
  });

  const publish = useMutation({
    mutationFn: async () => {
      // Always save draft first, then publish, so users never see stale draft state.
      await saveDraft.mutateAsync();
      return api.post<{ data: GameConfigRow }>(`/superadmin/games/${gameId}/publish`);
    },
    onSuccess: () => {
      setMsg({ kind: "ok", text: "✓ تم النشر — التغييرات وصلت للمستخدمين الآن" });
      qc.invalidateQueries({ queryKey: ["superadmin", "games"] });
      qc.invalidateQueries({ queryKey: ["superadmin", "games", gameId] });
      setTimeout(() => setMsg(null), 5000);
    },
    onError: (e) => setMsg({ kind: "err", text: e instanceof Error ? e.message : "فشل النشر" }),
  });

  const discard = useMutation({
    mutationFn: () => api.post(`/superadmin/games/${gameId}/discard-draft`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin", "games"] });
      qc.invalidateQueries({ queryKey: ["superadmin", "games", gameId] });
      setMsg({ kind: "ok", text: "تم إلغاء المسودة" });
      setTimeout(() => setMsg(null), 3000);
    },
  });

  if (!Number.isInteger(gameId)) return <div className="p-8" dir="rtl">معرّف اللعبة غير صالح</div>;
  if (isLoading || !g) return <div className="p-8 text-slate-400" dir="rtl">جارٍ التحميل…</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto" dir="rtl">
      <Link href="/games"><a className="text-sm text-indigo-600 hover:underline">← العودة لقائمة الألعاب</a></Link>

      <header className="flex items-center gap-4 mt-3 mb-6">
        <div className="text-5xl">{g.emoji}</div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-900">{g.name}</h1>
          <p className="text-slate-500 mt-0.5">
            معرف: <code className="text-xs">{g.gameId}</code> · صعوبة: {g.difficulty}
          </p>
        </div>
        {g.hasUnpublishedChanges && (
          <span className="px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg text-sm font-bold">
            ⚠ مسودة غير منشورة
          </span>
        )}
      </header>

      {/* Action bar — sticky */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border border-slate-200 rounded-2xl p-4 mb-6 shadow-md flex flex-wrap items-center gap-3">
        <button
          onClick={() => saveDraft.mutate()}
          disabled={saveDraft.isPending || publish.isPending}
          className="px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 disabled:opacity-60 text-slate-900 font-semibold"
        >
          {saveDraft.isPending ? "جارٍ الحفظ…" : "💾 حفظ كمسودة (Preview)"}
        </button>
        <button
          onClick={() => publish.mutate()}
          disabled={publish.isPending || saveDraft.isPending}
          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold"
        >
          {publish.isPending ? "جارٍ النشر…" : "🚀 نشر للمستخدمين الآن (Publish)"}
        </button>
        {g.hasUnpublishedChanges && (
          <button
            onClick={() => discard.mutate()}
            disabled={discard.isPending}
            className="px-3 py-2 text-sm rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700"
          >
            إلغاء المسودة وعودة للمنشور
          </button>
        )}
        {msg && (
          <span className={`text-sm font-medium ${msg.kind === "ok" ? "text-emerald-700" : "text-rose-700"}`}>
            {msg.text}
          </span>
        )}
        <span className="text-xs text-slate-400 mr-auto">
          آخر نشر: {g.publishedAt ? new Date(g.publishedAt).toLocaleString("ar") : "—"}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT 2/3 — editor */}
        <div className="lg:col-span-2 space-y-6">
          {/* Visibility */}
          <Card title="الظهور للمستخدمين" subtitle="إذا أُخفيت، لن تظهر اللعبة في القائمة داخل البوت بعد النشر">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-5 h-5 rounded text-indigo-600"
                checked={isVisible}
                onChange={(e) => setIsVisible(e.target.checked)}
              />
              <span className="text-sm font-semibold text-slate-700">
                اللعبة ظاهرة للمستخدمين
              </span>
            </label>
          </Card>

          {/* Image */}
          <Card title="صورة اللعبة" subtitle="رابط صورة (URL). يمكن استخدام أي CDN أو رفع الصورة على Telegram والحصول على رابط مباشر">
            <Field label="رابط الصورة">
              <input
                className={inputCls}
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://…"
                dir="ltr"
              />
            </Field>
            {imageUrl && (
              <div className="mt-3 flex items-center gap-3">
                <img
                  src={imageUrl}
                  alt="معاينة"
                  className="w-32 h-32 rounded-xl object-cover border border-slate-200"
                  onError={(e) => ((e.currentTarget.style.display = "none"))}
                />
                <div className="text-xs text-slate-500">معاينة الصورة</div>
              </div>
            )}
          </Card>

          {/* Economy */}
          <Card title="الاقتصاد المالي" subtitle="بالعملة الموحدة SKZ — يُطبَّق فوراً بعد النشر">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="سعر الدخول (Entry Fee)">
                <input className={inputCls} type="number" step="0.01" min={0} value={entryFee} onChange={(e) => setEntryFee(e.target.value)} />
              </Field>
              <Field label="مكافأة الفوز (Win Amount)">
                <input className={inputCls} type="number" step="0.01" min={0} value={winAmount} onChange={(e) => setWinAmount(e.target.value)} />
              </Field>
            </div>
            <p className="text-xs text-slate-500 mt-3">
              💡 الربح الصافي للمنصة على كل جولة فائزة = {Math.max(0, Number(entryFee) - Number(winAmount)).toFixed(2)} SKZ
              {Number(winAmount) > Number(entryFee) && (
                <span className="text-amber-600 font-bold mr-2">⚠ المكافأة أكبر من رسم الدخول</span>
              )}
            </p>
          </Card>

          {/* Scoring */}
          <Card title="نظام السكور" subtitle="ضوابط السكور داخل الجولة — تُطبق على اللعبة من الجلسة التالية بعد النشر">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="سكور الفوز (Target Score)" hint="السكور المطلوب الوصول إليه للفوز">
                <input className={inputCls} type="number" min={0} value={targetScore} onChange={(e) => setTargetScore(e.target.value)} />
              </Field>
              <Field label="الحد الأقصى للسكور (Max Score)" hint="سقف السكور في الجولة (0 = بلا سقف)">
                <input className={inputCls} type="number" min={0} value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
              </Field>
              <Field label="نقاط الضربة الصحيحة" hint="كم تزيد عند كل إصابة">
                <input className={inputCls} type="number" min={0} value={scorePerCorrect} onChange={(e) => setScorePerCorrect(e.target.value)} />
              </Field>
              <Field label="عقوبة الضربة الخاطئة" hint="كم تنقص عند كل خطأ (موجب = خصم)">
                <input className={inputCls} type="number" min={0} value={scorePerWrong} onChange={(e) => setScorePerWrong(e.target.value)} />
              </Field>
            </div>
          </Card>

          {/* Description */}
          <Card title="وصف اللعبة" subtitle="يظهر في قائمة الألعاب">
            <Field label="الوصف">
              <textarea className={`${inputCls} min-h-[80px]`} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
          </Card>

          {/* Texts */}
          <Card title="نصوص داخل اللعبة" subtitle="رسائل تظهر للاعب أثناء اللعب — تُطبَّق فوراً بعد النشر">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {TEXT_KEYS.map((t) => (
                <Field key={t.key} label={t.label}>
                  {t.multi ? (
                    <textarea
                      className={`${inputCls} min-h-[60px]`}
                      value={texts[t.key] ?? ""}
                      onChange={(e) => setTexts({ ...texts, [t.key]: e.target.value })}
                    />
                  ) : (
                    <input
                      className={inputCls}
                      value={texts[t.key] ?? ""}
                      onChange={(e) => setTexts({ ...texts, [t.key]: e.target.value })}
                    />
                  )}
                </Field>
              ))}
            </div>
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-slate-600 font-semibold">نصوص إضافية (JSON متقدم)</summary>
              <textarea
                className={`${inputCls} font-mono text-xs mt-2 min-h-[100px]`}
                value={extraTextsJson}
                onChange={(e) => setExtraTextsJson(e.target.value)}
                dir="ltr"
              />
              <p className="text-xs text-slate-400 mt-1">أي مفاتيح غير المفاتيح الشهيرة تُحفظ هنا. لا تكسر JSON.</p>
            </details>
          </Card>

          {/* Custom params */}
          <Card title="معاملات إضافية للعبة (متقدم)" subtitle="JSON يقرأه كود اللعبة نفسه — مثل durationSeconds, trapPenalty, الخ.">
            <textarea
              className={`${inputCls} font-mono text-xs min-h-[120px]`}
              value={paramsJson}
              onChange={(e) => setParamsJson(e.target.value)}
              dir="ltr"
            />
            <p className="text-xs text-slate-400 mt-1">
              مثال: <code>{`{ "durationSeconds": 60, "trapPenalty": 5 }`}</code>
            </p>
          </Card>
        </div>

        {/* RIGHT 1/3 — preview / published snapshot */}
        <div className="space-y-4">
          <div className="sticky top-28">
            <div className="bg-white border-2 border-emerald-200 rounded-2xl p-5 shadow-sm">
              <div className="text-xs uppercase tracking-wider text-emerald-700 font-bold mb-3">المنشور حالياً (يراه المستخدمون)</div>
              <PublishedSnapshot p={g.published} emoji={g.emoji} name={g.name} />
            </div>
            <div className="bg-white border-2 border-indigo-200 rounded-2xl p-5 shadow-sm mt-4">
              <div className="text-xs uppercase tracking-wider text-indigo-700 font-bold mb-3">المسودة (سيراها المستخدمون بعد النشر)</div>
              <PreviewBox
                emoji={g.emoji}
                name={g.name}
                imageUrl={imageUrl}
                description={description}
                entryFee={entryFee}
                winAmount={winAmount}
                targetScore={targetScore}
                isVisible={isVisible}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PublishedSnapshot({ p, emoji, name }: { p: GameConfigRow["published"]; emoji: string; name: string }) {
  return (
    <PreviewBox
      emoji={emoji}
      name={name}
      imageUrl={p.imageUrl}
      description={p.description}
      entryFee={String(p.entryFee)}
      winAmount={String(p.winAmount)}
      targetScore={String(p.targetScore)}
      isVisible={p.isVisible}
    />
  );
}

function PreviewBox({
  emoji, name, imageUrl, description, entryFee, winAmount, targetScore, isVisible,
}: {
  emoji: string; name: string; imageUrl: string; description: string;
  entryFee: string; winAmount: string; targetScore: string; isVisible: boolean;
}) {
  return (
    <div className={`rounded-xl p-4 ${isVisible ? "bg-slate-50" : "bg-slate-200 opacity-60"}`}>
      {imageUrl ? (
        <img src={imageUrl} alt="" className="w-full h-32 rounded-lg object-cover mb-3" onError={(e) => ((e.currentTarget.style.display = "none"))} />
      ) : (
        <div className="w-full h-32 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-6xl mb-3">{emoji}</div>
      )}
      <div className="font-bold text-slate-900">{emoji} {name}</div>
      <div className="text-xs text-slate-500 mt-1">{description || "—"}</div>
      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        <div className="bg-white rounded-lg p-2"><div className="text-[10px] text-slate-500">الدخول</div><div className="font-bold text-sm">{Number(entryFee)} SKZ</div></div>
        <div className="bg-white rounded-lg p-2"><div className="text-[10px] text-slate-500">الجائزة</div><div className="font-bold text-sm text-emerald-700">{Number(winAmount)}</div></div>
        <div className="bg-white rounded-lg p-2"><div className="text-[10px] text-slate-500">الهدف</div><div className="font-bold text-sm">{Number(targetScore) || "—"}</div></div>
      </div>
      {!isVisible && <div className="mt-3 text-center text-xs font-bold text-rose-700">⚠ مخفية</div>}
    </div>
  );
}

// ─── shared helpers ─────────────────────────────────────────────
const inputCls = "w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500";
function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-500 mt-1">{hint}</span>}
    </label>
  );
}

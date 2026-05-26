import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Eraser, ScrollText, ShieldCheck, Sparkles } from "lucide-react";
import { useT } from "../lib/i18n";

type SignatureCanvasHandle = {
  clear: () => void;
  isEmpty: () => boolean;
  toDataUrl: () => string;
};

function useSignatureCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Size for crispness on HiDPI screens, but keep CSS layout fluid.
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width  = Math.floor(rect.width  * ratio);
      canvas.height = Math.floor(rect.height * ratio);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(ratio, ratio);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = "#0f172a";
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, rect.width, rect.height);
      }
    };
    resize();
    window.addEventListener("resize", resize);

    const getPoint = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      drawingRef.current = true;
      lastRef.current = getPoint(e);
    };
    const onMove = (e: PointerEvent) => {
      if (!drawingRef.current) return;
      const ctx = canvas.getContext("2d");
      if (!ctx || !lastRef.current) return;
      const p = getPoint(e);
      ctx.beginPath();
      ctx.moveTo(lastRef.current.x, lastRef.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastRef.current = p;
      dirtyRef.current = true;
    };
    const onUp = () => { drawingRef.current = false; lastRef.current = null; };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup",   onUp);
    canvas.addEventListener("pointerleave", onUp);
    canvas.addEventListener("pointercancel", onUp);

    return () => {
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup",   onUp);
      canvas.removeEventListener("pointerleave", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const handle: SignatureCanvasHandle = {
    clear: () => {
      const c = canvasRef.current; if (!c) return;
      const ctx = c.getContext("2d"); if (!ctx) return;
      const rect = c.getBoundingClientRect();
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.restore();
      const ratio = window.devicePixelRatio || 1;
      ctx.scale(ratio, ratio);
      ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 2.2; ctx.strokeStyle = "#0f172a";
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, rect.width, rect.height);
      dirtyRef.current = false;
    },
    isEmpty: () => !dirtyRef.current,
    toDataUrl: () => canvasRef.current?.toDataURL("image/png") ?? "",
  };

  return { canvasRef, handle };
}

/* ─────────────────────────── Visual chrome ─────────────────────────── */

function BrandBackdrop() {
  // Dark base with floating purple/cyan orbs + subtle grid — matches the bot's identity.
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {/* deep base wash */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(168,85,247,0.18),_transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(34,211,238,0.12),_transparent_55%)]" />
      {/* faint grid */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
        }}
      />
      {/* floating orbs */}
      <div className="orb-1 absolute -top-24 -right-16 w-72 h-72 rounded-full bg-purple-600/25 blur-3xl" />
      <div className="orb-2 absolute top-1/3 -left-20 w-80 h-80 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="orb-1 absolute bottom-0 right-1/4 w-64 h-64 rounded-full bg-fuchsia-600/15 blur-3xl" />
    </div>
  );
}

const inputStyles =
  "bg-white/5 border-white/10 text-white placeholder:text-white/30 " +
  "focus-visible:border-purple-400/60 focus-visible:ring-2 focus-visible:ring-purple-500/20 " +
  "rounded-xl h-11";

const labelStyles = "text-white/85 text-sm font-semibold";

/* ────────────────────────────── Page ───────────────────────────────── */

export function Agreement() {
  const t = useT();
  const [content, setContent] = useState("");
  const [loadingText, setLoadingText] = useState(true);

  const [name,  setName]  = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const { canvasRef, handle } = useSignatureCanvas();

  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}api/agreement`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setContent(d?.content ?? ""); })
      .catch(() => { /* show form anyway */ })
      .finally(() => { if (!cancelled) setLoadingText(false); });
    return () => { cancelled = true; };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (handle.isEmpty()) { setError(t("agreement.signRequired")); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/agreement/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, email, phone: phone || undefined, notes: notes || undefined,
          signature: handle.toDataUrl(),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j?.error || t("agreement.submitFailed")); return; }
      setDone(true);
    } catch {
      setError(t("agreement.connFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div dir="rtl" className="relative min-h-screen h-screen overflow-y-auto flex items-center justify-center px-4 text-white">
        <BrandBackdrop />
        <Card className="relative max-w-md w-full border border-emerald-400/20 bg-white/[0.03] backdrop-blur-2xl shadow-[0_20px_80px_rgba(16,185,129,0.18)] rounded-3xl">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-400/30 to-emerald-600/10 ring-1 ring-emerald-300/30 flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.35)]">
              <CheckCircle2 className="w-10 h-10 text-emerald-300" />
            </div>
            <h2 className="text-2xl font-extrabold gradient-text-emerald">{t("agreement.done.title")}</h2>
            <p className="text-white/70 leading-7">
              {t("agreement.done.body", { name })}
            </p>
            <div className="pt-2 flex items-center justify-center gap-2 text-[12px] text-white/65">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{t("agreement.done.verified")}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div dir="rtl" className="relative min-h-screen h-screen overflow-y-auto px-4 py-8 text-white">
      <BrandBackdrop />

      <div className="relative max-w-2xl mx-auto">
        {/* Logo + title */}
        <div className="flex flex-col items-center mb-7">
          <div className="relative">
            <div className="absolute -inset-2 rounded-3xl bg-gradient-to-br from-purple-500/40 via-fuchsia-500/20 to-cyan-500/30 blur-xl opacity-80" />
            <img
              src={`${import.meta.env.BASE_URL}logo.jpg`}
              alt="SOUQRATES SYSTEM"
              className="relative w-24 h-24 rounded-2xl object-cover ring-1 ring-white/15 shadow-[0_10px_40px_rgba(168,85,247,0.45)]"
            />
          </div>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight gradient-text">SOUQRATES SYSTEM</h1>
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] border border-white/15 text-[12px] text-white/80">
            <Sparkles className="w-3.5 h-3.5 text-purple-300" />
            {t("agreement.badge")}
          </div>
        </div>

        {/* Contract */}
        <Card className="relative mb-6 border border-white/10 bg-white/[0.03] backdrop-blur-2xl rounded-2xl overflow-hidden shadow-[0_10px_50px_rgba(0,0,0,0.4)]">
          {/* top hair-line accent */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-400/60 to-transparent" />
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-3 text-white/80">
              <div className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-400/25 flex items-center justify-center">
                <ScrollText className="w-3.5 h-3.5 text-purple-300" />
              </div>
              <span className="text-sm font-bold tracking-wide">{t("agreement.contractTitle")}</span>
            </div>
            <div className="bg-black/30 border border-white/8 rounded-xl p-4 max-h-72 overflow-y-auto whitespace-pre-wrap text-[13.5px] leading-7 text-white/80">
              {loadingText ? (
                <div className="flex items-center gap-2 text-white/50">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("agreement.loading")}
                </div>
              ) : (
                content || t("agreement.empty")
              )}
            </div>
          </CardContent>
        </Card>

        {/* Form */}
        <Card className="relative border border-white/10 bg-white/[0.03] backdrop-blur-2xl rounded-2xl overflow-hidden shadow-[0_10px_50px_rgba(0,0,0,0.4)]">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
          <CardContent className="p-6">
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className={labelStyles}>{t("agreement.fullName")}</Label>
                  <Input id="name" required value={name} onChange={e => setName(e.target.value)} placeholder={t("agreement.fullName.ph")} className={inputStyles} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className={labelStyles}>{t("agreement.email")}</Label>
                  <Input id="email" required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" dir="ltr" className={inputStyles} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className={labelStyles}>
                  {t("agreement.phone")} <span className="text-white/55 text-xs font-normal">{t("agreement.optional")}</span>
                </Label>
                <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+970 …" dir="ltr" className={inputStyles} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className={labelStyles}>
                  {t("agreement.notes")} <span className="text-white/55 text-xs font-normal">{t("agreement.optional")}</span>
                </Label>
                <Textarea
                  id="notes"
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder={t("agreement.notes.ph")}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:border-purple-400/60 focus-visible:ring-2 focus-visible:ring-purple-500/20 rounded-xl"
                />
              </div>

              {/* Signature pad */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className={labelStyles}>{t("agreement.signature")}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handle.clear()}
                    className="h-7 text-xs text-white/70 hover:text-white hover:bg-white/10"
                  >
                    <Eraser className="w-3.5 h-3.5 ms-1" />
                    {t("agreement.clear")}
                  </Button>
                </div>
                <div className="relative rounded-xl p-[1.5px] bg-gradient-to-br from-purple-500/50 via-fuchsia-500/30 to-cyan-500/50">
                  <div className="rounded-[10px] border-2 border-dashed border-white/20 bg-white overflow-hidden">
                    <canvas
                      ref={canvasRef}
                      className="block w-full h-44 touch-none cursor-crosshair"
                      aria-label="signature pad"
                    />
                  </div>
                </div>
                <p className="text-[12px] text-white/65">
                  {t("agreement.signHint")}
                </p>
              </div>

              {error && (
                <div className="rounded-xl bg-rose-500/10 border border-rose-400/30 text-rose-200 text-sm px-3 py-2.5 backdrop-blur">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-12 text-base font-bold text-white rounded-xl border-0
                           bg-gradient-to-r from-purple-600 via-fuchsia-600 to-purple-700
                           hover:from-purple-500 hover:via-fuchsia-500 hover:to-purple-600
                           shadow-[0_8px_30px_rgba(168,85,247,0.45)]
                           transition-transform active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin ms-2" />
                    {t("agreement.submitting")}
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 ms-2" />
                    {t("agreement.submit")}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-[12px] text-white/60 mt-6 mb-2 tracking-wider">
          {t("agreement.footer")}
        </p>
      </div>
    </div>
  );
}

export default Agreement;

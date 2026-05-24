import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Eraser, ScrollText } from "lucide-react";

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

export function Agreement() {
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
    if (handle.isEmpty()) { setError("الرجاء التوقيع بإصبعك في المربع أدناه"); return; }
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
      if (!res.ok) { setError(j?.error || "فشل الإرسال — حاول مرة أخرى"); return; }
      setDone(true);
    } catch {
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-b from-slate-50 to-slate-100">
        <Card className="max-w-md w-full border-0 shadow-xl">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">تم استلام توقيعك بنجاح</h2>
            <p className="text-slate-600">شكرًا {name}. تم حفظ الاتفاقية الموقّعة وسيتم التواصل معك عبر بريدك الإلكتروني عند الحاجة.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Logo + title */}
        <div className="flex flex-col items-center mb-6">
          <img
            src={`${import.meta.env.BASE_URL}logo.jpg`}
            alt="SOUQRATES SYSTEM"
            className="w-24 h-24 rounded-2xl shadow-lg ring-1 ring-slate-200 object-cover"
          />
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-800">SOUQRATES SYSTEM</h1>
          <p className="text-sm text-slate-500 mt-1">اتفاقية المستخدم — Agreement Form</p>
        </div>

        {/* Contract */}
        <Card className="border-0 shadow-md mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-3 text-slate-700">
              <ScrollText className="w-4 h-4" />
              <span className="text-sm font-semibold">نص الاتفاقية</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 max-h-72 overflow-y-auto whitespace-pre-wrap text-[13.5px] leading-7 text-slate-700">
              {loadingText ? "جاري التحميل…" : content || "لا توجد اتفاقية منشورة حاليًا."}
            </div>
          </CardContent>
        </Card>

        {/* Form */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">الاسم الكامل *</Label>
                  <Input id="name" required value={name} onChange={e => setName(e.target.value)} placeholder="مثال: أحمد محمد" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">البريد الإلكتروني *</Label>
                  <Input id="email" required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" dir="ltr" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">رقم الهاتف <span className="text-slate-400 text-xs">(اختياري)</span></Label>
                <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+970 …" dir="ltr" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">ملاحظات <span className="text-slate-400 text-xs">(اختياري)</span></Label>
                <Textarea id="notes" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="أي ملاحظة تودّ إضافتها للإدارة" />
              </div>

              {/* Signature pad */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>التوقيع بالإصبع *</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => handle.clear()} className="h-7 text-xs">
                    <Eraser className="w-3.5 h-3.5 ms-1" />
                    مسح
                  </Button>
                </div>
                <div className="rounded-lg border-2 border-dashed border-slate-300 bg-white overflow-hidden">
                  <canvas
                    ref={canvasRef}
                    className="block w-full h-44 touch-none cursor-crosshair"
                    aria-label="signature pad"
                  />
                </div>
                <p className="text-[11px] text-slate-400">استخدم إصبعك (أو الفأرة على سطح المكتب) للتوقيع داخل المربع.</p>
              </div>

              {error && (
                <div className="rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-sm px-3 py-2">{error}</div>
              )}

              <Button type="submit" disabled={submitting} className="w-full h-11 text-base font-semibold bg-slate-900 hover:bg-slate-800 text-white">
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin ms-2" /> جاري الإرسال…</> : "Submit"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400 mt-6">© SOUQRATES SYSTEM</p>
      </div>
    </div>
  );
}

export default Agreement;

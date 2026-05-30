import { useState } from "react";
import { useLocation } from "wouter";
import { useApply, uploadIdPhoto, useSubAgentMe } from "../lib/use-subagent";
import { Loader2, Upload, Check } from "lucide-react";

export function SubAgentsApply() {
  const [, navigate] = useLocation();
  const apply = useApply();
  const { data: me } = useSubAgentMe();
  const [form, setForm] = useState({
    fullName: "", dob: "", country: "", phone: "", email: "", address: "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // If already pending/approved, redirect
  if (me?.status === "pending") { navigate("/subagents/pending"); return null; }
  if (me?.status === "approved") { navigate("/subagents/dashboard"); return null; }

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function handleUpload() {
    if (!photoFile) return;
    setErr(null);
    setUploading(true);
    try {
      const path = await uploadIdPhoto(photoFile);
      setUploadedPath(path);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!uploadedPath) {
      setErr("يجب رفع صورة بطاقة الهوية أولاً");
      return;
    }
    try {
      await apply.mutateAsync({
        fullName: form.fullName.trim(),
        dob: form.dob,
        country: form.country.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        address: form.address.trim(),
        idPhotoPath: uploadedPath,
      });
      navigate("/subagents/pending");
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  const canSubmit = form.fullName && form.dob && form.country && form.phone && form.address && uploadedPath && !apply.isPending;

  return (
    <div className="px-4 pt-4 pb-8 space-y-4" dir="rtl">
      <div className="text-center pt-2">
        <h1 className="text-xl font-black">طلب اعتماد شريك</h1>
        <p className="text-xs text-white/50 mt-1">SOUQRATES SUB-AGENTS — كل البيانات سرّية</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="الاسم الكامل" value={form.fullName} onChange={(v) => update("fullName", v)} required />
        <Field label="تاريخ الميلاد" type="date" value={form.dob} onChange={(v) => update("dob", v)} required />
        <Field label="الدولة" value={form.country} onChange={(v) => update("country", v)} required />
        <Field label="رقم الهاتف" type="tel" value={form.phone} onChange={(v) => update("phone", v)} required />
        <Field label="البريد الإلكتروني (اختياري)" type="email" value={form.email} onChange={(v) => update("email", v)} />
        <Field label="العنوان" value={form.address} onChange={(v) => update("address", v)} required multiline />

        <div className="space-y-2">
          <label className="text-xs font-bold text-white/80">صورة بطاقة الهوية (وجه + خلف في صورة واحدة)</label>
          <div className="glass-card rounded-2xl p-4 space-y-3">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => { setPhotoFile(e.target.files?.[0] ?? null); setUploadedPath(null); }}
              className="block w-full text-xs text-white/70 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-white/10 file:text-white"
            />
            {photoFile && !uploadedPath && (
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold bg-amber-500/20 text-amber-300 disabled:opacity-50"
              >
                {uploading ? <><Loader2 className="animate-spin" size={16} /> جاري الرفع…</> : <><Upload size={16} /> ارفع الصورة</>}
              </button>
            )}
            {uploadedPath && (
              <div className="flex items-center gap-2 text-green-400 text-xs">
                <Check size={16} /> تم رفع الصورة بنجاح
              </div>
            )}
          </div>
        </div>

        {err && <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-300">{err}</div>}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full py-4 rounded-2xl font-bold text-base text-white disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, #D4AF37, #b8941f)" }}
        >
          {apply.isPending ? "جاري الإرسال…" : "♛ إرسال الطلب"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required, multiline }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; multiline?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-bold text-white/80">{label}{required && <span className="text-amber-400"> *</span>}</label>
      {multiline ? (
        <textarea
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/50"
        />
      ) : (
        <input
          type={type}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/50"
        />
      )}
    </div>
  );
}

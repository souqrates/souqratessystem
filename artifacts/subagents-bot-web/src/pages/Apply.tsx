import { useState } from "react";
import { useLocation } from "wouter";
import { useApplySubAgent, useGetSubAgentIdPhotoUploadUrl } from "@workspace/api-client-react";
import { Loader2, UploadCloud, FileImage, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function ApplyPage() {
  const [, setLocation] = useLocation();
  const applyMutation = useApplySubAgent();
  const getUploadUrlMutation = useGetSubAgentIdPhotoUploadUrl();

  const [form, setForm] = useState({
    fullName: "",
    dob: "",
    country: "",
    phone: "",
    email: "",
    address: "",
  });

  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [objectPath, setObjectPath] = useState<string>("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type)) {
      toast.error("صيغة الملف غير مدعومة. يرجى رفع صورة (JPG, PNG, WEBP)");
      return;
    }

    if (selected.size > 8 * 1024 * 1024) {
      toast.error("حجم الصورة يجب أن لا يتجاوز 8 ميجابايت");
      return;
    }

    setFile(selected);
    setObjectPath("");
    setUploadStatus("idle");
  };

  const uploadPhoto = async () => {
    if (!file) return false;
    
    setUploadStatus("uploading");
    try {
      const { uploadUrl, objectPath: path } = await getUploadUrlMutation.mutateAsync({
        data: {
          contentType: file.type,
          sizeBytes: file.size,
        }
      });

      const res = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!res.ok) throw new Error("Upload failed");

      setObjectPath(path);
      setUploadStatus("success");
      return path;
    } catch (err) {
      console.error(err);
      setUploadStatus("error");
      toast.error("فشل رفع الصورة، يرجى المحاولة مرة أخرى");
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.dob || !form.country || !form.phone || !form.address) {
      toast.error("يرجى تعبئة جميع الحقول المطلوبة");
      return;
    }

    let finalPath = objectPath;
    if (!finalPath) {
      const uploaded = await uploadPhoto();
      if (!uploaded) return;
      finalPath = uploaded as string;
    }

    try {
      await applyMutation.mutateAsync({
        data: {
          ...form,
          idPhotoPath: finalPath,
        }
      });
      toast.success("تم إرسال الطلب بنجاح");
      setLocation("/pending");
    } catch (err: any) {
      toast.error(err?.message || "حدث خطأ أثناء تقديم الطلب");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <div className="bg-primary text-primary-foreground p-6 pt-12 pb-8 rounded-b-3xl shadow-sm mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="text-secondary" />
          طلب الانضمام كشريك
        </h1>
        <p className="text-primary-foreground/80 text-sm mt-2">
          يرجى تعبئة البيانات بدقة لتسريع عملية المراجعة (KYC).
        </p>
      </div>

      <form onSubmit={handleSubmit} className="px-4 space-y-5">
        <div className="space-y-4 bg-card p-5 rounded-2xl border shadow-sm">
          <div>
            <label className="block text-sm font-medium mb-1.5">الاسم الثلاثي كما في الهوية *</label>
            <input 
              required minLength={2} maxLength={120}
              type="text" 
              className="w-full bg-background border border-input rounded-lg h-11 px-3 outline-none focus:ring-2 focus:ring-primary/20" 
              value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">تاريخ الميلاد *</label>
            <input 
              required
              type="date" 
              className="w-full bg-background border border-input rounded-lg h-11 px-3 outline-none focus:ring-2 focus:ring-primary/20" 
              value={form.dob} onChange={e => setForm({...form, dob: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">بلد الإقامة *</label>
            <input 
              required minLength={2} maxLength={80}
              type="text" 
              className="w-full bg-background border border-input rounded-lg h-11 px-3 outline-none focus:ring-2 focus:ring-primary/20" 
              value={form.country} onChange={e => setForm({...form, country: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">رقم الجوال (مع كود الدولة) *</label>
            <input 
              required minLength={5} maxLength={40}
              type="tel" dir="ltr"
              placeholder="+971501234567"
              className="w-full bg-background border border-input rounded-lg h-11 px-3 outline-none focus:ring-2 focus:ring-primary/20 text-left" 
              value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">البريد الإلكتروني (اختياري)</label>
            <input 
              type="email" dir="ltr"
              className="w-full bg-background border border-input rounded-lg h-11 px-3 outline-none focus:ring-2 focus:ring-primary/20 text-left" 
              value={form.email} onChange={e => setForm({...form, email: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">العنوان الكامل *</label>
            <textarea 
              required minLength={5} maxLength={500} rows={3}
              className="w-full bg-background border border-input rounded-lg py-2 px-3 outline-none focus:ring-2 focus:ring-primary/20 resize-none" 
              value={form.address} onChange={e => setForm({...form, address: e.target.value})}
            />
          </div>
        </div>

        <div className="bg-card p-5 rounded-2xl border shadow-sm space-y-4">
          <label className="block text-sm font-medium">صورة إثبات الهوية (جواز سفر أو هوية وطنية) *</label>
          
          <div className="relative">
            <input 
              type="file" 
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              disabled={uploadStatus === "uploading" || uploadStatus === "success"}
            />
            <div className={`w-full border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-colors ${
              uploadStatus === "success" ? "border-green-500 bg-green-50/50 dark:bg-green-900/10" :
              uploadStatus === "error" ? "border-red-500 bg-red-50/50 dark:bg-red-900/10" :
              "border-input hover:bg-accent/50 bg-background"
            }`}>
              {uploadStatus === "success" ? (
                <>
                  <ShieldCheck className="w-8 h-8 text-green-500" />
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">تم الرفع بنجاح</span>
                </>
              ) : uploadStatus === "uploading" ? (
                <>
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <span className="text-sm font-medium text-muted-foreground">جاري الرفع...</span>
                </>
              ) : file ? (
                <>
                  <FileImage className="w-8 h-8 text-primary" />
                  <span className="text-sm font-medium">{file.name}</span>
                  <span className="text-xs text-muted-foreground">انقر للتغيير</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-8 h-8 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">انقر لاختيار صورة</span>
                  <span className="text-xs text-muted-foreground">JPG, PNG, WEBP (Max 8MB)</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="pt-4 pb-8">
          <Button 
            type="submit" 
            className="w-full h-12 text-base font-bold bg-secondary text-secondary-foreground hover:bg-secondary/90"
            disabled={!file || applyMutation.isPending || uploadStatus === "uploading"}
          >
            {applyMutation.isPending || uploadStatus === "uploading" ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : "إرسال الطلب"}
          </Button>
        </div>
      </form>
    </div>
  );
}

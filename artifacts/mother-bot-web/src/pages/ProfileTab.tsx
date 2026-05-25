import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMe, updateMe, uploadAvatar } from "@/lib/api";
import { haptic } from "@/lib/telegram";
import Avatar from "@/components/Avatar";

export default function ProfileTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (data?.profile) {
      setName(data.profile.displayName ?? data.profile.firstName ?? "");
    }
  }, [data?.profile.displayName, data?.profile.firstName]);

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-48" />
        <div className="skeleton h-32" />
      </div>
    );
  }

  const { profile } = data;
  const displayName = profile.displayName || profile.firstName;

  const flash = (kind: "ok" | "err", msg: string) => {
    if (kind === "ok") {
      setOk(msg);
      setErr(null);
      haptic("success");
    } else {
      setErr(msg);
      setOk(null);
      haptic("error");
    }
    setTimeout(() => {
      setOk(null);
      setErr(null);
    }, 3500);
  };

  const onPickAvatar = () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) {
      flash("err", "حجم الصورة يجب أن لا يتجاوز 3 ميجابايت");
      return;
    }
    setUploading(true);
    try {
      const { url } = await uploadAvatar(f);
      await updateMe({ avatarUrl: url });
      await qc.invalidateQueries({ queryKey: ["me"] });
      flash("ok", "تم تحديث الصورة ✓");
    } catch (e: any) {
      flash("err", e?.message || "فشل رفع الصورة");
    } finally {
      setUploading(false);
    }
  };

  const onSaveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      flash("err", "الاسم لا يمكن أن يكون فارغًا");
      return;
    }
    if (trimmed.length > 40) {
      flash("err", "الاسم طويل جدًا (40 حرفًا كحد أقصى)");
      return;
    }
    setSavingName(true);
    try {
      await updateMe({ displayName: trimmed });
      await qc.invalidateQueries({ queryKey: ["me"] });
      flash("ok", "تم حفظ الاسم ✓");
    } catch (e: any) {
      flash("err", e?.message || "فشل الحفظ");
    } finally {
      setSavingName(false);
    }
  };

  const onRemoveAvatar = async () => {
    setUploading(true);
    try {
      await updateMe({ avatarUrl: "" });
      await qc.invalidateQueries({ queryKey: ["me"] });
      flash("ok", "تم حذف الصورة");
    } catch (e: any) {
      flash("err", e?.message || "فشل الحذف");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="panel-gold p-5 text-center">
        <div className="flex justify-center mb-3">
          <Avatar src={profile.avatarUrl} name={displayName} size={96} ring />
        </div>
        <div className="font-extrabold text-lg">{displayName}</div>
        {profile.username && (
          <div className="text-mute text-sm">@{profile.username}</div>
        )}
        <div className="text-mute text-xs mt-1">رقم Telegram: {profile.telegramId}</div>

        <div className="flex gap-2 justify-center mt-4">
          <button className="btn-gold" disabled={uploading} onClick={onPickAvatar}>
            {uploading ? "جارٍ الرفع…" : "📷 تغيير الصورة"}
          </button>
          {profile.avatarUrl && (
            <button className="btn-ghost" disabled={uploading} onClick={onRemoveAvatar}>
              حذف
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={onFile}
          className="hidden"
        />
        <div className="text-[10px] text-mute mt-3">
          PNG / JPG / WEBP — حتى 3 ميجابايت
        </div>
      </div>

      <div className="panel p-5">
        <label className="block text-sm font-bold text-mute mb-2">
          الاسم المعروض
        </label>
        <input
          className="input mb-3"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="اكتب اسمك..."
        />
        <button className="btn-gold w-full" disabled={savingName} onClick={onSaveName}>
          {savingName ? "جارٍ الحفظ…" : "💾 حفظ الاسم"}
        </button>
        <div className="text-[11px] text-mute mt-2">
          الحد الأقصى 40 حرفًا. يظهر هذا الاسم على لوحة المتصدّرين وفي ملفك.
        </div>
      </div>

      {(ok || err) && (
        <div
          className={`p-3 rounded-xl font-bold text-center text-sm ${
            ok ? "bg-emerald/15 text-emerald border border-emerald/40" : "bg-rose/15 text-rose border border-rose/40"
          }`}
        >
          {ok || err}
        </div>
      )}
    </div>
  );
}

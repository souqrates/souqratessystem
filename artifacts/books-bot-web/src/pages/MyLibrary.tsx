import { useEffect, useState } from "react";
import { Download, BookOpen, Clock, AlertCircle, ShoppingBag, Loader2, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { TELEGRAM_BOT_URL } from "@/lib/constants";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        ready: () => void;
        expand: () => void;
        colorScheme?: "light" | "dark";
      };
    };
  }
}

type Purchase = {
  id: number;
  productId: number;
  title: string | null;
  description: string | null;
  coverUrl: string | null;
  fileSize: number | null;
  pricePaid: string;
  downloadUrl: string;
  downloadExpiresAt: string;
  createdAt: string;
  expired: boolean;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
}

function daysLeft(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

function PurchaseCard({ p, onDownload }: { p: Purchase; onDownload: (url: string, title: string) => void }) {
  const days = daysLeft(p.downloadExpiresAt);
  const urgent = !p.expired && days <= 3;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(160deg,#0c0b18,#100f1f)",
        border: `1px solid ${p.expired ? "rgba(239,68,68,0.2)" : "rgba(34,211,238,0.15)"}`,
        boxShadow: p.expired ? "none" : "0 4px 24px rgba(34,211,238,0.05)",
      }}
    >
      <div className="flex gap-4 p-4">
        {/* Cover thumbnail */}
        <div
          className="flex-shrink-0 w-16 h-20 rounded-xl flex items-center justify-center"
          style={{
            background: p.coverUrl ? undefined : "rgba(34,211,238,0.06)",
            border: "1px solid rgba(34,211,238,0.12)",
            overflow: "hidden",
          }}
        >
          {p.coverUrl ? (
            <img src={p.coverUrl} alt={p.title ?? ""} className="w-full h-full object-cover" />
          ) : (
            <BookOpen size={22} color="rgba(34,211,238,0.4)" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm text-white/90 leading-snug mb-1 truncate">
            {p.title ?? "كتاب"}
          </h3>
          <div className="text-xs mb-2" style={{ color: "rgba(148,163,184,0.5)" }}>
            اشتريت في {formatDate(p.createdAt)}
            {p.fileSize ? ` · ${formatBytes(p.fileSize)}` : ""}
          </div>

          {/* Expiry badge */}
          {p.expired ? (
            <div className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
              style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertCircle size={10} />
              انتهت صلاحية التنزيل
            </div>
          ) : (
            <div className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
              style={{
                background: urgent ? "rgba(245,158,11,0.1)" : "rgba(16,185,129,0.1)",
                color: urgent ? "#f59e0b" : "#10b981",
                border: `1px solid ${urgent ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.2)"}`,
              }}>
              <Clock size={10} />
              {days === 0 ? "آخر يوم للتنزيل!" : `متاح للتنزيل · ${days} يوم`}
            </div>
          )}
        </div>
      </div>

      {/* Download button */}
      {!p.expired && (
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={() => onDownload(p.downloadUrl, p.title ?? "كتاب")}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-sm transition-all hover:-translate-y-0.5 active:scale-95"
            style={{ background: "linear-gradient(135deg,#0e7490,#22d3ee)", color: "#04030a" }}
          >
            <Download size={15} />
            تنزيل الكتاب
          </button>
        </div>
      )}
    </div>
  );
}

export default function MyLibrary() {
  const [initData, setInitData] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      const data = tg.initData;
      if (data) {
        setInitData(data);
      } else {
        setError("يجب فتح هذه الصفحة من داخل تيليغرام.");
        setLoading(false);
      }
    } else {
      setError("يجب فتح هذه الصفحة من داخل بوت تيليغرام SOUQRATES SOUQ.");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initData) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const r = await fetch(`/api/books/my-library?initData=${encodeURIComponent(initData)}`);
        if (!r.ok) {
          const body = await r.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? `خطأ ${r.status}`);
        }
        const json = (await r.json()) as { data: Purchase[] };
        if (!cancelled) setPurchases(json.data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "حدث خطأ");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [initData]);

  async function handleDownload(url: string, title: string) {
    if (downloading) return;
    setDownloading(url);
    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = title;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setTimeout(() => setDownloading(null), 1500);
    }
  }

  const active = purchases.filter((p) => !p.expired);
  const expired = purchases.filter((p) => p.expired);

  return (
    <section className="py-10 px-5 max-w-xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="eyebrow mb-1" style={{ color: "rgba(148,163,184,0.4)", fontSize: 9 }}>MY LIBRARY</div>
        <h1 className="font-orbitron font-black text-2xl text-white/90 mb-2">مكتبتي</h1>
        <p className="text-xs" style={{ color: "rgba(148,163,184,0.5)" }}>
          كتبك المشتراة — قابلة للتنزيل مباشرة خلال 7 أيام من الشراء
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center py-20 gap-3">
          <Loader2 size={28} color="#22d3ee" className="animate-spin" />
          <p className="text-sm" style={{ color: "rgba(148,163,184,0.5)" }}>جار تحميل مكتبتك…</p>
        </div>
      )}

      {/* Error — not in Telegram */}
      {!loading && error && (
        <div className="rounded-2xl p-6 text-center"
          style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
          <div className="text-3xl mb-3">🔒</div>
          <p className="font-bold text-sm text-white/80 mb-1">{error}</p>
          <p className="text-xs mb-5" style={{ color: "rgba(148,163,184,0.5)" }}>
            افتح البوت ثم اضغط على "مكتبتي" للوصول إلى كتبك
          </p>
          <a
            href={TELEGRAM_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm"
            style={{ background: "linear-gradient(135deg,#0e7490,#22d3ee)", color: "#04030a" }}
          >
            <ExternalLink size={13} />
            افتح في تيليغرام
          </a>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && purchases.length === 0 && (
        <div className="rounded-2xl p-8 text-center"
          style={{ background: "rgba(34,211,238,0.03)", border: "1px solid rgba(34,211,238,0.1)" }}>
          <div className="text-4xl mb-4">📚</div>
          <p className="font-bold text-sm text-white/70 mb-1">مكتبتك فارغة بعد</p>
          <p className="text-xs mb-5" style={{ color: "rgba(148,163,184,0.45)" }}>
            اشترِ أول كتاب وستظهر هنا فوراً
          </p>
          <Link
            href="/library"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm"
            style={{ background: "linear-gradient(135deg,#0e7490,#22d3ee)", color: "#04030a" }}
          >
            <ShoppingBag size={13} />
            تصفح الكتب
          </Link>
        </div>
      )}

      {/* Active purchases */}
      {!loading && !error && active.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#10b981" }} />
            <span className="text-xs font-black" style={{ color: "#10b981" }}>
              {active.length} كتاب متاح للتنزيل
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {active.map((p) => (
              <PurchaseCard key={p.id} p={p} onDownload={handleDownload} />
            ))}
          </div>
        </div>
      )}

      {/* Expired purchases */}
      {!loading && !error && expired.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "rgba(239,68,68,0.6)" }} />
            <span className="text-xs font-black" style={{ color: "rgba(239,68,68,0.6)" }}>
              {expired.length} كتاب انتهت صلاحيته
            </span>
          </div>
          <div className="flex flex-col gap-3 opacity-60">
            {expired.map((p) => (
              <PurchaseCard key={p.id} p={p} onDownload={handleDownload} />
            ))}
          </div>
          <p className="text-xs text-center mt-3" style={{ color: "rgba(148,163,184,0.35)" }}>
            انتهت نافذة التنزيل (7 أيام). تواصل مع الدعم عبر تيليغرام.
          </p>
        </div>
      )}

      {/* Download overlay */}
      {downloading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-3 px-5 py-3 rounded-2xl font-black text-sm"
            style={{ background: "rgba(34,211,238,0.95)", color: "#04030a", boxShadow: "0 8px 32px rgba(34,211,238,0.3)" }}>
            <Loader2 size={16} className="animate-spin" />
            جار التنزيل…
          </div>
        </div>
      )}
    </section>
  );
}

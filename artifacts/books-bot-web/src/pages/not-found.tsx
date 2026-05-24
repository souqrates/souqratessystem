import { Link } from "wouter";
import { Ornament } from "@/components/Ornaments";

export default function NotFound() {
  return (
    <section className="py-32 px-6 text-center">
      <div className="eyebrow mb-4" dir="ltr" lang="en" style={{ color: "var(--gold)" }}>
        Error · 404
      </div>
      <h1 className="font-display mb-6" style={{ color: "var(--ink)", fontSize: "clamp(2rem, 5vw, 3rem)" }}>
        الصفحة غير موجودة.
      </h1>
      <Ornament className="mb-8" />
      <p className="max-w-md mx-auto mb-8" style={{ color: "var(--muted)" }}>
        ربما حُذف العنوان أو نُقل إلى موضعٍ آخر. عد إلى الواجهة لاستكشاف المكتبة.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-6 py-3 text-sm"
        style={{ background: "var(--ink)", color: "var(--ivory)" }}
        data-testid="link-not-found-home"
      >
        العودة إلى الواجهة
      </Link>
    </section>
  );
}

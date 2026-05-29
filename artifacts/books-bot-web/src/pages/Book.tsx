import { Link, useParams } from "wouter";
import { ArrowLeft, Star, Download, ShieldCheck, Clock, BookOpen } from "lucide-react";
import { findCategory } from "@/lib/catalog";
import { useBooks } from "@/lib/api";
import { BookCard } from "@/components/BookCard";
import { buyOnTelegram } from "@/lib/constants";
import NotFound from "./not-found";

export default function Book() {
  const params = useParams<{ id: string }>();
  const { books, loading } = useBooks();
  const book = books.find((b) => b.id === (params.id ?? ""));

  if (loading) {
    return (
      <div className="text-center py-32">
        <div className="text-3xl mb-4">📖</div>
        <p className="text-sm" style={{ color: 'rgba(148,163,184,0.5)' }}>جار التحميل...</p>
      </div>
    );
  }
  if (!book) return <NotFound />;

  const category = findCategory(book.category);
  const related = books.filter((b) => b.category === book.category && b.id !== book.id).slice(0, 4);

  return (
    <>
      <section className="py-10 md:py-16">
        <div className="max-w-5xl mx-auto px-6">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-8 text-xs" style={{ color: 'rgba(148,163,184,0.45)' }}>
            <Link href="/" data-testid="bc-home" className="hover:text-white/60 transition-colors">الرئيسية</Link>
            <span>/</span>
            <Link href="/library" data-testid="bc-library" className="hover:text-white/60 transition-colors">الكتب</Link>
            {category && (
              <>
                <span>/</span>
                <Link href={`/category/${category.slug}`} data-testid="bc-category" className="hover:text-white/60 transition-colors">
                  {category.name}
                </Link>
              </>
            )}
            <span>/</span>
            <span className="text-white/60 truncate max-w-[120px]">{book.title}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8 md:gap-12 items-start">

            {/* Cover */}
            <div className="mx-auto md:mx-0 w-full max-w-[240px]">
              <div
                className="relative flex flex-col items-center justify-center p-6 rounded-2xl"
                style={{
                  aspectRatio: '3 / 4',
                  background: 'linear-gradient(160deg, #0c0b18 0%, #100f1f 100%)',
                  border: '1px solid rgba(34,211,238,0.2)',
                  boxShadow: '0 20px 60px rgba(34,211,238,0.08)',
                }}
              >
                <div className="text-5xl mb-4">
                  {book.category === 'audio' ? '🎧' : '📖'}
                </div>
                <div className="text-center">
                  <div className="font-bold text-sm text-white/90 mb-2 leading-snug">{book.title}</div>
                  <div className="h-px w-12 mx-auto mb-2" style={{ background: 'rgba(34,211,238,0.4)' }} />
                  <div className="text-xs" style={{ color: 'rgba(148,163,184,0.55)' }}>{book.author}</div>
                </div>
                <div className="absolute top-3 right-3 text-[9px] font-black px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.2)' }}>
                  {book.year}
                </div>
              </div>
            </div>

            {/* Details */}
            <div>
              {/* Category badge */}
              {category && (
                <div className="inline-flex items-center gap-1.5 mb-4 px-3 py-1 rounded-full text-xs font-black"
                  style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.25)' }}>
                  {category.name}
                </div>
              )}

              <h1 className="font-orbitron font-black text-2xl md:text-3xl text-white/90 mb-3">
                {book.title}
              </h1>
              <p className="text-sm mb-5" style={{ color: 'rgba(148,163,184,0.6)' }}>
                {book.author} · <span dir="ltr">{book.year}</span>
              </p>

              {/* Stats */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center gap-1.5">
                  <Star size={14} fill="#f59e0b" stroke="none" />
                  <span className="font-bold text-sm text-white/80" dir="ltr">{book.rating.toFixed(1)}</span>
                  <span className="text-xs" style={{ color: 'rgba(148,163,184,0.45)' }} dir="ltr">({book.ratingCount})</span>
                </div>
                {book.pages && (
                  <div className="flex items-center gap-1.5 text-sm" style={{ color: 'rgba(148,163,184,0.6)' }}>
                    <BookOpen size={14} />
                    <span>{book.pages} صفحة</span>
                  </div>
                )}
                {book.duration && (
                  <div className="flex items-center gap-1.5 text-sm" style={{ color: 'rgba(148,163,184,0.6)' }}>
                    <Clock size={14} />
                    <span>{book.duration}</span>
                  </div>
                )}
              </div>

              {/* Excerpt */}
              <div className="neon-card rounded-xl p-5 mb-6">
                <p className="text-sm leading-loose" style={{ color: 'rgba(241,245,249,0.75)' }}>
                  {book.excerpt}
                </p>
              </div>

              {/* Price + CTA */}
              <div className="rounded-xl p-5 mb-5 flex items-center justify-between gap-4"
                style={{ background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.15)' }}>
                <div>
                  <div className="text-xs mb-1" style={{ color: 'rgba(148,163,184,0.5)' }}>السعر</div>
                  <div className="font-orbitron font-black text-2xl" style={{ color: '#22d3ee' }}>
                    {book.priceSkz.toLocaleString()} <span className="text-sm">SKZ</span>
                  </div>
                </div>
                <div className="text-xs text-end" style={{ color: 'rgba(148,163,184,0.5)' }}>
                  ادفع بـ Stars<br />أو USDT · TON
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={buyOnTelegram(book.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm transition-all hover:-translate-y-0.5"
                  style={{ background: 'linear-gradient(135deg,#0e7490,#22d3ee)', color: '#04030a' }}
                  data-testid="button-buy"
                >
                  اشترِ عبر تيليغرام
                  <ArrowLeft size={13} />
                </a>
                <Link
                  href={`/category/${book.category}`}
                  className="px-5 py-3 rounded-xl text-xs font-black border transition-all hover:border-cyan-500/30"
                  style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(148,163,184,0.7)' }}
                  data-testid="link-more-in-category"
                >
                  مزيد من الكتب في هذا القسم
                </Link>
              </div>

              {/* Assurances */}
              <ul className="mt-6 flex flex-wrap gap-4 text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>
                <li className="flex items-center gap-1.5"><ShieldCheck size={13} style={{ color: '#10b981' }} /> مضمون 100%</li>
                <li className="flex items-center gap-1.5"><Download size={13} style={{ color: '#22d3ee' }} /> تحميل فوري</li>
                <li className="flex items-center gap-1.5"><ShieldCheck size={13} style={{ color: '#a855f7' }} /> دعم 24/7</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="py-12 px-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="max-w-5xl mx-auto">
            <div className="mb-6">
              <div className="eyebrow mb-1" style={{ color: 'rgba(148,163,184,0.4)', fontSize: 9 }}>MORE BOOKS</div>
              <h2 className="font-orbitron font-black text-lg text-white/85">كتب مشابهة</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {related.map((b) => <BookCard key={b.id} book={b} />)}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

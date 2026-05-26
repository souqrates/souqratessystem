import { Link, useParams } from "wouter";
import { ArrowLeft, Star, Download, ShieldCheck, Clock, BookOpen } from "lucide-react";
import { findCategory } from "@/lib/catalog";
import { useBooks } from "@/lib/api";
import { BookCard } from "@/components/BookCard";
import { L, Ornament } from "@/components/Ornaments";
import { buyOnTelegram } from "@/lib/constants";
import { useT } from "@/lib/i18n";
import NotFound from "./not-found";

export default function Book() {
  const t = useT();
  const params = useParams<{ id: string }>();
  const { books, loading } = useBooks();
  const book = books.find((b) => b.id === (params.id ?? ""));

  if (loading) {
    return (
      <section className="py-32 text-center">
        <p className="text-sm" style={{ color: "var(--muted)" }}>{t("common.loadingLong")}</p>
      </section>
    );
  }
  if (!book) return <NotFound />;

  const category = findCategory(book.category);
  const related = books.filter((b) => b.category === book.category && b.id !== book.id).slice(0, 4);

  return (
    <>
      <section className="relative py-12 md:py-20">
        <div className="max-w-5xl mx-auto px-6 md:px-10">
          <div className="text-xs mb-6" style={{ color: "var(--muted)" }}>
            <Link href="/" className="refined" data-testid="bc-home">{t("book.bcHome")}</Link>
            <span className="mx-2" style={{ color: "var(--hairline)" }}>/</span>
            <Link href="/library" className="refined" data-testid="bc-library">{t("book.bcLibrary")}</Link>
            {category && (
              <>
                <span className="mx-2" style={{ color: "var(--hairline)" }}>/</span>
                <Link href={`/category/${category.slug}`} className="refined" data-testid="bc-category">{t(`cat.${category.slug}.name`)}</Link>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-10 md:gap-14 items-start">
            {/* Cover plate */}
            <div className="mx-auto md:mx-0 w-full max-w-[260px]">
              <div
                className="relative flex items-center justify-center"
                style={{
                  aspectRatio: "3 / 4",
                  background: "linear-gradient(135deg, var(--ink) 0%, #1f1c14 100%)",
                  border: "1px solid var(--gold)",
                }}
              >
                <div className="absolute" style={{ inset: 10, border: "1px solid var(--gold-line)" }} />
                <div className="relative px-6 text-center">
                  <div className="eyebrow mb-4" dir="ltr" lang="en" style={{ color: "var(--gold)" }}>
                    {t("book.coverVol", { year: book.year })}
                  </div>
                  <div className="font-display leading-snug" style={{ color: "var(--ivory)", fontSize: "1.25rem" }}>
                    {book.title}
                  </div>
                  <div className="mt-3 h-px w-12 mx-auto" style={{ background: "var(--gold)" }} />
                  <div className="eyebrow mt-3" style={{ color: "rgba(184,137,58,0.7)" }}>
                    {book.author}
                  </div>
                </div>
              </div>
            </div>

            {/* Details */}
            <div>
              <div className="eyebrow mb-3" dir="ltr" lang="en" style={{ color: "var(--gold)" }}>
                ❖ {category?.slug.replace("-", " ") ?? t("book.titleFallback")}
              </div>
              <h1 className="font-display mb-3" style={{ color: "var(--ink)", fontSize: "clamp(1.875rem, 4vw, 2.5rem)" }}>
                {book.title}
              </h1>
              <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
                {t("book.by")} <span style={{ color: "var(--ink)" }}>{book.author}</span>
                {" · "}
                <span dir="ltr" lang="en">{book.year}</span>
              </p>

              <div className="flex items-center gap-4 mb-6 text-sm" style={{ color: "var(--muted)" }}>
                <span className="inline-flex items-center gap-1">
                  <Star size={14} fill="var(--gold)" stroke="var(--gold)" />
                  <span dir="ltr" lang="en" style={{ color: "var(--ink)" }}>{book.rating.toFixed(1)}</span>
                  <span className="font-serif-en text-xs" dir="ltr" lang="en">({book.ratingCount})</span>
                </span>
                {book.pages && (
                  <span className="inline-flex items-center gap-1">
                    <BookOpen size={14} strokeWidth={1.5} />
                    {t("book.pages", { n: book.pages })}
                  </span>
                )}
                {book.duration && (
                  <span className="inline-flex items-center gap-1">
                    <Clock size={14} strokeWidth={1.5} />
                    {book.duration}
                  </span>
                )}
              </div>

              <Ornament className="my-6" />

              <p className="leading-loose mb-8" style={{ color: "var(--ink)" }}>
                {book.excerpt}
              </p>

              <div
                className="flex items-center justify-between p-5 mb-6"
                style={{ background: "var(--ivory)", border: "1px solid var(--hairline)" }}
              >
                <div>
                  <div className="eyebrow" dir="ltr" lang="en" style={{ color: "var(--gold)" }}>{t("book.price")}</div>
                  <div className="font-display text-2xl mt-1" style={{ color: "var(--emerald)" }}>
                    {book.priceSkz.toLocaleString()} {L("SKZ")}
                  </div>
                </div>
                <div className="text-xs text-end" style={{ color: "var(--muted)" }}>
                  {t("book.instantPay1")}<br />
                  <span dir="ltr" lang="en">{t("book.instantPay2")}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <a
                  href={buyOnTelegram(book.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-medium tracking-wide transition-transform hover:-translate-y-0.5"
                  style={{ background: "var(--ink)", color: "var(--ivory)" }}
                  data-testid="button-buy"
                >
                  {t("book.buy")}
                  <ArrowLeft size={14} strokeWidth={1.8} />
                </a>
                <Link
                  href={`/category/${book.category}`}
                  className="refined inline-flex items-center gap-1 text-sm px-2 py-2 cursor-pointer"
                  style={{ color: "var(--emerald)" }}
                  data-testid="link-more-in-category"
                >
                  {t("book.moreIn", { name: category ? t(`cat.${category.slug}.name`) : "" })}
                </Link>
              </div>

              <ul className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs" style={{ color: "var(--muted)" }}>
                <li className="inline-flex items-center gap-2"><ShieldCheck size={14} strokeWidth={1.5} style={{ color: "var(--gold)" }} /> {t("book.assure1")}</li>
                <li className="inline-flex items-center gap-2"><Download size={14} strokeWidth={1.5} style={{ color: "var(--gold)" }} /> {t("book.assure2")}</li>
                <li className="inline-flex items-center gap-2"><ShieldCheck size={14} strokeWidth={1.5} style={{ color: "var(--gold)" }} /> {t("book.assure3")}</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="py-16 md:py-20" style={{ borderTop: "1px solid var(--hairline)", background: "var(--ivory)" }}>
          <div className="max-w-6xl mx-auto px-6 md:px-10">
            <div className="mb-10 text-center">
              <div className="eyebrow mb-3" dir="ltr" lang="en" style={{ color: "var(--gold)" }}>{t("book.alsoEyebrow")}</div>
              <h2 className="font-display" style={{ color: "var(--ink)", fontSize: "clamp(1.5rem, 3vw, 2rem)" }}>
                {t("book.alsoTitle")}
              </h2>
            </div>
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
              style={{ borderTop: "1px solid var(--hairline)", borderRight: "1px solid var(--hairline)" }}
            >
              {related.map((b) => <BookCard key={b.id} book={b} />)}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

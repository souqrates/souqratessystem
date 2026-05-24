import { Link, useParams } from "wouter";
import { findCategory } from "@/lib/catalog";
import { useBooks } from "@/lib/api";
import { BookCard } from "@/components/BookCard";
import { Ornament } from "@/components/Ornaments";
import NotFound from "./not-found";

export default function Category() {
  const params = useParams<{ slug: string }>();
  const cat = findCategory(params.slug ?? "");
  const { books: all, loading } = useBooks();
  if (!cat) return <NotFound />;
  const books = all.filter((b) => b.category === cat.slug);

  return (
    <>
      <section className="relative py-16 md:py-20">
        <div className="max-w-4xl mx-auto px-6 md:px-10 text-center">
          <div className="eyebrow mb-4" dir="ltr" lang="en" style={{ color: "var(--gold)" }}>
            Chapter · {cat.slug.replace("-", " ")}
          </div>
          <h1 className="font-display mb-6" style={{ color: "var(--ink)", fontSize: "clamp(2rem, 4.5vw, 3rem)" }}>
            {cat.name}
          </h1>
          <Ornament className="mb-6" />
          <p className="text-sm md:text-base" style={{ color: "var(--muted)" }}>
            {cat.desc}
          </p>
        </div>
      </section>

      <section className="py-12 md:py-16" style={{ borderTop: "1px solid var(--hairline)" }}>
        <div className="max-w-6xl mx-auto px-6 md:px-10">
          {loading ? (
            <div className="text-center py-20">
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                جارٍ التحميل…
              </p>
            </div>
          ) : books.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                لا توجد عناوين في هذه الفئة بعد. عد قريبًا.
              </p>
            </div>
          ) : (
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              style={{ borderTop: "1px solid var(--hairline)", borderRight: "1px solid var(--hairline)" }}
            >
              {books.map((b) => <BookCard key={b.id} book={b} />)}
            </div>
          )}

          <div className="mt-12 flex items-center justify-center gap-6 text-sm">
            <Link href="/library" className="refined" style={{ color: "var(--emerald)" }} data-testid="link-all-library">
              ← كل المكتبة
            </Link>
            <span style={{ color: "var(--hairline)" }}>·</span>
            <Link href="/" className="refined" style={{ color: "var(--emerald)" }} data-testid="link-home">
              الواجهة
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

import { Link } from "wouter";
import { Star } from "lucide-react";
import type { Book } from "@/lib/catalog";
import { findCategory } from "@/lib/catalog";
import { L } from "./Ornaments";

export function BookCard({ book }: { book: Book }) {
  const cat = findCategory(book.category);
  return (
    <Link
      href={`/book/${book.id}`}
      className="group relative block cursor-pointer transition-colors hover:bg-[var(--ivory)] p-6 md:p-7"
      style={{ borderBottom: "1px solid var(--hairline)", borderLeft: "1px solid var(--hairline)" }}
      data-testid={`card-book-${book.id}`}
    >
      {/* Cover placeholder — gilded plate */}
      <div
        className="relative mb-5 mx-auto flex items-center justify-center"
        style={{
          width: "100%",
          aspectRatio: "3 / 4",
          background:
            "linear-gradient(135deg, var(--ink) 0%, #1f1c14 100%)",
          border: "1px solid var(--gold)",
        }}
      >
        <div className="absolute" style={{ inset: 8, border: "1px solid var(--gold-line)" }} />
        <div className="relative px-5 text-center">
          <div className="eyebrow mb-3" dir="ltr" lang="en" style={{ color: "var(--gold)" }}>
            ❖ Vol. {book.year}
          </div>
          <div
            className="font-display leading-snug"
            style={{ color: "var(--ivory)", fontSize: "clamp(0.95rem, 1.4vw, 1.15rem)" }}
          >
            {book.title}
          </div>
          <div className="mt-3 h-px w-10 mx-auto" style={{ background: "var(--gold)" }} />
          <div className="eyebrow mt-3" style={{ color: "rgba(184,137,58,0.7)" }}>
            {book.author}
          </div>
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-base mb-1 truncate" style={{ color: "var(--ink)" }}>
            {book.title}
          </h3>
          <p className="text-xs" style={{ color: "var(--muted)" }}>{book.author}</p>
        </div>
        <div className="text-end shrink-0">
          <div className="font-display text-sm" style={{ color: "var(--emerald)" }}>
            {book.priceSkz.toLocaleString()} {L("SKZ")}
          </div>
          <div className="flex items-center gap-1 mt-1 justify-end">
            <Star size={12} fill="var(--gold)" stroke="var(--gold)" />
            <span className="font-serif-en text-xs" dir="ltr" lang="en" style={{ color: "var(--muted)" }}>
              {book.rating.toFixed(1)}
            </span>
          </div>
        </div>
      </div>
      {cat && (
        <div className="mt-3 eyebrow" dir="ltr" lang="en" style={{ color: "var(--gold)" }}>
          {cat.slug.replace("-", " ")}
        </div>
      )}
    </Link>
  );
}

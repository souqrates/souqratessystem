import { Link } from "wouter";
import { Star, Volume2 } from "lucide-react";
import type { Book } from "@/lib/catalog";
import { findCategory } from "@/lib/catalog";

export function BookCard({ book }: { book: Book }) {
  const cat = findCategory(book.category);
  const isAudio = book.category === "audio";

  return (
    <Link
      href={`/book/${book.id}`}
      className="group neon-card relative block cursor-pointer rounded-xl overflow-hidden"
      data-testid={`card-book-${book.id}`}
    >
      {/* Cover */}
      <div
        className="relative flex flex-col items-center justify-center p-5"
        style={{
          aspectRatio: '3 / 4',
          background: 'linear-gradient(160deg, #0c0b18 0%, #100f1f 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Category badge */}
        <div
          className="absolute top-3 right-3 px-2 py-0.5 rounded-full eyebrow"
          style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.2)', fontSize: 8 }}
        >
          {cat?.slug.replace(/-/g, ' ') || book.category}
        </div>

        {/* Icon */}
        <div className="text-3xl mb-3">
          {isAudio ? '🎧' : '📖'}
        </div>

        {/* Title */}
        <div className="text-center px-2">
          <div className="font-bold text-sm leading-snug text-white/90 mb-2">{book.title}</div>
          <div className="text-[11px]" style={{ color: 'rgba(148,163,184,0.55)' }}>{book.author}</div>
        </div>

        {/* Neon bottom line on hover */}
        <div
          className="absolute bottom-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'linear-gradient(90deg, transparent, #22d3ee, transparent)' }}
        />
      </div>

      {/* Meta */}
      <div className="p-4">
        <h3 className="font-bold text-sm text-white/90 mb-1 truncate">{book.title}</h3>
        <p className="text-xs mb-3" style={{ color: 'rgba(148,163,184,0.55)' }}>
          {isAudio && book.duration ? `⏱ ${book.duration}` : book.author}
        </p>
        <div className="flex items-center justify-between">
          <div className="font-orbitron text-xs font-black" style={{ color: '#22d3ee' }}>
            {book.priceSkz.toLocaleString()} SKZ
          </div>
          <div className="flex items-center gap-1">
            <Star size={11} fill="#f59e0b" stroke="none" />
            <span className="text-xs" style={{ color: 'rgba(148,163,184,0.55)' }}>
              {book.rating.toFixed(1)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

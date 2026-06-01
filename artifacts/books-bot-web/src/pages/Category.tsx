import { Link, useParams } from "wouter";
import { ArrowLeft, BookOpen, GraduationCap, ScrollText, Baby, Brain, Headphones, type LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import { findCategory } from "@/lib/catalog";
import { useBooks } from "@/lib/api";
import { BookCard } from "@/components/BookCard";
import NotFound from "./not-found";

const CAT_COLORS: Record<string, string> = {
  religion:           '#22d3ee',
  education:          '#a855f7',
  literature:         '#ec4899',
  kids:               '#f59e0b',
  "self-development": '#10b981',
  audio:              '#06b6d4',
};

const CAT_ICONS: Record<string, ComponentType<LucideProps>> = {
  religion:           BookOpen,
  education:          GraduationCap,
  literature:         ScrollText,
  kids:               Baby,
  "self-development": Brain,
  audio:              Headphones,
};

export default function Category() {
  const params = useParams<{ slug: string }>();
  const cat = findCategory(params.slug ?? "");
  const { books: all, loading } = useBooks();
  if (!cat) return <NotFound />;
  const books = all.filter((b) => b.category === cat.slug);
  const color = CAT_COLORS[cat.slug] || '#22d3ee';
  const CatIcon = CAT_ICONS[cat.slug] ?? BookOpen;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-8 text-xs" style={{ color: 'rgba(148,163,184,0.45)' }}>
        <Link href="/" className="hover:text-white/60 transition-colors">الرئيسية</Link>
        <span>/</span>
        <Link href="/library" className="hover:text-white/60 transition-colors">الكتب</Link>
        <span>/</span>
        <span style={{ color }}>{ cat.name }</span>
      </div>

      {/* Category header */}
      <div className="rise mb-10">
        <div className="flex items-center gap-4 mb-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: `${color}12`, border: `1px solid ${color}25` }}
          >
            <CatIcon size={28} color={color} strokeWidth={1.6} />
          </div>
          <div>
            <h1 className="font-orbitron font-black text-2xl text-white/90">{cat.name}</h1>
            <div className="text-sm mt-1" style={{ color: 'rgba(148,163,184,0.55)' }}>{cat.desc}</div>
          </div>
        </div>
        {/* Accent line */}
        <div className="h-px w-full" style={{ background: `linear-gradient(90deg, ${color}50, transparent)` }} />
      </div>

      {/* Books */}
      {loading ? (
        <div className="text-center py-24">
          <CatIcon size={36} className="mx-auto mb-4" strokeWidth={1.4} style={{ color: `${color}70` }} />
          <div className="font-bold text-sm" style={{ color: 'rgba(148,163,184,0.5)' }}>جار التحميل...</div>
        </div>
      ) : books.length === 0 ? (
        <div className="text-center py-24">
          <BookOpen size={36} className="mx-auto mb-4" strokeWidth={1.4} style={{ color: 'rgba(148,163,184,0.3)' }} />
          <div className="font-bold text-sm mb-4" style={{ color: 'rgba(148,163,184,0.5)' }}>لا توجد كتب في هذا القسم بعد</div>
          <Link href="/library"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all"
            style={{ background: `${color}12`, color, border: `1px solid ${color}25` }}
            data-testid="link-all-library"
          >
            <ArrowLeft size={12} /> عرض كل الكتب
          </Link>
        </div>
      ) : (
        <>
          <div className="font-orbitron text-xs font-black mb-5" style={{ color: `${color}99` }}>
            {books.length} كتاب في هذا القسم
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {books.map((b) => <BookCard key={b.id} book={b} />)}
          </div>
        </>
      )}

      {/* Footer nav */}
      <div className="mt-10 flex items-center gap-4 text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>
        <Link href="/library" className="hover:text-white/60 transition-colors" data-testid="link-all-library">
          ← كل الكتب
        </Link>
        <span>·</span>
        <Link href="/" className="hover:text-white/60 transition-colors" data-testid="link-home">
          الرئيسية
        </Link>
      </div>
    </div>
  );
}

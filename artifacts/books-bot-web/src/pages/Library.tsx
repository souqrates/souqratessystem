import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Search, BookOpen, BookMarked, GraduationCap, ScrollText, Baby, Brain, Headphones, type LucideIcon } from "lucide-react";
import { CATEGORIES } from "@/lib/catalog";
import type { CategorySlug } from "@/lib/constants";
import { useBooks } from "@/lib/api";
import { BookCard } from "@/components/BookCard";

const ICON_MAP: Record<string, LucideIcon> = {
  religion: BookMarked,
  education: GraduationCap,
  literature: ScrollText,
  kids: Baby,
  self: Brain,
  audio: Headphones,
};

const CAT_COLORS: Record<string, string> = {
  religion:           '#22d3ee',
  education:          '#a855f7',
  literature:         '#ec4899',
  kids:               '#f59e0b',
  "self-development": '#10b981',
  audio:              '#06b6d4',
};

export default function Library() {
  const [q, setQ] = useState("");
  const [active, setActive] = useState<CategorySlug | "all">("all");
  const { books, loading } = useBooks();

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let res = books;
    if (needle) res = res.filter(b => b.title.toLowerCase().includes(needle) || b.author.toLowerCase().includes(needle));
    if (active !== "all") res = res.filter(b => b.category === active);
    return res;
  }, [q, active, books]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-8 rise">
        <div className="flex items-center gap-2 mb-6 text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>
          <Link href="/" className="hover:text-white/70 transition-colors">الرئيسية</Link>
          <span>/</span>
          <span style={{ color: '#22d3ee' }}>الكتب</span>
        </div>

        <h1 className="font-orbitron font-black text-2xl text-white/90 mb-2">مكتبة SOUQRATES SOUQ</h1>
        <div className="text-sm" style={{ color: 'rgba(148,163,184,0.55)' }}>
          اكتشف مجموعتنا من الكتب الرقمية والصوتية
        </div>

        {/* Search */}
        <div className="relative mt-6">
          <Search size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2" style={{ color: 'rgba(148,163,184,0.4)' }} />
          <input
            type="search"
            placeholder="ابحث عن كتاب أو مؤلف..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-xl px-4 py-3 pr-10 text-sm font-bold outline-none transition-all"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#f1f5f9',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(34,211,238,0.35)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
            data-testid="input-search"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold px-2 py-1 rounded-lg"
              style={{ color: '#22d3ee', background: 'rgba(34,211,238,0.08)' }}
              data-testid="button-clear-search"
            >
              مسح
            </button>
          )}
        </div>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-8">
        <FilterChip
          active={active === "all"}
          onClick={() => setActive("all")}
          label="الكل"
          color="#22d3ee"
          testId="chip-all"
        />
        {CATEGORIES.map((c) => {
          const Icon = ICON_MAP[c.iconKey];
          const color = CAT_COLORS[c.slug] || '#22d3ee';
          return (
            <FilterChip
              key={c.slug}
              active={active === c.slug}
              onClick={() => setActive(c.slug)}
              label={c.name}
              Icon={Icon}
              color={color}
              testId={`chip-${c.slug}`}
            />
          );
        })}
      </div>

      {/* Count */}
      <div className="flex items-center justify-between mb-5">
        <div className="font-orbitron text-xs font-black" style={{ color: 'rgba(34,211,238,0.7)' }}>
          {list.length} كتاب
        </div>
        {active !== "all" && (
          <div className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>
            {CATEGORIES.find(c => c.slug === active)?.name}
          </div>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-24" data-testid="loading">
          <BookOpen size={36} className="mx-auto mb-4" strokeWidth={1.5} style={{ color: 'rgba(34,211,238,0.45)' }} />
          <div className="font-bold text-sm" style={{ color: 'rgba(148,163,184,0.5)' }}>جار التحميل...</div>
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-24" data-testid="empty-results">
          <Search size={36} className="mx-auto mb-4" strokeWidth={1.5} style={{ color: 'rgba(148,163,184,0.35)' }} />
          <div className="font-bold text-sm mb-4" style={{ color: 'rgba(148,163,184,0.5)' }}>
            لا توجد نتائج لـ "{q}"
          </div>
          <button
            onClick={() => { setQ(""); setActive("all"); }}
            className="px-4 py-2 rounded-xl text-xs font-black transition-all"
            style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.2)' }}
            data-testid="button-reset-filters"
          >
            إعادة تعيين الفلاتر
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {list.map((b) => <BookCard key={b.id} book={b} />)}
        </div>
      )}

      <div className="mt-10 text-center">
        <Link href="/" className="text-xs font-black" style={{ color: 'rgba(148,163,184,0.4)' }} data-testid="link-back-home">
          ← العودة للرئيسية
        </Link>
      </div>
    </div>
  );
}

function FilterChip({
  active, onClick, label, Icon, color = '#22d3ee', testId,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  Icon?: LucideIcon;
  color?: string;
  testId?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all"
      style={{
        background: active ? `${color}18` : 'rgba(255,255,255,0.04)',
        color: active ? color : 'rgba(148,163,184,0.6)',
        border: `1px solid ${active ? `${color}35` : 'rgba(255,255,255,0.07)'}`,
      }}
      data-testid={testId}
    >
      {Icon && <Icon size={12} />}
      {label}
    </button>
  );
}

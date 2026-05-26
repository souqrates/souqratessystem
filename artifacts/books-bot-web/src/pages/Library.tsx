import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Search, BookMarked, GraduationCap, ScrollText, Baby, Brain, Headphones, type LucideIcon } from "lucide-react";
import { CATEGORIES } from "@/lib/catalog";
import type { CategorySlug } from "@/lib/constants";
import { useBooks } from "@/lib/api";
import { BookCard } from "@/components/BookCard";
import { Ornament } from "@/components/Ornaments";
import { useT } from "@/lib/i18n";

const ICON_MAP: Record<string, LucideIcon> = {
  religion: BookMarked,
  education: GraduationCap,
  literature: ScrollText,
  kids: Baby,
  self: Brain,
  audio: Headphones,
};

export default function Library() {
  const t = useT();
  const [q, setQ] = useState("");
  const [active, setActive] = useState<CategorySlug | "all">("all");
  const { books, loading } = useBooks();

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let res = books;
    if (needle) {
      res = res.filter(
        (b) =>
          b.title.toLowerCase().includes(needle) ||
          b.author.toLowerCase().includes(needle),
      );
    }
    if (active !== "all") res = res.filter((b) => b.category === active);
    return res;
  }, [q, active, books]);

  return (
    <>
      {/* Hero band */}
      <section className="relative py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-6 md:px-10 text-center">
          <div className="eyebrow mb-4" dir="ltr" lang="en" style={{ color: "var(--gold)" }}>
            {t("library.eyebrow")}
          </div>
          <h1 className="font-display mb-6" style={{ color: "var(--ink)", fontSize: "clamp(2rem, 4.5vw, 3.25rem)" }}>
            {t("library.title")}
          </h1>
          <Ornament className="mb-8" />

          {/* Search */}
          <div
            className="relative max-w-xl mx-auto flex items-center"
            style={{ borderBottom: "1px solid var(--ink)" }}
          >
            <Search size={18} strokeWidth={1.6} style={{ color: "var(--muted)" }} />
            <input
              type="search"
              placeholder={t("library.searchPh")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full bg-transparent outline-none px-3 py-3 text-base"
              style={{ color: "var(--ink)" }}
              data-testid="input-search"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="text-xs px-2 py-1"
                style={{ color: "var(--muted)" }}
                data-testid="button-clear-search"
              >
                {t("library.clear")}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Category filter strip */}
      <section className="relative" style={{ borderTop: "1px solid var(--hairline)", borderBottom: "1px solid var(--hairline)", background: "var(--ivory)" }}>
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-6 flex flex-wrap gap-2 justify-center">
          <FilterChip
            active={active === "all"}
            onClick={() => setActive("all")}
            label={t("library.all")}
            testId="chip-all"
          />
          {CATEGORIES.map((c) => {
            const Icon = ICON_MAP[c.iconKey];
            return (
              <FilterChip
                key={c.slug}
                active={active === c.slug}
                onClick={() => setActive(c.slug)}
                label={t(`cat.${c.slug}.name`)}
                Icon={Icon}
                testId={`chip-${c.slug}`}
              />
            );
          })}
        </div>
      </section>

      {/* Results */}
      <section className="py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-6 md:px-10">
          <div className="flex items-baseline justify-between mb-8">
            <div className="eyebrow" dir="ltr" lang="en" style={{ color: "var(--gold)" }}>
              {list.length} {list.length === 1 ? t("library.titleOne") : t("library.titleMany")}
            </div>
            <div className="text-xs" style={{ color: "var(--muted)" }}>
              {active === "all" ? t("library.allCats") : t(`cat.${active}.name`)}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-20" data-testid="loading">
              <div className="eyebrow mb-3" dir="ltr" lang="en" style={{ color: "var(--gold)" }}>
                {t("library.loadingEy")}
              </div>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                {t("library.loadingMsg")}
              </p>
            </div>
          ) : list.length === 0 ? (
            <div className="text-center py-20" data-testid="empty-results">
              <div className="eyebrow mb-3" dir="ltr" lang="en" style={{ color: "var(--gold)" }}>
                {t("library.nothingEy")}
              </div>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                {t("library.nothingMsg")}
              </p>
              <button
                onClick={() => { setQ(""); setActive("all"); }}
                className="mt-6 text-sm refined"
                style={{ color: "var(--emerald)" }}
                data-testid="button-reset-filters"
              >
                {t("library.resetFilters")}
              </button>
            </div>
          ) : (
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              style={{ borderTop: "1px solid var(--hairline)", borderRight: "1px solid var(--hairline)" }}
            >
              {list.map((b) => <BookCard key={b.id} book={b} />)}
            </div>
          )}

          <div className="mt-12 text-center">
            <Link
              href="/"
              className="refined text-sm"
              style={{ color: "var(--emerald)" }}
              data-testid="link-back-home"
            >
              {t("library.backHome")}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function FilterChip({
  active, onClick, label, Icon, testId,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  Icon?: LucideIcon;
  testId?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm transition-colors"
      style={{
        background: active ? "var(--ink)" : "transparent",
        color: active ? "var(--ivory)" : "var(--ink)",
        border: `1px solid ${active ? "var(--ink)" : "var(--hairline)"}`,
      }}
      data-testid={testId}
    >
      {Icon && <Icon size={14} strokeWidth={1.5} />}
      {label}
    </button>
  );
}

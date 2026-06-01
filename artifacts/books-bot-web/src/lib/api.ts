import { useEffect, useState } from "react";
import { BOOKS as STATIC_BOOKS, CATEGORIES, type Book } from "./catalog";
import type { CategorySlug } from "./constants";

const API = "/api";

type ApiCategory = {
  id: number;
  slug: string;
  nameAr: string;
  icon: string;
  sortOrder: number;
};
type ApiProduct = {
  id: number;
  title: string;
  description: string;
  coverUrl: string | null;
  categoryId: number | null;
  priceUsdt: string;
  salesCount: number;
  rating: string;
  ratingCount: number;
  createdAt: string;
};

let CAT_ID_TO_SLUG: Record<number, CategorySlug> = {};

async function loadCategoryMap(): Promise<void> {
  if (Object.keys(CAT_ID_TO_SLUG).length) return;
  try {
    const r = await fetch(`${API}/books/categories`);
    if (!r.ok) return;
    const { data } = (await r.json()) as { data: ApiCategory[] };
    const known = new Set(CATEGORIES.map((c) => c.slug));
    CAT_ID_TO_SLUG = Object.fromEntries(
      data
        .filter((c) => known.has(c.slug as CategorySlug))
        .map((c) => [c.id, c.slug as CategorySlug]),
    );
  } catch {
    /* offline */
  }
}

// 1 USDT ≈ 1000 SKZ (display only — real conversion happens server-side)
const SKZ_PER_USDT = 1000;

function mapProduct(p: ApiProduct, fallback?: Book): Book {
  const slug =
    (p.categoryId != null && CAT_ID_TO_SLUG[p.categoryId]) ||
    fallback?.category ||
    "literature";
  return {
    id: String(p.id),
    title: p.title,
    author: fallback?.author ?? "—",
    category: slug,
    priceSkz: Math.max(1, Math.round(parseFloat(p.priceUsdt) * SKZ_PER_USDT)),
    pages: fallback?.pages,
    duration: fallback?.duration,
    year: new Date(p.createdAt).getFullYear() || 2026,
    excerpt: p.description || fallback?.excerpt || "—",
    rating: parseFloat(p.rating) || fallback?.rating || 0,
    ratingCount: p.ratingCount || fallback?.ratingCount || 0,
  };
}

// merge in author + pages/duration from the static catalog by title
const STATIC_BY_TITLE = new Map(STATIC_BOOKS.map((b) => [b.title, b]));

export type BooksResult = {
  books: Book[];
  loading: boolean;
  source: "api" | "static";
  /** true when the live API call failed (network error or non-OK response).
   *  false when data came from the API or when the API returned an empty list
   *  (which falls back to static silently — no error to surface). */
  apiError: boolean;
};

export function useBooks(): BooksResult {
  const [state, setState] = useState<BooksResult>({
    books: STATIC_BOOKS,
    loading: true,
    source: "static",
    apiError: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadCategoryMap();
        const r = await fetch(`${API}/books/products?limit=100`);
        if (!r.ok) throw new Error("api-error");
        const { data } = (await r.json()) as { data: ApiProduct[] };
        if (cancelled) return;
        if (!data || data.length === 0) {
          setState({ books: STATIC_BOOKS, loading: false, source: "static", apiError: false });
          return;
        }
        const mapped = data.map((p) => mapProduct(p, STATIC_BY_TITLE.get(p.title)));
        setState({ books: mapped, loading: false, source: "api", apiError: false });
      } catch {
        if (!cancelled) {
          setState({ books: STATIC_BOOKS, loading: false, source: "static", apiError: true });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export function useBook(id: string): { book: Book | undefined; loading: boolean } {
  const { books, loading } = useBooks();
  return { book: books.find((b) => b.id === id), loading };
}

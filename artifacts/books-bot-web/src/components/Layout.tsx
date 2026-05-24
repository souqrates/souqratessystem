import { ArrowLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import type { ReactNode } from "react";
import { Monogram } from "./Ornaments";
import { TELEGRAM_BOT_URL } from "@/lib/constants";

export function Header() {
  const [location] = useLocation();
  const isHome = location === "/";

  return (
    <header className="relative z-10 w-full" style={{ borderBottom: "1px solid var(--hairline)" }}>
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-6 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-4 cursor-pointer transition-opacity hover:opacity-80"
          data-testid="link-home"
        >
          <Monogram />
          <div>
            <div className="font-display text-lg leading-tight" dir="ltr" lang="en" style={{ color: "var(--ink)" }}>
              SOUQRATES <span style={{ color: "var(--gold)" }}>SOUQ</span>
            </div>
            <div className="eyebrow mt-1" dir="ltr" lang="en" style={{ color: "var(--muted)" }}>
              digital books · est. 2026
            </div>
          </div>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-5 text-sm">
          {!isHome && (
            <Link
              href="/library"
              className="hidden sm:inline-flex items-center gap-1 px-2 py-2 font-medium refined"
              style={{ color: "var(--emerald)" }}
              data-testid="link-library"
            >
              المكتبة
            </Link>
          )}
          <Link
            href="/publish"
            className="hidden sm:inline-flex items-center gap-1 px-2 py-2 font-medium refined"
            style={{ color: "var(--emerald)" }}
            data-testid="link-publish"
          >
            انشر معنا
          </Link>
          <a
            href={TELEGRAM_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors"
            style={{ background: "var(--ink)", color: "var(--ivory)", border: "1px solid var(--ink)" }}
            data-testid="link-telegram-header"
          >
            افتح في تيليغرام
            <ArrowLeft size={14} strokeWidth={1.8} />
          </a>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer
      className="relative py-14 px-6 md:px-10"
      style={{
        background: "var(--ink)",
        color: "rgba(251, 246, 234, 0.7)",
        borderTop: "1px solid var(--gold)",
      }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-8">
          <div className="flex items-center gap-4">
            <div
              className="flex items-center justify-center"
              style={{ width: 44, height: 44, border: "1px solid var(--gold)" }}
            >
              <span className="font-display text-lg" style={{ color: "var(--gold)" }}>❖</span>
            </div>
            <div>
              <div className="font-display text-base" dir="ltr" lang="en" style={{ color: "var(--ivory)" }}>
                SOUQRATES <span style={{ color: "var(--gold)" }}>SOUQ</span>
              </div>
              <div className="eyebrow mt-1" dir="ltr" lang="en" style={{ color: "var(--muted-soft)" }}>
                a chapter of SOUQRATES SYSTEM
              </div>
            </div>
          </div>

          <div className="text-center md:text-left text-xs leading-relaxed" dir="ltr" lang="en">
            <div className="font-serif-en text-sm mb-2" style={{ color: "var(--gold)" }}>
              The SOUQRATES Ecosystem
            </div>
            <div>SYSTEM · SKILLZ · SOUQ · SCENE · STREAM · SIGNAL · STAGE</div>
          </div>
        </div>

        <div
          className="mt-10 pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs"
          style={{ borderTop: "1px solid rgba(184, 137, 58, 0.2)" }}
        >
          <div>
            <span dir="ltr" lang="en">© 2026 SOUQRATES SOUQ</span> — جميع الحقوق محفوظة.
          </div>
          <div className="eyebrow" dir="ltr" lang="en" style={{ color: "var(--muted-soft)" }}>
            crafted with precision
          </div>
        </div>
      </div>
    </footer>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--parchment)" }}>
      <Header />
      <main className="relative z-10 flex-1">{children}</main>
      <Footer />
    </div>
  );
}

import { ArrowLeft, BookOpen, ShoppingBag, Zap, Home } from "lucide-react";
import { Link, useLocation } from "wouter";
import type { ReactNode } from "react";
import { TELEGRAM_BOT_URL } from "@/lib/constants";

export function Header() {
  const [location] = useLocation();

  const navItems = [
    { href: "/",        label: "الرئيسية", icon: <Home size={12} /> },
    { href: "/library", label: "الكتب",    icon: <BookOpen size={12} /> },
    { href: "/digital", label: "Vouchers", icon: <Zap size={12} /> },
  ];

  return (
    <header
      className="sticky top-0 z-40 w-full"
      style={{
        background: 'rgba(4,3,10,0.92)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div className="accent-line-top" />
      <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">

        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 cursor-pointer transition-opacity hover:opacity-80" data-testid="link-home">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.25)' }}
          >
            <ShoppingBag size={15} color="#22d3ee" />
          </div>
          <div>
            <div className="font-orbitron text-[11px] font-black tracking-widest text-white/90" dir="ltr">
              SOUQRATES <span style={{ color: '#22d3ee' }}>SOUQ</span>
            </div>
            <div className="text-[8px] font-bold uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.5)' }}>
              الكتب والخدمات الرقمية
            </div>
          </div>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{
                color: location === item.href ? '#22d3ee' : 'rgba(148,163,184,0.7)',
                background: location === item.href ? 'rgba(34,211,238,0.08)' : 'transparent',
              }}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}

          <a
            href={TELEGRAM_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black tracking-wide transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg,#0e7490,#22d3ee)', color: '#04030a' }}
            data-testid="link-telegram-header"
          >
            افتح في تيليغرام
            <ArrowLeft size={11} />
          </a>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer
      className="relative py-10 px-6"
      style={{ background: '#07060f', borderTop: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-5">
        <div>
          <div className="font-orbitron text-sm font-black text-white/85" dir="ltr">
            SOUQRATES <span style={{ color: '#22d3ee' }}>SOUQ</span>
          </div>
          <div className="text-xs mt-1.5" style={{ color: 'rgba(148,163,184,0.45)' }}>
            الكتب والخدمات الرقمية — جزء من منظومة SOUQRATES SYSTEM
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs" style={{ color: 'rgba(148,163,184,0.35)' }} dir="ltr">
          <span>© 2026 SOUQRATES SYSTEM</span>
          <span>·</span>
          <span>Powered by SKZ</span>
        </div>
      </div>
    </footer>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--parchment)' }}>
      <Header />
      <main className="relative z-10 flex-1">{children}</main>
      <Footer />
    </div>
  );
}

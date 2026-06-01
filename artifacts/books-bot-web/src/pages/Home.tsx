import { ArrowLeft, BookOpen, Zap, ShieldCheck, Globe2, Wallet, Headphones, GraduationCap, ScrollText, Baby, Brain, BookMarked, Gamepad2, Smartphone, Users, CreditCard, Music2, PenLine } from "lucide-react";
import { Link } from "wouter";
import { CATEGORIES } from "@/lib/catalog";
import { hotVouchers } from "@/lib/vouchers";
import { TELEGRAM_BOT_URL, TELEGRAM_PUBLISH_URL } from "@/lib/constants";

const VOUCHER_ICONS: Record<string, React.ReactNode> = {
  gaming:        <Gamepad2 size={22} />,
  apple:         <Smartphone size={22} />,
  google:        <Globe2 size={22} />,
  entertainment: <Music2 size={22} />,
  social:        <Users size={22} />,
  other:         <CreditCard size={22} />,
};

const CAT_ICONS: Record<string, React.ReactNode> = {
  religion:        <BookMarked size={22} />,
  education:       <GraduationCap size={22} />,
  literature:      <ScrollText size={22} />,
  kids:            <Baby size={22} />,
  "self-development": <Brain size={22} />,
  audio:           <Headphones size={22} />,
};

const CAT_COLORS: Record<string, string> = {
  religion:           '#22d3ee',
  education:          '#a855f7',
  literature:         '#ec4899',
  kids:               '#f59e0b',
  "self-development": '#10b981',
  audio:              '#06b6d4',
};

/* ── Hero ── */
function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Neon glow bg */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(ellipse, #22d3ee, transparent 70%)', filter: 'blur(60px)' }} />
        <div className="absolute bottom-0 right-0 w-[400px] h-[200px] rounded-full opacity-15"
          style={{ background: 'radial-gradient(ellipse, #a855f7, transparent 70%)', filter: 'blur(50px)' }} />
      </div>

      <div className="relative max-w-4xl mx-auto px-6 py-20 md:py-28 text-center rise">
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full border"
          style={{ borderColor: 'rgba(34,211,238,0.25)', background: 'rgba(34,211,238,0.06)' }}>
          <span className="pulse-dot w-1.5 h-1.5 rounded-full" style={{ background: '#22d3ee' }} />
          <span className="font-orbitron text-[9px] font-black tracking-widest" style={{ color: '#22d3ee' }}>
            SOUQRATES SOUQ — الكتب والخدمات الرقمية
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-orbitron font-black mb-6 leading-tight"
          style={{ fontSize: 'clamp(1.8rem, 5vw, 3.5rem)', color: '#f1f5f9' }}>
          اكتشف عالماً من
          <br />
          <span className="shimmer-cyan">المعرفة والترفيه الرقمي</span>
        </h1>

        <p className="max-w-xl mx-auto text-base mb-10 leading-relaxed" style={{ color: 'rgba(148,163,184,0.8)' }}>
          كتب رقمية وصوتية + Vouchers لأشهر المنصات العالمية — كل شيء بـ SKZ مباشرة عبر تيليغرام
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/library"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-xl font-black text-sm transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg,#0e7490,#22d3ee)', color: '#04030a' }}
            data-testid="button-enter-library"
          >
            <BookOpen size={15} />
            استكشف الكتب
          </Link>
          <Link
            href="/digital"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-xl font-black text-sm border transition-all hover:-translate-y-0.5 hover:border-purple-500/50"
            style={{ border: '1px solid rgba(168,85,247,0.3)', color: '#a855f7', background: 'rgba(168,85,247,0.06)' }}
            data-testid="link-digital-store"
          >
            <Zap size={15} />
            Digital Store
          </Link>
        </div>

        {/* Stats */}
        <div className="flex justify-center gap-8 mt-12">
          {[
            { v: '12+', l: 'كتاب' },
            { v: '15+', l: 'Voucher' },
            { v: '6',   l: 'فئات' },
          ].map(s => (
            <div key={s.l} className="text-center">
              <div className="font-orbitron text-2xl font-black" style={{ color: '#22d3ee' }}>{s.v}</div>
              <div className="text-xs mt-1" style={{ color: 'rgba(148,163,184,0.5)' }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Digital Services Preview ── */
function DigitalPreview() {
  const hot = hotVouchers().slice(0, 6);
  return (
    <section className="py-16 md:py-20">
      <div className="max-w-5xl mx-auto px-6">

        {/* Section header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap size={16} color="#a855f7" />
              <span className="eyebrow" style={{ color: '#a855f7', fontSize: 9 }}>DIGITAL STORE</span>
            </div>
            <h2 className="font-orbitron font-black text-xl text-white/90">Vouchers الأكثر طلباً</h2>
          </div>
          <Link
            href="/digital"
            className="flex items-center gap-1.5 text-xs font-black transition-colors hover:opacity-80"
            style={{ color: '#22d3ee' }}
          >
            عرض الكل <ArrowLeft size={13} />
          </Link>
        </div>

        {/* Voucher cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {hot.map(v => (
            <a
              key={v.id}
              href={TELEGRAM_BOT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="voucher-card rounded-xl overflow-hidden relative"
              style={{ border: `1px solid ${v.color}22` }}
            >
              {/* Card bg */}
              <div className="p-4 md:p-5" style={{ background: v.bgGradient }}>
                <div className="mb-2" style={{ color: v.color }}>{VOUCHER_ICONS[v.category] ?? <CreditCard size={22} />}</div>
                <div className="font-black text-sm text-white/90 mb-0.5">{v.nameAr}</div>
                <div className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{v.name}</div>
                <div className="mt-3 flex items-center gap-1.5">
                  <div className="text-[10px] font-black px-2 py-0.5 rounded-full"
                    style={{ background: `${v.color}22`, color: v.color, border: `1px solid ${v.color}33` }}>
                    عبر تيليغرام
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>

        {/* CTA bar */}
        <div className="mt-6 rounded-xl p-5 flex items-center justify-between"
          style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.15)' }}>
          <div>
            <div className="font-black text-sm text-white/85">15+ خدمة رقمية متاحة</div>
            <div className="text-xs mt-0.5" style={{ color: 'rgba(148,163,184,0.5)' }}>PlayStation · Xbox · Steam · Apple · Google · Spotify وأكثر</div>
          </div>
          <Link
            href="/digital"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-black text-xs transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg,#6d28d9,#a855f7)', color: '#fff' }}
          >
            اكتشف الكل <ArrowLeft size={12} />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── Book Categories ── */
function Categories() {
  return (
    <section id="categories" className="py-16 md:py-20" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="max-w-5xl mx-auto px-6">

        <div className="mb-10">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen size={16} color="#22d3ee" />
            <span className="eyebrow" style={{ color: '#22d3ee', fontSize: 9 }}>BOOKS CATALOG</span>
          </div>
          <h2 className="font-orbitron font-black text-xl text-white/90">استكشف بالفئة</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {CATEGORIES.map(({ slug, name, desc }) => {
            const color = CAT_COLORS[slug] || '#22d3ee';
            return (
              <Link
                key={slug}
                href={`/category/${slug}`}
                className="group neon-card relative p-5 rounded-xl block cursor-pointer"
                data-testid={`link-category-${slug}`}
              >
                {/* Icon */}
                <div className="mb-3 w-10 h-10 rounded-xl flex items-center justify-center transition-all group-hover:scale-110"
                  style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}>
                  {CAT_ICONS[slug]}
                </div>

                <div className="font-black text-sm text-white/85 mb-1">{name}</div>
                <div className="text-[11px] leading-relaxed" style={{ color: 'rgba(148,163,184,0.55)' }}>{desc}</div>

                {/* Hover bottom accent */}
                <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── How it Works ── */
function HowItWorks() {
  const steps = [
    { n: '01', t: 'افتح البوت',        d: 'ابدأ من تيليغرام عبر زر الفتح أعلاه' },
    { n: '02', t: 'اختر المحتوى',      d: 'كتاب رقمي أو خدمة Voucher من الكتالوج' },
    { n: '03', t: 'ادفع بـ SKZ',       d: 'محفظة موحدة — Stars أو USDT أو TON' },
    { n: '04', t: 'استلم فوراً',       d: 'ملف PDF أو كود الـ Voucher في الخاص' },
  ];

  return (
    <section className="py-16 md:py-20" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="max-w-5xl mx-auto px-6">

        <div className="mb-10">
          <div className="eyebrow mb-1" style={{ color: 'rgba(148,163,184,0.5)', fontSize: 9 }}>HOW IT WORKS</div>
          <h2 className="font-orbitron font-black text-xl text-white/90">كيف يعمل؟</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((s, i) => (
            <div
              key={s.n}
              className="neon-card rounded-xl p-5"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="font-orbitron text-3xl font-black mb-3" style={{ color: 'rgba(34,211,238,0.25)' }}>
                {s.n}
              </div>
              <div className="font-black text-sm text-white/85 mb-2">{s.t}</div>
              <div className="text-xs leading-relaxed" style={{ color: 'rgba(148,163,184,0.55)' }}>{s.d}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Features ── */
function Features() {
  const FEATS = [
    { icon: <Wallet size={20} />,      t: 'محفظة موحدة',       d: 'كتبك وقسائمك كلها في محفظة SKZ واحدة مع بقية البوتات', color: '#22d3ee' },
    { icon: <Zap size={20} />,         t: 'تسليم فوري',        d: 'بعد الدفع مباشرة تصلك الملفات أو كود الـ Voucher', color: '#a855f7' },
    { icon: <ShieldCheck size={20} />, t: 'مضمون 100%',        d: 'جميع الخدمات موثوقة وكودات رسمية من المصدر', color: '#10b981' },
    { icon: <Globe2 size={20} />,      t: 'خدمات عالمية',      d: 'PlayStation · Apple · Google · Spotify وأكثر من 15 منصة', color: '#ec4899' },
  ];

  return (
    <section className="py-16 md:py-20" style={{ background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="max-w-5xl mx-auto px-6">
        <div className="mb-10">
          <div className="eyebrow mb-1" style={{ color: 'rgba(148,163,184,0.5)', fontSize: 9 }}>WHY SOUQRATES SOUQ</div>
          <h2 className="font-orbitron font-black text-xl text-white/90">لماذا SOUQRATES SOUQ؟</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATS.map(f => (
            <div key={f.t} className="neon-card rounded-xl p-6 flex gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${f.color}12`, color: f.color, border: `1px solid ${f.color}22` }}>
                {f.icon}
              </div>
              <div>
                <div className="font-black text-sm text-white/85 mb-1.5">{f.t}</div>
                <div className="text-xs leading-relaxed" style={{ color: 'rgba(148,163,184,0.55)' }}>{f.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Publish CTA ── */
function PublishCTA() {
  return (
    <section className="py-16 md:py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <div
          className="relative rounded-2xl p-8 md:p-12 text-center overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0f0e1c, #1a1030)' }}
        >
          {/* Neon border glow */}
          <div className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{ border: '1px solid rgba(168,85,247,0.3)', boxShadow: '0 0 60px rgba(168,85,247,0.08) inset' }} />

          <div className="relative">
            <div className="mb-4" style={{ color: '#a855f7', display: 'flex', justifyContent: 'center' }}><PenLine size={40} strokeWidth={1.4} /></div>
            <div className="eyebrow mb-3" style={{ color: '#a855f7', fontSize: 9 }}>FOR AUTHORS</div>
            <h2 className="font-orbitron font-black text-xl md:text-2xl text-white/90 mb-4">
              انشر كتابك عبر SOUQRATES SOUQ
            </h2>
            <p className="max-w-lg mx-auto text-sm leading-relaxed mb-8" style={{ color: 'rgba(148,163,184,0.65)' }}>
              اوصل كتابك لآلاف المشتركين في منصة SOUQRATES. سهل، سريع، وعمولة تنافسية بـ SKZ.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <a
                href={TELEGRAM_PUBLISH_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm transition-all hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg,#6d28d9,#a855f7)', color: '#fff' }}
                data-testid="button-start-publishing"
              >
                ابدأ النشر الآن
                <ArrowLeft size={13} />
              </a>
              <Link
                href="/publish"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm border transition-all hover:border-purple-500/40"
                style={{ border: '1px solid rgba(168,85,247,0.2)', color: 'rgba(168,85,247,0.8)' }}
                data-testid="link-publish-details"
              >
                تفاصيل أكثر
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Page ── */
export default function Home() {
  return (
    <>
      <Hero />
      <DigitalPreview />
      <Categories />
      <HowItWorks />
      <Features />
      <PublishCTA />
    </>
  );
}

export { TELEGRAM_BOT_URL };

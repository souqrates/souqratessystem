import "./index.css";
import {
  BookMarked,
  GraduationCap,
  ScrollText,
  Baby,
  Brain,
  Headphones,
  Wallet,
  Zap,
  ShieldCheck,
  Globe2,
  Feather,
  ArrowLeft,
  type LucideIcon,
} from "lucide-react";

type Icon = LucideIcon;

const CATEGORIES: { Icon: Icon; name: string; desc: string }[] = [
  { Icon: BookMarked,    name: "كتب دينية",      desc: "تفسير، حديث، وفقه" },
  { Icon: GraduationCap, name: "كتب تعليمية",    desc: "مناهج وشروحات أكاديمية" },
  { Icon: ScrollText,    name: "روايات وأدب",    desc: "قصص، شعر، ونثر" },
  { Icon: Baby,          name: "كتب الأطفال",    desc: "قصص مصوّرة ومنهجية" },
  { Icon: Brain,         name: "تطوير الذات",    desc: "نجاح، إلهام، وأعمال" },
  { Icon: Headphones,    name: "كتب صوتية",      desc: "استمع في أي وقت ومكان" },
];

const L = (s: string) => (
  <span dir="ltr" lang="en">{s}</span>
);

const FEATURES: { Icon: Icon; title: string; desc: React.ReactNode }[] = [
  { Icon: Wallet,      title: "محفظة موحّدة",      desc: <>ادفع بـ {L("SKZ")} من محفظتك في {L("SOUQRATES SYSTEM")} — بلا بطاقات، بلا تحويلات.</> },
  { Icon: Zap,         title: "تسليم لحظي",         desc: <>روابط آمنة مُوقَّعة بـ {L("HMAC")}، صالحة لمدّة سبعة أيام بعد الشراء.</> },
  { Icon: ShieldCheck, title: "حقوق النشر محفوظة", desc: <>كل عملية موثَّقة على السلسلة المالية، والمؤلِّف يستلم نصيبه تلقائيًا.</> },
  { Icon: Globe2,      title: "للمكتبة العربية",    desc: <>ست فئات منتقاة تغطّي اهتمام القارئ العربي المعاصر.</> },
];

const STEPS: { n: string; t: React.ReactNode; d: React.ReactNode }[] = [
  { n: "I",   t: <>افتح البوت</>,                  d: <>ابدأ {L("/start")} في {L("SOUQRATES SOUQ")} عبر تيليغرام.</> },
  { n: "II",  t: <>اختر إصدارًا</>,                d: <>تصفّح حسب الفئة، أو ابحث بعنوان أو مؤلِّف.</> },
  { n: "III", t: <>ادفع بـ {L("SKZ")}</>,           d: <>خصم لحظي من محفظتك الموحّدة، بلا وسطاء.</> },
  { n: "IV",  t: <>حمِّل واقرأ</>,                  d: <>رابط مُؤمَّن صالح سبعة أيام — لك وحدك.</> },
];

/* ─────────────────────────── Ornaments ─────────────────────────── */

function Ornament({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`} aria-hidden>
      <span className="h-px w-16 md:w-24" style={{ background: "var(--gold-line)" }} />
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z"
          stroke="var(--gold)"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
      <span className="h-px w-16 md:w-24" style={{ background: "var(--gold-line)" }} />
    </div>
  );
}

function CornerFlourish({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden>
      <path
        d="M2 2 H22 M2 2 V22 M2 12 Q12 12 12 2"
        stroke="var(--gold)"
        strokeWidth="1"
        fill="none"
        opacity="0.7"
      />
      <circle cx="2" cy="2" r="1.5" fill="var(--gold)" />
    </svg>
  );
}

function Monogram({ size = 44 }: { size?: number }) {
  return (
    <div
      className="relative flex items-center justify-center"
      style={{
        width: size,
        height: size,
        border: "1px solid var(--gold)",
        background: "var(--ivory)",
      }}
      aria-hidden
    >
      <div
        className="absolute"
        style={{
          inset: 4,
          border: "1px solid var(--gold-line)",
        }}
      />
      <span className="font-display text-lg leading-none" style={{ color: "var(--emerald)" }}>
        ❖
      </span>
    </div>
  );
}

/* ─────────────────────────── Sections ─────────────────────────── */

function Header() {
  return (
    <header className="relative z-10 w-full" style={{ borderBottom: "1px solid var(--hairline)" }}>
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Monogram />
          <div>
            <div className="font-display text-lg leading-tight" dir="ltr" lang="en" style={{ color: "var(--ink)" }}>
              SOUQRATES <span style={{ color: "var(--gold)" }}>SOUQ</span>
            </div>
            <div className="eyebrow mt-1" dir="ltr" lang="en" style={{ color: "var(--muted)" }}>
              digital books · est. 2026
            </div>
          </div>
        </div>
        <a
          href="https://t.me/"
          className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors"
          style={{
            background: "var(--ink)",
            color: "var(--ivory)",
            border: "1px solid var(--ink)",
          }}
        >
          افتح في تيليغرام
          <ArrowLeft size={14} strokeWidth={1.8} />
        </a>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative">
      <div className="max-w-4xl mx-auto px-6 md:px-10 py-20 md:py-28 text-center rise">
        <div className="eyebrow mb-8" style={{ color: "var(--gold)" }}>
          <span dir="ltr" lang="en">❖ Volume I</span> · المجلَّد الأوّل
        </div>

        <h1
          className="font-display leading-[1.05] mb-8"
          style={{
            color: "var(--ink)",
            fontSize: "clamp(2.5rem, 6vw, 4.75rem)",
          }}
        >
          مكتبةٌ كاملة
          <br />
          <span className="font-serif-en" dir="ltr" lang="en" style={{ color: "var(--emerald)" }}>
            in your pocket.
          </span>
        </h1>

        <Ornament className="mb-8" />

        <p
          className="max-w-2xl mx-auto text-base md:text-lg leading-loose mb-12"
          style={{ color: "var(--muted)" }}
        >
          اقتنِ، اقرأ، وانشر آلاف الإصدارات الرقمية مباشرةً عبر تيليغرام —
          مدفوعةً بمحفظة <span className="font-display" style={{ color: "var(--emerald)" }}>SKZ</span>{" "}
          الموحَّدة، ومحميَّةً بتوقيع تحميل فريد لكلِّ نسخة.
        </p>

        <div className="flex flex-wrap justify-center items-center gap-5">
          <a
            href="https://t.me/"
            className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-medium tracking-wide transition-transform hover:-translate-y-0.5"
            style={{
              background: "var(--ink)",
              color: "var(--ivory)",
            }}
          >
            ادخل المكتبة
            <ArrowLeft size={14} strokeWidth={1.8} />
          </a>
          <a
            href="#categories"
            className="refined inline-flex items-center gap-1.5 text-sm font-medium px-2 py-2"
            style={{ color: "var(--emerald)" }}
          >
            تصفَّح الفئات
          </a>
        </div>
      </div>
    </section>
  );
}

function Categories() {
  return (
    <section id="categories" className="relative py-20 md:py-28">
      <div className="max-w-6xl mx-auto px-6 md:px-10">
        <div className="text-center mb-16">
          <div className="eyebrow mb-4" dir="ltr" lang="en" style={{ color: "var(--gold)" }}>
            The Collection
          </div>
          <h2
            className="font-display mb-4"
            style={{ color: "var(--ink)", fontSize: "clamp(1.875rem, 4vw, 2.75rem)" }}
          >
            ست فئاتٍ. مكتبةٌ واحدة.
          </h2>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            اختر اهتمامك، وابدأ القراءة في الحال.
          </p>
        </div>

        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          style={{ borderTop: "1px solid var(--hairline)", borderRight: "1px solid var(--hairline)" }}
        >
          {CATEGORIES.map(({ Icon, name, desc }, i) => (
            <article
              key={name}
              className="group relative p-8 md:p-10 transition-colors hover:bg-[var(--ivory)]"
              style={{
                borderBottom: "1px solid var(--hairline)",
                borderLeft: "1px solid var(--hairline)",
                background: "transparent",
              }}
            >
              <div className="flex items-start justify-between mb-6">
                <Icon size={28} strokeWidth={1.25} style={{ color: "var(--emerald)" }} />
                <span
                  className="font-serif-en text-sm"
                  dir="ltr"
                  lang="en"
                  style={{ color: "var(--gold)" }}
                >
                  № {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <div className="font-display text-xl mb-2" style={{ color: "var(--ink)" }}>
                {name}
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                {desc}
              </p>
              <div
                className="mt-6 h-px w-8 transition-all group-hover:w-16"
                style={{ background: "var(--gold)" }}
              />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section
      className="relative py-20 md:py-28"
      style={{
        background: "var(--ivory)",
        borderTop: "1px solid var(--hairline)",
        borderBottom: "1px solid var(--hairline)",
      }}
    >
      <div className="max-w-6xl mx-auto px-6 md:px-10">
        <div className="text-center mb-16">
          <div className="eyebrow mb-4" dir="ltr" lang="en" style={{ color: "var(--gold)" }}>
            The Promise
          </div>
          <h2
            className="font-display"
            style={{ color: "var(--ink)", fontSize: "clamp(1.875rem, 4vw, 2.75rem)" }}
          >
            لماذا{" "}
            <span dir="ltr" lang="en" style={{ color: "var(--emerald)" }}>SOUQRATES SOUQ</span>؟
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px" style={{ background: "var(--hairline)" }}>
          {FEATURES.map(({ Icon, title, desc }) => (
            <div
              key={title}
              className="relative p-8 md:p-10"
              style={{ background: "var(--ivory)" }}
            >
              <CornerFlourish className="absolute top-3 right-3" />
              <Icon size={26} strokeWidth={1.25} style={{ color: "var(--gold)" }} />
              <h3
                className="font-display text-xl mt-5 mb-3"
                style={{ color: "var(--ink)" }}
              >
                {title}
              </h3>
              <p className="text-sm leading-loose" style={{ color: "var(--muted)" }}>
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="relative py-20 md:py-28">
      <div className="max-w-6xl mx-auto px-6 md:px-10">
        <div className="text-center mb-16">
          <div className="eyebrow mb-4" dir="ltr" lang="en" style={{ color: "var(--gold)" }}>
            The Ritual
          </div>
          <h2
            className="font-display"
            style={{ color: "var(--ink)", fontSize: "clamp(1.875rem, 4vw, 2.75rem)" }}
          >
            أربعُ خطواتٍ بسيطة.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-10">
          {STEPS.map((s) => (
            <div key={s.n} className="relative">
              <div className="flex items-baseline gap-3 mb-4">
                <span
                  className="font-serif-en text-4xl leading-none"
                  dir="ltr"
                  lang="en"
                  style={{ color: "var(--gold)" }}
                >
                  {s.n}
                </span>
                <span className="h-px flex-1" style={{ background: "var(--gold-line)" }} />
              </div>
              <h3 className="font-display text-lg mb-2" style={{ color: "var(--ink)" }}>
                {s.t}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                {s.d}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PublishCTA() {
  return (
    <section className="relative py-20 md:py-28 px-6 md:px-10">
      <div className="max-w-5xl mx-auto">
        <div
          className="relative p-10 md:p-16 text-center overflow-hidden"
          style={{
            background: "var(--ink)",
            color: "var(--ivory)",
          }}
        >
          {/* gold frame */}
          <div
            className="absolute pointer-events-none"
            style={{ inset: 12, border: "1px solid var(--gold)" }}
          />
          <div
            className="absolute pointer-events-none"
            style={{ inset: 18, border: "1px solid var(--gold-line)" }}
          />

          <div className="relative">
            <Feather
              size={36}
              strokeWidth={1.2}
              style={{ color: "var(--gold)", margin: "0 auto" }}
            />
            <div className="eyebrow mt-6 mb-4" dir="ltr" lang="en" style={{ color: "var(--gold)" }}>
              For Authors &amp; Publishers
            </div>
            <h2
              className="font-display mb-6"
              style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)" }}
            >
              أنشر إبداعك. واستلم أرباحك.
            </h2>
            <p
              className="max-w-xl mx-auto text-base leading-loose mb-10"
              style={{ color: "rgba(251, 246, 234, 0.7)" }}
            >
              ارفع كتبك مباشرةً من البوت، حدِّد سعرك بـ SKZ،
              واستلم نصيبك تلقائيًا في محفظتك بعد خصم العمولة الموثَّقة.
            </p>
            <a
              href="https://t.me/"
              className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-medium tracking-wide transition-transform hover:-translate-y-0.5"
              style={{
                background: "var(--gold)",
                color: "var(--ink)",
              }}
            >
              ابدأ النشر اليوم
              <ArrowLeft size={14} strokeWidth={1.8} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
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
              style={{
                width: 44,
                height: 44,
                border: "1px solid var(--gold)",
              }}
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
            <div>
              SYSTEM · SKILLZ · SOUQ · SCENE · STREAM · SIGNAL · STAGE
            </div>
          </div>
        </div>

        <div
          className="mt-10 pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs"
          style={{ borderTop: "1px solid rgba(184, 137, 58, 0.2)" }}
        >
          <div><span dir="ltr" lang="en">© 2026 SOUQRATES SOUQ</span> — جميع الحقوق محفوظة.</div>
          <div className="eyebrow" dir="ltr" lang="en" style={{ color: "var(--muted-soft)" }}>
            crafted with precision
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <div className="min-h-screen relative" style={{ background: "var(--parchment)" }}>
      <Header />
      <main className="relative z-10">
        <Hero />
        <Categories />
        <Features />
        <HowItWorks />
        <PublishCTA />
      </main>
      <Footer />
    </div>
  );
}

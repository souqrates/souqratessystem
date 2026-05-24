import { ArrowLeft, Wallet, Zap, ShieldCheck, Globe2, Feather, BookMarked, GraduationCap, ScrollText, Baby, Brain, Headphones, type LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { L, Ornament, CornerFlourish } from "@/components/Ornaments";
import { CATEGORIES } from "@/lib/catalog";
import { TELEGRAM_BOT_URL, TELEGRAM_PUBLISH_URL } from "@/lib/constants";

type IconKey = (typeof CATEGORIES)[number]["iconKey"];
const ICON_MAP: Record<IconKey, LucideIcon> = {
  religion: BookMarked,
  education: GraduationCap,
  literature: ScrollText,
  kids: Baby,
  self: Brain,
  audio: Headphones,
};

const FEATURES: { Icon: LucideIcon; title: string; desc: React.ReactNode }[] = [
  { Icon: Wallet,      title: "محفظة موحّدة",      desc: <>ادفع بـ {L("SKZ")} من محفظتك في {L("SOUQRATES SYSTEM")} — بلا بطاقات، بلا تحويلات.</> },
  { Icon: Zap,         title: "تسليم لحظي",         desc: <>روابط آمنة مُوقَّعة بـ {L("HMAC")}، صالحة لمدّة سبعة أيام بعد الشراء.</> },
  { Icon: ShieldCheck, title: "حقوق النشر محفوظة", desc: <>كل عملية موثَّقة على السلسلة المالية، والمؤلِّف يستلم نصيبه تلقائيًا.</> },
  { Icon: Globe2,      title: "للمكتبة العربية",    desc: <>ست فئات منتقاة تغطّي اهتمام القارئ العربي المعاصر.</> },
];

const STEPS: { n: string; t: React.ReactNode; d: React.ReactNode }[] = [
  { n: "I",   t: <>افتح البوت</>,        d: <>ابدأ {L("/start")} في {L("SOUQRATES SOUQ")} عبر تيليغرام.</> },
  { n: "II",  t: <>اختر إصدارًا</>,       d: <>تصفّح حسب الفئة، أو ابحث بعنوان أو مؤلِّف.</> },
  { n: "III", t: <>ادفع بـ {L("SKZ")}</>, d: <>خصم لحظي من محفظتك الموحّدة، بلا وسطاء.</> },
  { n: "IV",  t: <>حمِّل واقرأ</>,         d: <>رابط مُؤمَّن صالح سبعة أيام — لك وحدك.</> },
];

function Hero() {
  return (
    <section className="relative">
      <div className="max-w-4xl mx-auto px-6 md:px-10 py-20 md:py-28 text-center rise">
        <div className="eyebrow mb-8" style={{ color: "var(--gold)" }}>
          <span dir="ltr" lang="en">❖ Volume I</span> · المجلَّد الأوّل
        </div>

        <h1 className="font-display leading-[1.05] mb-8" style={{ color: "var(--ink)", fontSize: "clamp(2.5rem, 6vw, 4.75rem)" }}>
          مكتبةٌ كاملة
          <br />
          <span className="font-serif-en" dir="ltr" lang="en" style={{ color: "var(--emerald)" }}>
            in your pocket.
          </span>
        </h1>

        <Ornament className="mb-8" />

        <p className="max-w-2xl mx-auto text-base md:text-lg leading-loose mb-12" style={{ color: "var(--muted)" }}>
          اقتنِ، اقرأ، وانشر آلاف الإصدارات الرقمية مباشرةً عبر تيليغرام — مدفوعةً بمحفظة{" "}
          <span className="font-display" style={{ color: "var(--emerald)" }}>{L("SKZ")}</span>{" "}
          الموحَّدة، ومحميَّةً بتوقيع تحميل فريد لكلِّ نسخة.
        </p>

        <div className="flex flex-wrap justify-center items-center gap-5">
          <Link
            href="/library"
            className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-medium tracking-wide transition-transform hover:-translate-y-0.5 cursor-pointer"
            style={{ background: "var(--ink)", color: "var(--ivory)" }}
            data-testid="button-enter-library"
          >
            ادخل المكتبة
            <ArrowLeft size={14} strokeWidth={1.8} />
          </Link>
          <a
            href="#categories"
            className="refined inline-flex items-center gap-1.5 text-sm font-medium px-2 py-2"
            style={{ color: "var(--emerald)" }}
            data-testid="link-browse-categories"
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
          <h2 className="font-display mb-4" style={{ color: "var(--ink)", fontSize: "clamp(1.875rem, 4vw, 2.75rem)" }}>
            ست فئاتٍ. مكتبةٌ واحدة.
          </h2>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            اختر اهتمامك، وابدأ القراءة في الحال.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          style={{ borderTop: "1px solid var(--hairline)", borderRight: "1px solid var(--hairline)" }}>
          {CATEGORIES.map(({ slug, name, desc, iconKey }, i) => {
            const Icon = ICON_MAP[iconKey];
            return (
              <Link
                key={slug}
                href={`/category/${slug}`}
                className="group relative p-8 md:p-10 transition-colors hover:bg-[var(--ivory)] cursor-pointer block"
                style={{ borderBottom: "1px solid var(--hairline)", borderLeft: "1px solid var(--hairline)" }}
                data-testid={`link-category-${slug}`}
              >
                <div className="flex items-start justify-between mb-6">
                  <Icon size={28} strokeWidth={1.25} style={{ color: "var(--emerald)" }} />
                  <span className="font-serif-en text-sm" dir="ltr" lang="en" style={{ color: "var(--gold)" }}>
                    № {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="font-display text-xl mb-2" style={{ color: "var(--ink)" }}>{name}</div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{desc}</p>
                <div className="mt-6 h-px w-8 transition-all group-hover:w-16" style={{ background: "var(--gold)" }} />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="relative py-20 md:py-28"
      style={{ background: "var(--ivory)", borderTop: "1px solid var(--hairline)", borderBottom: "1px solid var(--hairline)" }}>
      <div className="max-w-6xl mx-auto px-6 md:px-10">
        <div className="text-center mb-16">
          <div className="eyebrow mb-4" dir="ltr" lang="en" style={{ color: "var(--gold)" }}>The Promise</div>
          <h2 className="font-display" style={{ color: "var(--ink)", fontSize: "clamp(1.875rem, 4vw, 2.75rem)" }}>
            لماذا <span dir="ltr" lang="en" style={{ color: "var(--emerald)" }}>SOUQRATES SOUQ</span>؟
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px" style={{ background: "var(--hairline)" }}>
          {FEATURES.map(({ Icon, title, desc }) => (
            <div key={title} className="relative p-8 md:p-10" style={{ background: "var(--ivory)" }}>
              <CornerFlourish className="absolute top-3 right-3" />
              <Icon size={26} strokeWidth={1.25} style={{ color: "var(--gold)" }} />
              <h3 className="font-display text-xl mt-5 mb-3" style={{ color: "var(--ink)" }}>{title}</h3>
              <p className="text-sm leading-loose" style={{ color: "var(--muted)" }}>{desc}</p>
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
          <div className="eyebrow mb-4" dir="ltr" lang="en" style={{ color: "var(--gold)" }}>The Ritual</div>
          <h2 className="font-display" style={{ color: "var(--ink)", fontSize: "clamp(1.875rem, 4vw, 2.75rem)" }}>
            أربعُ خطواتٍ بسيطة.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-10">
          {STEPS.map((s) => (
            <div key={s.n} className="relative">
              <div className="flex items-baseline gap-3 mb-4">
                <span className="font-serif-en text-4xl leading-none" dir="ltr" lang="en" style={{ color: "var(--gold)" }}>{s.n}</span>
                <span className="h-px flex-1" style={{ background: "var(--gold-line)" }} />
              </div>
              <h3 className="font-display text-lg mb-2" style={{ color: "var(--ink)" }}>{s.t}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{s.d}</p>
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
        <div className="relative p-10 md:p-16 text-center overflow-hidden" style={{ background: "var(--ink)", color: "var(--ivory)" }}>
          <div className="absolute pointer-events-none" style={{ inset: 12, border: "1px solid var(--gold)" }} />
          <div className="absolute pointer-events-none" style={{ inset: 18, border: "1px solid var(--gold-line)" }} />

          <div className="relative">
            <Feather size={36} strokeWidth={1.2} style={{ color: "var(--gold)", margin: "0 auto" }} />
            <div className="eyebrow mt-6 mb-4" dir="ltr" lang="en" style={{ color: "var(--gold)" }}>
              For Authors &amp; Publishers
            </div>
            <h2 className="font-display mb-6" style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)" }}>
              أنشر إبداعك. واستلم أرباحك.
            </h2>
            <p className="max-w-xl mx-auto text-base leading-loose mb-10" style={{ color: "rgba(251, 246, 234, 0.7)" }}>
              ارفع كتبك مباشرةً من البوت، حدِّد سعرك بـ {L("SKZ")}، واستلم نصيبك تلقائيًا في محفظتك بعد خصم العمولة الموثَّقة.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <a
                href={TELEGRAM_PUBLISH_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-medium tracking-wide transition-transform hover:-translate-y-0.5"
                style={{ background: "var(--gold)", color: "var(--ink)" }}
                data-testid="button-start-publishing"
              >
                ابدأ النشر اليوم
                <ArrowLeft size={14} strokeWidth={1.8} />
              </a>
              <Link
                href="/publish"
                className="refined inline-flex items-center gap-1.5 text-sm font-medium px-2 py-2 cursor-pointer"
                style={{ color: "var(--gold)" }}
                data-testid="link-publish-details"
              >
                التفاصيل والشروط
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <Hero />
      <Categories />
      <Features />
      <HowItWorks />
      <PublishCTA />
    </>
  );
}

export { TELEGRAM_BOT_URL };

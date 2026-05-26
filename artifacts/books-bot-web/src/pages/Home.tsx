import { ArrowLeft, Wallet, Zap, ShieldCheck, Globe2, Feather, BookMarked, GraduationCap, ScrollText, Baby, Brain, Headphones, type LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { L, Ornament, CornerFlourish } from "@/components/Ornaments";
import { CATEGORIES } from "@/lib/catalog";
import { TELEGRAM_BOT_URL, TELEGRAM_PUBLISH_URL } from "@/lib/constants";
import { useT } from "@/lib/i18n";

type IconKey = (typeof CATEGORIES)[number]["iconKey"];
const ICON_MAP: Record<IconKey, LucideIcon> = {
  religion: BookMarked,
  education: GraduationCap,
  literature: ScrollText,
  kids: Baby,
  self: Brain,
  audio: Headphones,
};

function Hero() {
  const t = useT();
  return (
    <section className="relative">
      <div className="max-w-4xl mx-auto px-6 md:px-10 py-20 md:py-28 text-center rise">
        <div className="eyebrow mb-8" style={{ color: "var(--gold)" }}>
          <span dir="ltr" lang="en">{t("home.volume")}</span> {t("home.volumeAr")}
        </div>

        <h1 className="font-display leading-[1.05] mb-8" style={{ color: "var(--ink)", fontSize: "clamp(2.5rem, 6vw, 4.75rem)" }}>
          {t("home.heroTitleL1")}
          <br />
          <span className="font-serif-en" dir="ltr" lang="en" style={{ color: "var(--emerald)" }}>
            {t("home.heroTitleL2")}
          </span>
        </h1>

        <Ornament className="mb-8" />

        <p className="max-w-2xl mx-auto text-base md:text-lg leading-loose mb-12" style={{ color: "var(--muted)" }}>
          {t("home.heroLead", { skz: "SKZ" })}
        </p>

        <div className="flex flex-wrap justify-center items-center gap-5">
          <Link
            href="/library"
            className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-medium tracking-wide transition-transform hover:-translate-y-0.5 cursor-pointer"
            style={{ background: "var(--ink)", color: "var(--ivory)" }}
            data-testid="button-enter-library"
          >
            {t("home.enterLibrary")}
            <ArrowLeft size={14} strokeWidth={1.8} />
          </Link>
          <a
            href="#categories"
            className="refined inline-flex items-center gap-1.5 text-sm font-medium px-2 py-2"
            style={{ color: "var(--emerald)" }}
            data-testid="link-browse-categories"
          >
            {t("home.browseCategories")}
          </a>
        </div>
      </div>
    </section>
  );
}

function Categories() {
  const t = useT();
  return (
    <section id="categories" className="relative py-20 md:py-28">
      <div className="max-w-6xl mx-auto px-6 md:px-10">
        <div className="text-center mb-16">
          <div className="eyebrow mb-4" dir="ltr" lang="en" style={{ color: "var(--gold)" }}>
            {t("home.categoriesEyebrow")}
          </div>
          <h2 className="font-display mb-4" style={{ color: "var(--ink)", fontSize: "clamp(1.875rem, 4vw, 2.75rem)" }}>
            {t("home.categoriesTitle")}
          </h2>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {t("home.categoriesLead")}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          style={{ borderTop: "1px solid var(--hairline)", borderRight: "1px solid var(--hairline)" }}>
          {CATEGORIES.map(({ slug, iconKey }, i) => {
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
                <div className="font-display text-xl mb-2" style={{ color: "var(--ink)" }}>{t(`cat.${slug}.name`)}</div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{t(`cat.${slug}.desc`)}</p>
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
  const t = useT();
  const FEATURES: { Icon: LucideIcon; title: string; desc: React.ReactNode }[] = [
    { Icon: Wallet,      title: t("home.feat1Title"), desc: t("home.feat1Desc", { skz: "SKZ", system: "SOUQRATES SYSTEM" }) },
    { Icon: Zap,         title: t("home.feat2Title"), desc: t("home.feat2Desc", { hmac: "HMAC" }) },
    { Icon: ShieldCheck, title: t("home.feat3Title"), desc: t("home.feat3Desc") },
    { Icon: Globe2,      title: t("home.feat4Title"), desc: t("home.feat4Desc") },
  ];
  return (
    <section className="relative py-20 md:py-28"
      style={{ background: "var(--ivory)", borderTop: "1px solid var(--hairline)", borderBottom: "1px solid var(--hairline)" }}>
      <div className="max-w-6xl mx-auto px-6 md:px-10">
        <div className="text-center mb-16">
          <div className="eyebrow mb-4" dir="ltr" lang="en" style={{ color: "var(--gold)" }}>{t("home.featuresEyebrow")}</div>
          <h2 className="font-display" style={{ color: "var(--ink)", fontSize: "clamp(1.875rem, 4vw, 2.75rem)" }}>
            {t("home.featuresTitleA")} <span dir="ltr" lang="en" style={{ color: "var(--emerald)" }}>SOUQRATES SOUQ</span>{t("home.featuresTitleB")}
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
  const t = useT();
  const STEPS: { n: string; t: React.ReactNode; d: React.ReactNode }[] = [
    { n: "I",   t: t("home.step1Title"), d: <>{t("home.step1Desc").split(/\{start\}|\{souq\}/)[0]}{L("/start")}{t("home.step1Desc").split(/\{start\}|\{souq\}/)[1]}{L("SOUQRATES SOUQ")}{t("home.step1Desc").split(/\{start\}|\{souq\}/)[2]}</> },
    { n: "II",  t: t("home.step2Title"), d: t("home.step2Desc") },
    { n: "III", t: t("home.step3Title", { skz: "SKZ" }), d: t("home.step3Desc") },
    { n: "IV",  t: t("home.step4Title"), d: t("home.step4Desc") },
  ];
  return (
    <section className="relative py-20 md:py-28">
      <div className="max-w-6xl mx-auto px-6 md:px-10">
        <div className="text-center mb-16">
          <div className="eyebrow mb-4" dir="ltr" lang="en" style={{ color: "var(--gold)" }}>{t("home.ritualEyebrow")}</div>
          <h2 className="font-display" style={{ color: "var(--ink)", fontSize: "clamp(1.875rem, 4vw, 2.75rem)" }}>
            {t("home.ritualTitle")}
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
  const t = useT();
  return (
    <section className="relative py-20 md:py-28 px-6 md:px-10">
      <div className="max-w-5xl mx-auto">
        <div className="relative p-10 md:p-16 text-center overflow-hidden" style={{ background: "var(--ink)", color: "var(--ivory)" }}>
          <div className="absolute pointer-events-none" style={{ inset: 12, border: "1px solid var(--gold)" }} />
          <div className="absolute pointer-events-none" style={{ inset: 18, border: "1px solid var(--gold-line)" }} />

          <div className="relative">
            <Feather size={36} strokeWidth={1.2} style={{ color: "var(--gold)", margin: "0 auto" }} />
            <div className="eyebrow mt-6 mb-4" dir="ltr" lang="en" style={{ color: "var(--gold)" }}>
              {t("home.publishEyebrow")}
            </div>
            <h2 className="font-display mb-6" style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)" }}>
              {t("home.publishTitle")}
            </h2>
            <p className="max-w-xl mx-auto text-base leading-loose mb-10" style={{ color: "rgba(251, 246, 234, 0.7)" }}>
              {t("home.publishLead", { skz: "SKZ" })}
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
                {t("home.publishCta")}
                <ArrowLeft size={14} strokeWidth={1.8} />
              </a>
              <Link
                href="/publish"
                className="refined inline-flex items-center gap-1.5 text-sm font-medium px-2 py-2 cursor-pointer"
                style={{ color: "var(--gold)" }}
                data-testid="link-publish-details"
              >
                {t("home.publishDetails")}
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

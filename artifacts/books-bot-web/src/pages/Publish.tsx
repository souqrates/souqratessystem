import { ArrowLeft, Feather, Upload, Coins, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { L, Ornament, CornerFlourish } from "@/components/Ornaments";
import { TELEGRAM_PUBLISH_URL } from "@/lib/constants";

const STEPS = [
  { Icon: Upload,      title: "ارفع كتابك",        desc: <>أرسل الملف إلى البوت بصيغة {L("PDF")} أو {L("EPUB")} أو صوتي.</> },
  { Icon: Coins,       title: "حدِّد سعرك",         desc: <>اختر سعرًا بـ {L("SKZ")} يناسب جمهورك، وعدِّله متى شئت.</> },
  { Icon: ShieldCheck, title: "راجعةٌ ومُوثَّقة",   desc: <>فريق التحرير يراجع المحتوى، ثم يُنشر بتوقيعٍ مُؤمَّن.</> },
  { Icon: Coins,       title: "استلم أرباحك",      desc: <>نصيبك يُودَع تلقائيًا في محفظتك بعد كل عملية بيع.</> },
];

export default function Publish() {
  return (
    <>
      <section className="relative py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-6 md:px-10 text-center">
          <Feather size={42} strokeWidth={1.2} style={{ color: "var(--gold)", margin: "0 auto" }} />
          <div className="eyebrow mt-6 mb-4" dir="ltr" lang="en" style={{ color: "var(--gold)" }}>
            For Authors &amp; Publishers
          </div>
          <h1 className="font-display mb-6" style={{ color: "var(--ink)", fontSize: "clamp(2rem, 5vw, 3.25rem)" }}>
            أنشر إبداعك. واستلم أرباحك.
          </h1>
          <Ornament className="mb-8" />
          <p className="max-w-2xl mx-auto leading-loose" style={{ color: "var(--muted)" }}>
            نمنحُكَ منصّةً بوتيكيةً موقَّرة لنشر أعمالك الرقمية، مع نظامِ دفعٍ موحَّدٍ بـ {L("SKZ")}،
            وحقوقٍ محفوظةٍ بتوقيعٍ مشفَّر، وتسويةٍ آنيةٍ لكلِّ عملية بيع.
          </p>
        </div>
      </section>

      <section className="relative py-16 md:py-20" style={{ background: "var(--ivory)", borderTop: "1px solid var(--hairline)", borderBottom: "1px solid var(--hairline)" }}>
        <div className="max-w-6xl mx-auto px-6 md:px-10">
          <div className="text-center mb-14">
            <div className="eyebrow mb-3" dir="ltr" lang="en" style={{ color: "var(--gold)" }}>The Process</div>
            <h2 className="font-display" style={{ color: "var(--ink)", fontSize: "clamp(1.875rem, 4vw, 2.5rem)" }}>
              أربعُ خطواتٍ، لا أكثر.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px" style={{ background: "var(--hairline)" }}>
            {STEPS.map(({ Icon, title, desc }, i) => (
              <div key={title} className="relative p-8 md:p-10" style={{ background: "var(--ivory)" }}>
                <CornerFlourish className="absolute top-3 right-3" />
                <div className="flex items-baseline gap-3 mb-4">
                  <span className="font-serif-en text-3xl" dir="ltr" lang="en" style={{ color: "var(--gold)" }}>
                    {["I","II","III","IV"][i]}
                  </span>
                  <Icon size={22} strokeWidth={1.3} style={{ color: "var(--emerald)" }} />
                </div>
                <h3 className="font-display text-lg mb-3" style={{ color: "var(--ink)" }}>{title}</h3>
                <p className="text-sm leading-loose" style={{ color: "var(--muted)" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 md:py-24 px-6 md:px-10">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display mb-6" style={{ color: "var(--ink)", fontSize: "clamp(1.5rem, 3.5vw, 2rem)" }}>
            جاهز للبدء؟
          </h2>
          <p className="mb-8 leading-loose" style={{ color: "var(--muted)" }}>
            افتح البوت الآن وابدأ {L("/start publish")} لرفع أوّل عمل لك.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href={TELEGRAM_PUBLISH_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-medium tracking-wide transition-transform hover:-translate-y-0.5"
              style={{ background: "var(--ink)", color: "var(--ivory)" }}
              data-testid="button-publish-now"
            >
              ابدأ النشر الآن
              <ArrowLeft size={14} strokeWidth={1.8} />
            </a>
            <Link href="/library" className="refined text-sm" style={{ color: "var(--emerald)" }} data-testid="link-browse-library">
              تصفَّح ما نُشر
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

import "./index.css";

const CATEGORIES = [
  { emoji: "📖", name: "كتب دينية", desc: "تفسير وحديث وفقه" },
  { emoji: "🎓", name: "تعليمية", desc: "مناهج وشروحات" },
  { emoji: "📚", name: "روايات وأدب", desc: "قصص وشعر" },
  { emoji: "🧒", name: "كتب الأطفال", desc: "قصص مصورة" },
  { emoji: "🧠", name: "تطوير الذات", desc: "نجاح وإلهام" },
  { emoji: "🎧", name: "كتب صوتية", desc: "استمع في أي وقت" },
];

const FEATURES = [
  { icon: "💎", title: "محفظة موحدة", desc: "ادفع بـ SKZ من محفظتك في البوت الأم — بدون بطاقات." },
  { icon: "⚡", title: "تحميل فوري", desc: "روابط آمنة موقعة بـ HMAC، صالحة 7 أيام." },
  { icon: "🛡️", title: "حقوق محفوظة", desc: "كل عملية شراء موثقة. الناشر يستلم أرباحه تلقائياً." },
  { icon: "🌍", title: "لكل المكتبة العربية", desc: "ست فئات تغطي اهتمامات القارئ العربي." },
];

function Header() {
  return (
    <header
      className="w-full"
      style={{
        background: "linear-gradient(135deg, var(--emerald) 0%, var(--emerald-dark) 100%)",
        borderBottom: "4px solid var(--gold)",
      }}
    >
      <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
            style={{ background: "var(--gold)", color: "var(--emerald-dark)" }}
          >
            📚
          </div>
          <div className="text-white">
            <div className="text-xl font-bold leading-tight">souqrates books</div>
            <div className="text-xs opacity-80">متجر الكتب الرقمي</div>
          </div>
        </div>
        <a
          href="https://t.me/"
          className="hidden sm:inline-block px-5 py-2.5 rounded-lg font-bold text-sm transition-transform hover:scale-105"
          style={{ background: "var(--gold)", color: "var(--emerald-dark)" }}
        >
          افتح البوت في تيليغرام
        </a>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-16 md:py-24 text-center">
      <div
        className="inline-block mb-6 px-4 py-1.5 rounded-full text-xs font-bold tracking-wide"
        style={{
          background: "rgba(212, 175, 55, 0.15)",
          color: "var(--emerald-dark)",
          border: "1px solid var(--gold)",
        }}
      >
        ✨ ضمن منصة SOUQRATESSKILLZ
      </div>
      <h1
        className="text-4xl md:text-6xl font-extrabold leading-tight mb-6"
        style={{ color: "var(--emerald-dark)" }}
      >
        مكتبتك الرقمية
        <br />
        <span style={{ color: "var(--gold)" }}>في جيبك</span>
      </h1>
      <p
        className="max-w-2xl mx-auto text-lg md:text-xl mb-10"
        style={{ color: "var(--muted)" }}
      >
        اشترِ، حمّل، واقرأ آلاف الكتب الرقمية مباشرة عبر تيليغرام —
        مدفوعة بمحفظة SKZ الموحدة، وموقّعة برمز تحميل آمن.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <a
          href="https://t.me/"
          className="px-7 py-3.5 rounded-xl font-bold text-base transition-all hover:shadow-lg"
          style={{
            background: "var(--emerald)",
            color: "white",
            boxShadow: "0 4px 0 var(--emerald-dark)",
          }}
        >
          ابدأ التصفح الآن
        </a>
        <a
          href="#categories"
          className="px-7 py-3.5 rounded-xl font-bold text-base"
          style={{
            background: "white",
            color: "var(--emerald-dark)",
            border: "2px solid var(--emerald)",
          }}
        >
          استكشف الفئات
        </a>
      </div>
    </section>
  );
}

function Categories() {
  return (
    <section id="categories" className="max-w-6xl mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: "var(--emerald-dark)" }}>
          ست فئات. مكتبة كاملة.
        </h2>
        <p style={{ color: "var(--muted)" }}>اختر اهتمامك وابدأ القراءة فوراً</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {CATEGORIES.map((c) => (
          <div
            key={c.name}
            className="p-6 rounded-2xl transition-transform hover:-translate-y-1"
            style={{
              background: "white",
              border: "1px solid rgba(15, 118, 110, 0.12)",
              boxShadow: "0 2px 8px rgba(15, 118, 110, 0.05)",
            }}
          >
            <div className="text-4xl mb-3">{c.emoji}</div>
            <div className="font-bold text-lg mb-1" style={{ color: "var(--emerald-dark)" }}>
              {c.name}
            </div>
            <div className="text-sm" style={{ color: "var(--muted)" }}>
              {c.desc}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  return (
    <section
      className="py-16"
      style={{
        background: "linear-gradient(180deg, var(--cream) 0%, white 100%)",
        borderTop: "1px solid rgba(15, 118, 110, 0.1)",
        borderBottom: "1px solid rgba(15, 118, 110, 0.1)",
      }}
    >
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: "var(--emerald-dark)" }}>
            لماذا souqrates books؟
          </h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="p-6 rounded-2xl text-center"
              style={{
                background: "white",
                border: "2px solid transparent",
                borderImage: "linear-gradient(135deg, var(--gold), var(--emerald)) 1",
              }}
            >
              <div className="text-3xl mb-3">{f.icon}</div>
              <div className="font-bold mb-2" style={{ color: "var(--emerald-dark)" }}>
                {f.title}
              </div>
              <div className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                {f.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "1", t: "افتح البوت", d: "ابدأ /start في souqrates books" },
    { n: "2", t: "اختر كتاباً", d: "تصفّح حسب الفئة أو ابحث بالاسم" },
    { n: "3", t: "ادفع بـ SKZ", d: "خصم فوري من محفظتك الموحدة" },
    { n: "4", t: "حمّل واقرأ", d: "رابط آمن صالح لمدة 7 أيام" },
  ];
  return (
    <section className="max-w-6xl mx-auto px-6 py-16">
      <h2
        className="text-3xl md:text-4xl font-bold text-center mb-12"
        style={{ color: "var(--emerald-dark)" }}
      >
        كيف يعمل؟
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {steps.map((s) => (
          <div key={s.n} className="text-center">
            <div
              className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl font-extrabold"
              style={{
                background: "var(--emerald)",
                color: "var(--gold)",
                boxShadow: "0 4px 0 var(--emerald-dark)",
              }}
            >
              {s.n}
            </div>
            <div className="font-bold mb-1" style={{ color: "var(--emerald-dark)" }}>
              {s.t}
            </div>
            <div className="text-sm" style={{ color: "var(--muted)" }}>
              {s.d}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PublishCTA() {
  return (
    <section
      className="max-w-6xl mx-auto px-6 py-16 mb-16 mx-4"
      style={{}}
    >
      <div
        className="rounded-3xl p-10 md:p-14 text-center"
        style={{
          background: "linear-gradient(135deg, var(--emerald-dark) 0%, var(--emerald) 100%)",
          border: "3px solid var(--gold)",
        }}
      >
        <div className="text-5xl mb-4">✍️</div>
        <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
          أنت ناشر أو مؤلف؟
        </h2>
        <p className="text-lg mb-8 max-w-xl mx-auto" style={{ color: "rgba(255,255,255,0.85)" }}>
          ارفع كتبك مباشرة من البوت، حدّد سعرك بـ SKZ، واستلم أرباحك
          تلقائياً في محفظتك بعد خصم العمولة.
        </p>
        <a
          href="https://t.me/"
          className="inline-block px-8 py-3.5 rounded-xl font-bold transition-transform hover:scale-105"
          style={{ background: "var(--gold)", color: "var(--emerald-dark)" }}
        >
          ابدأ النشر اليوم
        </a>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer
      className="py-10 text-center text-sm"
      style={{
        background: "var(--emerald-dark)",
        color: "rgba(255,255,255,0.7)",
        borderTop: "4px solid var(--gold)",
      }}
    >
      <div className="max-w-6xl mx-auto px-6">
        <div className="font-bold text-white mb-2">📚 souqrates books</div>
        <div>جزء من منصة SOUQRATESSKILLZ — البوت الأم</div>
        <div className="mt-3 opacity-60">© 2026 جميع الحقوق محفوظة</div>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <div className="min-h-screen">
      <Header />
      <Hero />
      <Categories />
      <Features />
      <HowItWorks />
      <PublishCTA />
      <Footer />
    </div>
  );
}

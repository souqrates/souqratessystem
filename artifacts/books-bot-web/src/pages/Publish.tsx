import { ArrowLeft, Upload, Coins, ShieldCheck, TrendingUp, Globe2, Zap, BarChart2, PenLine } from "lucide-react";
import { Link } from "wouter";
import { TELEGRAM_PUBLISH_URL } from "@/lib/constants";

const STEPS = [
  {
    n: '01',
    icon: <Upload size={20} />,
    color: '#22d3ee',
    title: 'ارفع كتابك',
    desc: 'أرسل الملف (PDF أو EPUB) عبر البوت مع بيانات الكتاب الأساسية',
  },
  {
    n: '02',
    icon: <Coins size={20} />,
    color: '#a855f7',
    title: 'حدّد سعرك بـ SKZ',
    desc: 'أنت تختار السعر بالكامل — المنصة تأخذ عمولة صغيرة على كل بيعة فقط',
  },
  {
    n: '03',
    icon: <ShieldCheck size={20} />,
    color: '#10b981',
    title: 'مراجعة سريعة',
    desc: 'فريقنا يراجع المحتوى خلال 24-48 ساعة ثم ينشره في الكتالوج',
  },
  {
    n: '04',
    icon: <TrendingUp size={20} />,
    color: '#f59e0b',
    title: 'اكسب من كل بيعة',
    desc: 'تصلك أرباحك تلقائياً في محفظة SKZ بعد كل عملية شراء ناجحة',
  },
];

const WHY = [
  { icon: <Globe2 size={22} />,    t: 'وصول واسع',       d: 'آلاف المشتركين في منظومة SOUQRATES' },
  { icon: <Zap size={22} />,       t: 'تسليم تلقائي',    d: 'بدون تدخل يدوي — البوت يرسل الملف فوراً' },
  { icon: <Coins size={22} />,     t: 'أرباح فورية',     d: 'SKZ يُضاف لمحفظتك بعد كل بيعة مباشرة' },
  { icon: <BarChart2 size={22} />, t: 'إحصاءات مباشرة', d: 'تتابع مبيعاتك من لوحة تحكم خاصة' },
];

export default function Publish() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-10">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-8 text-xs" style={{ color: 'rgba(148,163,184,0.45)' }}>
        <Link href="/" className="hover:text-white/60 transition-colors">الرئيسية</Link>
        <span>/</span>
        <span style={{ color: '#a855f7' }}>انشر كتابك</span>
      </div>

      {/* Hero */}
      <div className="text-center mb-14 rise">
        <div className="mb-6" style={{ color: '#a855f7', display: 'flex', justifyContent: 'center' }}><PenLine size={48} strokeWidth={1.3} /></div>
        <div className="inline-flex items-center gap-2 mb-4 px-4 py-1.5 rounded-full"
          style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}>
          <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#a855f7' }}>
            FOR AUTHORS — للمؤلفين
          </span>
        </div>
        <h1 className="font-orbitron font-black text-3xl md:text-4xl text-white/90 mb-4">
          انشر كتابك عبر
          <br />
          <span style={{ color: '#a855f7' }}>SOUQRATES SOUQ</span>
        </h1>
        <p className="max-w-xl mx-auto text-sm leading-relaxed" style={{ color: 'rgba(148,163,184,0.65)' }}>
          اوصل كتابك لآلاف القراء في منظومة SOUQRATES واكسب SKZ على كل نسخة مباعة.
          <br />بدون تعقيدات — البوت يتكفّل بكل شيء.
        </p>

        <div className="flex flex-wrap justify-center gap-3 mt-8">
          <a
            href={TELEGRAM_PUBLISH_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-xl font-black text-sm transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg,#6d28d9,#a855f7)', color: '#fff' }}
            data-testid="button-publish-now"
          >
            ابدأ النشر الآن
            <ArrowLeft size={13} />
          </a>
          <Link
            href="/library"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm border transition-all"
            style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(148,163,184,0.7)' }}
            data-testid="link-browse-library"
          >
            تصفّح المكتبة
          </Link>
        </div>
      </div>

      {/* Steps */}
      <div className="mb-14">
        <div className="eyebrow mb-3" style={{ color: 'rgba(148,163,184,0.4)', fontSize: 9 }}>HOW IT WORKS</div>
        <h2 className="font-orbitron font-black text-xl text-white/85 mb-7">كيف تنشر كتابك؟</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {STEPS.map(s => (
            <div key={s.n} className="neon-card rounded-xl p-5 flex gap-4">
              <div className="shrink-0">
                <div className="font-orbitron text-2xl font-black mb-2" style={{ color: `${s.color}35` }}>{s.n}</div>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: `${s.color}12`, color: s.color, border: `1px solid ${s.color}22` }}>
                  {s.icon}
                </div>
              </div>
              <div>
                <div className="font-black text-sm text-white/85 mb-1.5">{s.title}</div>
                <div className="text-xs leading-relaxed" style={{ color: 'rgba(148,163,184,0.55)' }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Why */}
      <div className="mb-14">
        <div className="eyebrow mb-3" style={{ color: 'rgba(148,163,184,0.4)', fontSize: 9 }}>WHY SOUQRATES SOUQ</div>
        <h2 className="font-orbitron font-black text-xl text-white/85 mb-7">لماذا تنشر معنا؟</h2>

        <div className="grid grid-cols-2 gap-3">
          {WHY.map(w => (
            <div key={w.t} className="neon-card rounded-xl p-5">
              <div className="mb-3" style={{ color: 'rgba(34,211,238,0.75)' }}>{w.icon}</div>
              <div className="font-black text-sm text-white/85 mb-1">{w.t}</div>
              <div className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>{w.d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Final CTA */}
      <div
        className="rounded-2xl p-8 text-center"
        style={{
          background: 'linear-gradient(135deg, #0f0e1c, #1a1030)',
          border: '1px solid rgba(168,85,247,0.25)',
          boxShadow: '0 0 50px rgba(168,85,247,0.06) inset',
        }}
      >
        <div className="font-orbitron font-black text-lg text-white/90 mb-3">
          هل أنت مستعد للبدء؟
        </div>
        <p className="text-xs mb-6" style={{ color: 'rgba(148,163,184,0.55)' }}>
          افتح البوت واكتب <span className="font-black" style={{ color: '#a855f7' }}>/start publish</span> للبدء فوراً
        </p>
        <a
          href={TELEGRAM_PUBLISH_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-7 py-3 rounded-xl font-black text-sm transition-all hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(135deg,#6d28d9,#a855f7)', color: '#fff' }}
          data-testid="button-start-publishing"
        >
          ابدأ النشر عبر تيليغرام
          <ArrowLeft size={13} />
        </a>
      </div>
    </div>
  );
}

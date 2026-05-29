import { useState } from "react";
import { ArrowLeft, Zap, ExternalLink, Search } from "lucide-react";
import { VOUCHER_BRANDS, VOUCHER_CATEGORY_META, vouchersByCategory, type VoucherCategory, type VoucherBrand } from "@/lib/vouchers";
import { TELEGRAM_BOT_URL } from "@/lib/constants";

/* ── Voucher Card ── */
function VoucherCard({ v }: { v: VoucherBrand }) {
  return (
    <a
      href={TELEGRAM_BOT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="voucher-card rounded-xl overflow-hidden block"
      style={{ border: `1px solid ${v.color}22` }}
      data-testid={`voucher-${v.id}`}
    >
      {/* Card body */}
      <div className="p-5" style={{ background: v.bgGradient, minHeight: 140 }}>
        <div className="flex items-start justify-between mb-3">
          <div className="text-4xl">{v.emoji}</div>
          {v.hot && (
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(239,68,68,0.25)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.35)' }}>
              🔥 HOT
            </span>
          )}
        </div>
        <div className="font-black text-base text-white/90 mb-0.5">{v.nameAr}</div>
        <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{v.name}</div>
      </div>

      {/* Denominations */}
      <div className="p-4" style={{ background: 'rgba(255,255,255,0.025)', borderTop: `1px solid ${v.color}15` }}>
        <div className="text-[10px] font-bold mb-2" style={{ color: 'rgba(148,163,184,0.5)' }}>
          الفئات المتاحة (SKZ)
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {v.denominations.map(d => (
            <span
              key={d}
              className="text-[10px] font-black px-2 py-0.5 rounded-lg"
              style={{ background: `${v.color}15`, color: v.color, border: `1px solid ${v.color}25` }}
            >
              {d.toLocaleString()}
            </span>
          ))}
        </div>
        <div
          className="flex items-center justify-between px-3 py-2 rounded-lg font-black text-xs transition-all"
          style={{ background: `${v.color}15`, color: v.color, border: `1px solid ${v.color}25` }}
        >
          <span>اشترِ الآن عبر تيليغرام</span>
          <ExternalLink size={12} />
        </div>
      </div>
    </a>
  );
}

/* ── Page ── */
export default function DigitalServices() {
  const [activeCategory, setActiveCategory] = useState<VoucherCategory | 'all'>('all');
  const [searchQ, setSearchQ] = useState('');

  const filtered = VOUCHER_BRANDS.filter(v => {
    const matchCat = activeCategory === 'all' || v.category === activeCategory;
    const matchQ = !searchQ || v.nameAr.includes(searchQ) || v.name.toLowerCase().includes(searchQ.toLowerCase());
    return matchCat && matchQ;
  });

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">

      {/* Header */}
      <div className="mb-8 rise">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6 text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>
          <a href="/" className="hover:text-white/70 transition-colors">الرئيسية</a>
          <span>/</span>
          <span style={{ color: '#a855f7' }}>Digital Store</span>
        </div>

        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)' }}>
            <Zap size={18} color="#a855f7" />
          </div>
          <div>
            <h1 className="font-orbitron font-black text-2xl text-white/90" dir="ltr">Digital Store</h1>
            <div className="text-xs mt-0.5" style={{ color: 'rgba(148,163,184,0.5)' }}>
              Vouchers رقمية لأشهر المنصات العالمية — ادفع بـ SKZ
            </div>
          </div>
        </div>

        {/* Banner */}
        <div className="rounded-xl p-4 mt-4 flex items-center gap-3"
          style={{ background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.15)' }}>
          <div className="text-2xl">💡</div>
          <div className="text-xs leading-relaxed" style={{ color: 'rgba(148,163,184,0.7)' }}>
            ستُضاف API متجر قريباً لشراء الـ Vouchers مباشرة. حالياً يمكنك الطلب عبر البوت على تيليغرام.
          </div>
          <a href={TELEGRAM_BOT_URL} target="_blank" rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all hover:-translate-y-0.5"
            style={{ background: 'rgba(168,85,247,0.2)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.3)' }}>
            اطلب الآن <ArrowLeft size={12} />
          </a>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-7">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(148,163,184,0.4)' }} />
          <input
            type="text"
            placeholder="ابحث عن خدمة..."
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            className="w-full rounded-xl px-4 py-2.5 pr-9 text-sm font-bold outline-none transition-all"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#f1f5f9',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(168,85,247,0.4)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
          />
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveCategory('all')}
            className="shrink-0 px-3 py-2 rounded-xl text-xs font-black transition-all"
            style={{
              background: activeCategory === 'all' ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.04)',
              color: activeCategory === 'all' ? '#a855f7' : 'rgba(148,163,184,0.6)',
              border: `1px solid ${activeCategory === 'all' ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.07)'}`,
            }}
          >
            الكل
          </button>
          {VOUCHER_CATEGORY_META.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all"
              style={{
                background: activeCategory === cat.id ? `${cat.color}18` : 'rgba(255,255,255,0.04)',
                color: activeCategory === cat.id ? cat.color : 'rgba(148,163,184,0.6)',
                border: `1px solid ${activeCategory === cat.id ? `${cat.color}35` : 'rgba(255,255,255,0.07)'}`,
              }}
            >
              {cat.emoji} {cat.nameAr}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {filtered.map(v => <VoucherCard key={v.id} v={v} />)}
        </div>
      ) : (
        <div className="text-center py-20" style={{ color: 'rgba(148,163,184,0.4)' }}>
          <div className="text-4xl mb-4">🔍</div>
          <div className="font-bold text-sm">لا توجد نتائج</div>
        </div>
      )}

      {/* Coming soon notice */}
      <div className="mt-10 rounded-xl p-6 text-center"
        style={{ background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.12)' }}>
        <div className="font-orbitron font-black text-sm mb-2" style={{ color: '#22d3ee' }}>
          🚀 API متجر الـ Vouchers قريباً
        </div>
        <div className="text-xs leading-relaxed" style={{ color: 'rgba(148,163,184,0.55)' }}>
          ستتيح المنصة شراء وإرسال الـ Vouchers بشكل أوتوماتيكي مباشرة من داخل التطبيق.
          حتى ذلك الحين يمكن الطلب عبر البوت.
        </div>
      </div>
    </div>
  );
}

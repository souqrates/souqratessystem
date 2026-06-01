/**
 * BookCoverPicker — 10 pre-designed book cover templates.
 * User types title + optional author → live preview → download as PNG.
 */
import { useRef, useState } from "react";
import { Heart, Star, Download, Check } from "lucide-react";
import html2canvas from "html2canvas";

export type CoverStyle = {
  id: string;
  label: string;
  genre: string;
};

export const COVER_STYLES: CoverStyle[] = [
  { id: "classic",     label: "الكلاسيكي الأنيق",   genre: "أدب • شعر • روايات" },
  { id: "minimal",     label: "العصري البسيط",       genre: "غير روائي • أعمال" },
  { id: "thriller",    label: "الغموض والإثارة",     genre: "تشويق • جريمة • بوليسي" },
  { id: "romance",     label: "الرومانسي الشعري",    genre: "رومانسي • قصائد الحب" },
  { id: "tech",        label: "العلوم والتقنية",      genre: "علوم • تقنية • ذكاء اصطناعي" },
  { id: "spiritual",   label: "الإسلامي الروحي",     genre: "إسلامي • ديني • روحاني" },
  { id: "business",    label: "الأعمال والنجاح",     genre: "ريادة • قيادة • مال" },
  { id: "cosmic",      label: "الفضاء والخيال",      genre: "خيال علمي • فانتازيا" },
  { id: "heritage",    label: "التراث والتاريخ",      genre: "تاريخ • سيرة • تراث" },
  { id: "energy",      label: "التحفيز والطاقة",      genre: "تطوير ذات • رياضة • شباب" },
];

/* ─── Individual cover renderers ─────────────────────────────────────────── */

function CoverClassic({ title, author }: { title: string; author: string }) {
  return (
    <div style={{
      width: "100%", height: "100%", position: "relative",
      background: "linear-gradient(160deg, #0d1b3e 0%, #1a2f5e 50%, #0a1428 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      overflow: "hidden", fontFamily: "Georgia, 'Times New Roman', serif",
    }}>
      {/* Gold border frame */}
      <div style={{ position: "absolute", inset: 12, border: "1.5px solid #c9a227", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 16, border: "0.5px solid #c9a22760", pointerEvents: "none" }} />
      {/* Corner ornaments */}
      {[[-1,-1],[1,-1],[-1,1],[1,1]].map(([sx,sy], i) => (
        <svg key={i} width={32} height={32} style={{
          position: "absolute",
          top: sy < 0 ? 8 : "auto", bottom: sy > 0 ? 8 : "auto",
          left: sx < 0 ? 8 : "auto", right: sx > 0 ? 8 : "auto",
          transform: `scaleX(${sx}) scaleY(${sy})`,
        }} viewBox="0 0 32 32">
          <path d="M2 2 L2 12 M2 2 L12 2" stroke="#c9a227" strokeWidth="1.5" fill="none"/>
          <path d="M8 8 L8 14 M8 8 L14 8" stroke="#c9a22780" strokeWidth="1" fill="none"/>
          <circle cx="2" cy="2" r="1.5" fill="#c9a227"/>
        </svg>
      ))}
      {/* Top rule */}
      <div style={{ position: "absolute", top: 48, left: 28, right: 28, height: 1, background: "linear-gradient(90deg,transparent,#c9a227,transparent)" }} />
      {/* Bottom rule */}
      <div style={{ position: "absolute", bottom: 56, left: 28, right: 28, height: 1, background: "linear-gradient(90deg,transparent,#c9a227,transparent)" }} />
      {/* Title */}
      <div style={{ padding: "0 32px", textAlign: "center", zIndex: 1 }}>
        <div style={{ color: "#f0d080", fontSize: 9, letterSpacing: 4, textTransform: "uppercase", marginBottom: 14 }}>— SOUQRATES SOUQ —</div>
        <div style={{ color: "#e8d5a0", fontSize: title.length > 20 ? 17 : title.length > 12 ? 21 : 26, fontWeight: 700, lineHeight: 1.35, textShadow: "0 2px 12px #00000080" }}>
          {title || "عنوان الكتاب"}
        </div>
      </div>
      {/* Author */}
      {(author || true) && (
        <div style={{ position: "absolute", bottom: 26, left: 0, right: 0, textAlign: "center", color: "#c9a22799", fontSize: 9, letterSpacing: 2 }}>
          {author ? author.toUpperCase() : "اسم المؤلف"}
        </div>
      )}
    </div>
  );
}

function CoverMinimal({ title, author }: { title: string; author: string }) {
  return (
    <div style={{
      width: "100%", height: "100%", position: "relative",
      background: "#f5f4f0",
      display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center",
      overflow: "hidden", fontFamily: "Arial, Helvetica, sans-serif",
    }}>
      {/* Thick left accent bar */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 8, background: "#1a1a1a" }} />
      {/* Top horizontal rule */}
      <div style={{ position: "absolute", top: 36, left: 24, right: 24, height: 2, background: "#1a1a1a" }} />
      {/* Bottom horizontal rule */}
      <div style={{ position: "absolute", bottom: 50, left: 24, right: 24, height: 1, background: "#1a1a1a40" }} />
      {/* Decorative large number */}
      <div style={{ position: "absolute", right: -10, top: "20%", fontSize: 120, fontWeight: 900, color: "#1a1a1a0a", lineHeight: 1, userSelect: "none" }}>§</div>
      {/* Brand */}
      <div style={{ position: "absolute", top: 18, right: 24, fontSize: 7, letterSpacing: 3, color: "#555", textTransform: "uppercase" }}>SOUQRATES SOUQ</div>
      {/* Title */}
      <div style={{ padding: "0 24px 0 32px", textAlign: "right", zIndex: 1, width: "100%", boxSizing: "border-box" }}>
        <div style={{ color: "#1a1a1a", fontSize: title.length > 20 ? 18 : title.length > 12 ? 23 : 29, fontWeight: 900, lineHeight: 1.2 }}>
          {title || "عنوان الكتاب"}
        </div>
      </div>
      {/* Author */}
      <div style={{ position: "absolute", bottom: 20, right: 24, color: "#555", fontSize: 9, letterSpacing: 1 }}>
        {author || "اسم المؤلف"}
      </div>
    </div>
  );
}

function CoverThriller({ title, author }: { title: string; author: string }) {
  return (
    <div style={{
      width: "100%", height: "100%", position: "relative",
      background: "#0a0a0a",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      overflow: "hidden", fontFamily: "Arial Black, Arial, sans-serif",
    }}>
      {/* Red diagonal slash */}
      <div style={{
        position: "absolute", left: "-30%", top: "55%", width: "160%", height: 60,
        background: "linear-gradient(90deg, transparent, #c0001180, #c00011cc, #c0001180, transparent)",
        transform: "rotate(-12deg)", pointerEvents: "none",
      }} />
      {/* Thin red lines */}
      {[0,1,2].map(i => (
        <div key={i} style={{
          position: "absolute", left: 0, right: 0, height: 1,
          background: `#c0001140`,
          top: `${30 + i * 2}%`,
        }} />
      ))}
      {/* Brand */}
      <div style={{ position: "absolute", top: 20, left: 0, right: 0, textAlign: "center", fontSize: 7, letterSpacing: 4, color: "#c0001199", textTransform: "uppercase" }}>SOUQRATES SOUQ</div>
      {/* Title */}
      <div style={{ padding: "0 20px", textAlign: "center", zIndex: 2 }}>
        <div style={{ color: "#f0f0f0", fontSize: title.length > 20 ? 17 : title.length > 12 ? 21 : 27, fontWeight: 900, lineHeight: 1.2, textTransform: "uppercase", letterSpacing: 1 }}>
          {title || "عنوان الكتاب"}
        </div>
      </div>
      {/* Author */}
      <div style={{ position: "absolute", bottom: 20, left: 0, right: 0, textAlign: "center", color: "#c0001199", fontSize: 9, letterSpacing: 3, textTransform: "uppercase" }}>
        {author || "اسم المؤلف"}
      </div>
    </div>
  );
}

function CoverRomance({ title, author }: { title: string; author: string }) {
  return (
    <div style={{
      width: "100%", height: "100%", position: "relative",
      background: "linear-gradient(145deg, #2d1b4e 0%, #6b2d6b 40%, #c2185b 80%, #e91e8c 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      overflow: "hidden", fontFamily: "Georgia, serif",
    }}>
      {/* Floating circles */}
      {[
        { size:120, top:"5%",  left:"60%",  op:0.12 },
        { size: 80, top:"70%", left:"-10%", op:0.15 },
        { size: 60, top:"15%", left:"5%",   op:0.10 },
        { size:200, top:"40%", left:"30%",  op:0.07 },
      ].map((c, i) => (
        <div key={i} style={{
          position: "absolute", borderRadius: "50%",
          width: c.size, height: c.size, top: c.top, left: c.left,
          background: "#ffffff", opacity: c.op,
          pointerEvents: "none",
        }} />
      ))}
      {/* Thin top line */}
      <div style={{ position: "absolute", top: 32, left: 24, right: 24, height: 0.5, background: "#ffffff60" }} />
      <div style={{ position: "absolute", bottom: 48, left: 24, right: 24, height: 0.5, background: "#ffffff60" }} />
      {/* Brand */}
      <div style={{ position: "absolute", top: 16, left: 0, right: 0, textAlign: "center", fontSize: 7, letterSpacing: 3, color: "#ffffff80", textTransform: "uppercase" }}>SOUQRATES SOUQ</div>
      {/* Small heart */}
      <div style={{ marginBottom: 12, opacity: 0.8 }}><Heart size={18} fill="currentColor" /></div>
      {/* Title */}
      <div style={{ padding: "0 24px", textAlign: "center", zIndex: 1 }}>
        <div style={{ color: "#fff", fontSize: title.length > 20 ? 17 : title.length > 12 ? 21 : 26, fontWeight: 700, lineHeight: 1.4, fontStyle: "italic", textShadow: "0 2px 20px #00000040" }}>
          {title || "عنوان الكتاب"}
        </div>
      </div>
      {/* Author */}
      <div style={{ position: "absolute", bottom: 20, left: 0, right: 0, textAlign: "center", color: "#ffffffa0", fontSize: 9, letterSpacing: 2 }}>
        {author || "اسم المؤلف"}
      </div>
    </div>
  );
}

function CoverTech({ title, author }: { title: string; author: string }) {
  return (
    <div style={{
      width: "100%", height: "100%", position: "relative",
      background: "linear-gradient(170deg, #020c1b 0%, #0a1628 60%, #031020 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      overflow: "hidden", fontFamily: "Courier New, monospace",
    }}>
      {/* Grid lines */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.15 }} viewBox="0 0 280 420">
        {Array.from({ length: 14 }).map((_, i) => <line key={`h${i}`} x1="0" y1={i * 30} x2="280" y2={i * 30} stroke="#00d4ff" strokeWidth="0.5" />)}
        {Array.from({ length: 10 }).map((_, i) => <line key={`v${i}`} x1={i * 31} y1="0" x2={i * 31} y2="420" stroke="#00d4ff" strokeWidth="0.5" />)}
      </svg>
      {/* Corner brackets */}
      {([["0","0",1,1],["auto","0",-1,1],["0","auto",1,-1],["auto","auto",-1,-1]] as [string,string,number,number][]).map(([t,b,sx,sy], i) => (
        <svg key={i} width={28} height={28} style={{ position:"absolute", top:t!=="auto"?12:"auto", bottom:b!=="auto"?12:"auto", left:sx>0?12:"auto", right:sx<0?12:"auto", transform:`scaleX(${sx}) scaleY(${sy})` }} viewBox="0 0 28 28">
          <polyline points="0,14 0,0 14,0" stroke="#00d4ff" strokeWidth="1.5" fill="none"/>
        </svg>
      ))}
      {/* Cyan glow circle */}
      <div style={{ position: "absolute", width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, #00d4ff18 0%, transparent 70%)", top: "20%", left: "50%", transform: "translateX(-50%)" }} />
      {/* Brand */}
      <div style={{ position: "absolute", top: 18, left: 0, right: 0, textAlign: "center", fontSize: 7, letterSpacing: 4, color: "#00d4ff80", textTransform: "uppercase" }}>SOUQRATES SOUQ</div>
      {/* Title */}
      <div style={{ padding: "0 20px", textAlign: "center", zIndex: 1 }}>
        <div style={{ color: "#e0f7ff", fontSize: title.length > 20 ? 16 : title.length > 12 ? 20 : 24, fontWeight: 700, lineHeight: 1.3, textShadow: "0 0 20px #00d4ff60" }}>
          {title || "عنوان الكتاب"}
        </div>
      </div>
      {/* Status bar */}
      <div style={{ position: "absolute", bottom: 18, left: 16, right: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#00d4ff40", fontSize: 7, fontFamily: "monospace" }}>v1.0.0</span>
        <span style={{ color: "#00d4ff80", fontSize: 8 }}>{author || "اسم المؤلف"}</span>
        <span style={{ color: "#00d4ff40", fontSize: 7, fontFamily: "monospace" }}>©2025</span>
      </div>
    </div>
  );
}

function CoverSpiritual({ title, author }: { title: string; author: string }) {
  return (
    <div style={{
      width: "100%", height: "100%", position: "relative",
      background: "linear-gradient(160deg, #0a3320 0%, #145a32 50%, #0d4a28 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      overflow: "hidden", fontFamily: "Georgia, serif",
    }}>
      {/* Islamic geometric star */}
      <svg style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", opacity: 0.12 }} width={220} height={220} viewBox="0 0 100 100">
        <polygon points="50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35" fill="#d4af37" />
        <polygon points="50,15 58,38 83,38 63,53 71,78 50,63 29,78 37,53 17,38 42,38" fill="none" stroke="#d4af37" strokeWidth="0.5" />
      </svg>
      {/* Thin gold borders */}
      <div style={{ position: "absolute", inset: 14, border: "1px solid #d4af3740", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 18, border: "0.5px solid #d4af3720", pointerEvents: "none" }} />
      {/* Top/bottom gold rules */}
      <div style={{ position: "absolute", top: 42, left: 22, right: 22, height: 1, background: "linear-gradient(90deg,transparent,#d4af37,transparent)" }} />
      <div style={{ position: "absolute", bottom: 48, left: 22, right: 22, height: 1, background: "linear-gradient(90deg,transparent,#d4af37,transparent)" }} />
      {/* Bismillah motif */}
      <div style={{ position: "absolute", top: 22, left: 0, right: 0, textAlign: "center", fontSize: 8, color: "#d4af3799", letterSpacing: 2 }}>﷽</div>
      {/* Title */}
      <div style={{ padding: "0 26px", textAlign: "center", zIndex: 1 }}>
        <div style={{ color: "#e8d5a0", fontSize: title.length > 20 ? 17 : title.length > 12 ? 21 : 26, fontWeight: 700, lineHeight: 1.4, textShadow: "0 2px 16px #00000060" }}>
          {title || "عنوان الكتاب"}
        </div>
      </div>
      {/* Author */}
      <div style={{ position: "absolute", bottom: 20, left: 0, right: 0, textAlign: "center", color: "#d4af3780", fontSize: 9, letterSpacing: 2 }}>
        {author || "اسم المؤلف"}
      </div>
    </div>
  );
}

function CoverBusiness({ title, author }: { title: string; author: string }) {
  return (
    <div style={{
      width: "100%", height: "100%", position: "relative",
      background: "linear-gradient(180deg, #1c2130 0%, #252d3d 100%)",
      display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center",
      overflow: "hidden", fontFamily: "Arial, sans-serif",
    }}>
      {/* Gold accent top bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, background: "linear-gradient(90deg, #d4af37, #f0c040, #d4af37)" }} />
      {/* Gold accent bottom bar */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "#d4af3750" }} />
      {/* Vertical gold line left */}
      <div style={{ position: "absolute", left: 20, top: 5, bottom: 3, width: 1, background: "linear-gradient(180deg,#d4af37,#d4af3730)" }} />
      {/* Chart bars decoration */}
      <svg style={{ position: "absolute", bottom: 55, left: 24, opacity: 0.15 }} width={60} height={40} viewBox="0 0 60 40">
        {[8,18,12,28,22,35,30].map((h, i) => (
          <rect key={i} x={i*8} y={40-h} width={5} height={h} fill="#d4af37" />
        ))}
      </svg>
      {/* Brand */}
      <div style={{ position: "absolute", top: 16, left: 28, fontSize: 7, letterSpacing: 3, color: "#d4af3799", textTransform: "uppercase" }}>SOUQRATES SOUQ</div>
      {/* Title */}
      <div style={{ padding: "0 24px 0 28px", textAlign: "right", zIndex: 1, width: "100%", boxSizing: "border-box" }}>
        <div style={{ color: "#ffffff", fontSize: title.length > 20 ? 17 : title.length > 12 ? 21 : 26, fontWeight: 800, lineHeight: 1.25 }}>
          {title || "عنوان الكتاب"}
        </div>
        <div style={{ marginTop: 8, width: 40, height: 2, background: "#d4af37", marginRight: 0, marginLeft: "auto" }} />
      </div>
      {/* Author */}
      <div style={{ position: "absolute", bottom: 18, right: 24, color: "#d4af3799", fontSize: 9, letterSpacing: 1 }}>
        {author || "اسم المؤلف"}
      </div>
    </div>
  );
}

function CoverCosmic({ title, author }: { title: string; author: string }) {
  return (
    <div style={{
      width: "100%", height: "100%", position: "relative",
      background: "radial-gradient(ellipse at 50% 30%, #1a0535 0%, #0d0020 40%, #000008 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      overflow: "hidden", fontFamily: "Georgia, serif",
    }}>
      {/* Stars */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox="0 0 280 420">
        {Array.from({ length: 60 }).map((_, i) => {
          const x = ((i * 137.5) % 280);
          const y = ((i * 97.3) % 420);
          const r = i % 5 === 0 ? 1.2 : 0.6;
          const op = 0.4 + (i % 4) * 0.15;
          return <circle key={i} cx={x} cy={y} r={r} fill="white" opacity={op} />;
        })}
      </svg>
      {/* Nebula glow */}
      <div style={{ position: "absolute", width: 180, height: 100, borderRadius: "50%", background: "radial-gradient(ellipse, #7b2fff20 0%, transparent 70%)", top: "30%", left: "50%", transform: "translateX(-50%)" }} />
      {/* Planet */}
      <div style={{ position: "absolute", top: "12%", right: "18%", width: 28, height: 28, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, #9966ff, #2d0066)", boxShadow: "0 0 16px #9966ff50" }} />
      {/* Ring around planet */}
      <svg style={{ position: "absolute", top: "calc(12% + 8px)", right: "calc(18% - 10px)", opacity: 0.5 }} width={48} height={14} viewBox="0 0 48 14">
        <ellipse cx="24" cy="7" rx="22" ry="5" fill="none" stroke="#9966ff" strokeWidth="1.5"/>
      </svg>
      {/* Brand */}
      <div style={{ position: "absolute", top: 18, left: 0, right: 0, textAlign: "center", fontSize: 7, letterSpacing: 4, color: "#ffffff50", textTransform: "uppercase" }}>SOUQRATES SOUQ</div>
      {/* Title */}
      <div style={{ padding: "0 22px", textAlign: "center", zIndex: 1 }}>
        <div style={{ color: "#e8d8ff", fontSize: title.length > 20 ? 17 : title.length > 12 ? 21 : 26, fontWeight: 700, lineHeight: 1.35, textShadow: "0 0 30px #7b2fff80" }}>
          {title || "عنوان الكتاب"}
        </div>
      </div>
      {/* Author */}
      <div style={{ position: "absolute", bottom: 20, left: 0, right: 0, textAlign: "center", color: "#9966ff80", fontSize: 9, letterSpacing: 2 }}>
        {author || "اسم المؤلف"}
      </div>
    </div>
  );
}

function CoverHeritage({ title, author }: { title: string; author: string }) {
  return (
    <div style={{
      width: "100%", height: "100%", position: "relative",
      background: "linear-gradient(160deg, #3d2b1f 0%, #5c3d2a 50%, #2e1f14 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      overflow: "hidden", fontFamily: "Georgia, serif",
    }}>
      {/* Aged texture overlay */}
      <div style={{ position: "absolute", inset: 0, background: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E\")", opacity: 0.5 }} />
      {/* Ornamental outer border */}
      <div style={{ position: "absolute", inset: 10, border: "2px solid #c4985040", borderRadius: 2, pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 14, border: "1px solid #c4985025", pointerEvents: "none" }} />
      {/* Corner floral ornaments */}
      {[[-1,-1],[1,-1],[-1,1],[1,1]].map(([sx,sy], i) => (
        <svg key={i} width={26} height={26} style={{
          position: "absolute",
          top: sy < 0 ? 6 : "auto", bottom: sy > 0 ? 6 : "auto",
          left: sx < 0 ? 6 : "auto", right: sx > 0 ? 6 : "auto",
          transform: `scaleX(${sx}) scaleY(${sy})`,
          opacity: 0.7,
        }} viewBox="0 0 26 26">
          <path d="M2 2 Q2 13 13 13 Q2 13 2 24" stroke="#c49850" strokeWidth="1" fill="none"/>
          <circle cx="2" cy="2" r="2" fill="#c49850" opacity="0.8"/>
        </svg>
      ))}
      {/* Top/bottom scroll dividers */}
      <div style={{ position: "absolute", top: 44, left: 24, right: 24, textAlign: "center", color: "#c4985070", fontSize: 11 }}>— ✦ —</div>
      <div style={{ position: "absolute", bottom: 44, left: 24, right: 24, textAlign: "center", color: "#c4985070", fontSize: 11 }}>— ✦ —</div>
      {/* Brand */}
      <div style={{ position: "absolute", top: 20, left: 0, right: 0, textAlign: "center", fontSize: 7, letterSpacing: 3, color: "#c4985080", textTransform: "uppercase" }}>SOUQRATES SOUQ</div>
      {/* Title */}
      <div style={{ padding: "0 28px", textAlign: "center", zIndex: 1 }}>
        <div style={{ color: "#e8d0a0", fontSize: title.length > 20 ? 17 : title.length > 12 ? 21 : 26, fontWeight: 700, lineHeight: 1.4, textShadow: "0 2px 8px #00000060" }}>
          {title || "عنوان الكتاب"}
        </div>
      </div>
      {/* Author */}
      <div style={{ position: "absolute", bottom: 20, left: 0, right: 0, textAlign: "center", color: "#c4985080", fontSize: 9, letterSpacing: 2 }}>
        {author || "اسم المؤلف"}
      </div>
    </div>
  );
}

function CoverEnergy({ title, author }: { title: string; author: string }) {
  return (
    <div style={{
      width: "100%", height: "100%", position: "relative",
      background: "linear-gradient(140deg, #ff6b00 0%, #ff8f00 30%, #ffc107 70%, #ff6b00 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      overflow: "hidden", fontFamily: "Arial Black, Arial, sans-serif",
    }}>
      {/* Sunburst rays */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.2 }} viewBox="0 0 280 420">
        {Array.from({ length: 18 }).map((_, i) => {
          const angle = (i * 20) * Math.PI / 180;
          const x2 = 140 + Math.cos(angle) * 300;
          const y2 = 210 + Math.sin(angle) * 300;
          return <line key={i} x1="140" y1="210" x2={x2} y2={y2} stroke="#fff" strokeWidth="2" />;
        })}
      </svg>
      {/* White diagonal band */}
      <div style={{
        position: "absolute", left: "-20%", top: "62%", width: "140%", height: 55,
        background: "#ffffff22", transform: "rotate(-8deg)", pointerEvents: "none",
      }} />
      {/* Brand */}
      <div style={{ position: "absolute", top: 18, left: 0, right: 0, textAlign: "center", fontSize: 7, letterSpacing: 4, color: "#00000050", textTransform: "uppercase" }}>SOUQRATES SOUQ</div>
      {/* Exclamation/energy mark */}
      <div style={{ color: "#ffffff40", marginBottom: 8 }}><Star size={28} fill="currentColor" /></div>
      {/* Title */}
      <div style={{ padding: "0 20px", textAlign: "center", zIndex: 1 }}>
        <div style={{ color: "#1a0000", fontSize: title.length > 20 ? 18 : title.length > 12 ? 22 : 28, fontWeight: 900, lineHeight: 1.15, textTransform: "uppercase", letterSpacing: 1, textShadow: "0 2px 0 #ffffff40" }}>
          {title || "عنوان الكتاب"}
        </div>
      </div>
      {/* Author */}
      <div style={{ position: "absolute", bottom: 18, left: 0, right: 0, textAlign: "center", color: "#1a000080", fontSize: 9, fontWeight: 700, letterSpacing: 2 }}>
        {author || "اسم المؤلف"}
      </div>
    </div>
  );
}

const COVER_RENDERERS: Record<string, React.FC<{ title: string; author: string }>> = {
  classic:   CoverClassic,
  minimal:   CoverMinimal,
  thriller:  CoverThriller,
  romance:   CoverRomance,
  tech:      CoverTech,
  spiritual: CoverSpiritual,
  business:  CoverBusiness,
  cosmic:    CoverCosmic,
  heritage:  CoverHeritage,
  energy:    CoverEnergy,
};

/* ─── Main picker component ──────────────────────────────────────────────── */

export function BookCoverPicker() {
  const [title, setTitle]   = useState("");
  const [author, setAuthor] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const previewRefs = useRef<Record<string, HTMLDivElement | null>>({});

  async function download(styleId: string) {
    const el = previewRefs.current[styleId];
    if (!el) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(el, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: null,
        width: el.offsetWidth,
        height: el.offsetHeight,
      });
      const link = document.createElement("a");
      link.download = `غلاف-${(title || "كتاب").replace(/\s+/g, "-")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div dir="rtl" className="space-y-5">
      {/* Inputs */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
        <p className="text-sm font-semibold text-slate-700">أدخل بيانات الكتاب لمعاينة الأغلفة في الحال:</p>
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-slate-500 block mb-1">عنوان الكتاب *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: رحلة إلى الداخل"
              className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
              maxLength={60}
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs text-slate-500 block mb-1">اسم المؤلف <span className="text-slate-400">(اختياري)</span></label>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="مثال: محمد أحمد"
              className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
              maxLength={40}
            />
          </div>
        </div>
      </div>

      {/* Covers grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {COVER_STYLES.map((style) => {
          const Renderer = COVER_RENDERERS[style.id];
          const isSelected = selected === style.id;
          return (
            <div key={style.id} className="space-y-2">
              {/* Cover preview */}
              <div
                onClick={() => setSelected(isSelected ? null : style.id)}
                className={`relative cursor-pointer rounded-lg overflow-hidden shadow-md transition-all duration-200 ${
                  isSelected
                    ? "ring-2 ring-teal-500 ring-offset-2 shadow-xl scale-105"
                    : "hover:shadow-lg hover:scale-[1.02]"
                }`}
                style={{ aspectRatio: "2/3" }}
              >
                <div
                  ref={(el) => { previewRefs.current[style.id] = el; }}
                  style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
                >
                  <Renderer title={title} author={author} />
                </div>
                {isSelected && (
                  <div className="absolute inset-0 flex items-center justify-center bg-teal-500/10">
                    <div className="bg-teal-500 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg"><Check size={16} /></div>
                  </div>
                )}
              </div>
              {/* Label */}
              <div className="text-center">
                <div className="text-xs font-semibold text-slate-700">{style.label}</div>
                <div className="text-[10px] text-slate-400">{style.genre}</div>
              </div>
              {/* Download button */}
              {isSelected && (
                <button
                  onClick={() => download(style.id)}
                  disabled={downloading || !title.trim()}
                  className="w-full py-1.5 rounded-md bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {downloading ? "جاري التحميل…" : <><Download size={12} className="inline mr-1" />تحميل PNG</>}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Instructions */}
      <div className="text-xs text-slate-400 text-center pb-2">
        اضغط على أي غلاف لتحديده • اكتب العنوان أولاً قبل التحميل • الصورة بجودة عالية (3×)
      </div>
    </div>
  );
}

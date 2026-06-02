import { Link, useLocation } from "wouter";
import {
  Shield, BarChart2, Users, ArrowLeftRight, CreditCard, ScrollText,
  Settings, LayoutGrid, Wallet, BookOpen, Trophy, Ticket,
  Megaphone, Link2, Plug, Activity, AlertTriangle, Star,
  Diamond, Triangle, Play, Radio, Crown, Hexagon, LineChart, Percent,
} from "lucide-react";
import { BOTS } from "@/lib/bots-meta";
import { clearToken } from "@/lib/api";

const SIDEBAR_BOT_ICON: Record<string, React.ReactNode> = {
  "mother-bot":    <Diamond size={16} />,
  "games-bot":     <Triangle size={16} />,
  "books-bot":     <BookOpen size={16} />,
  "video-bot":     <Play size={16} />,
  "voice-bot":     <Radio size={16} />,
  "subagents-bot": <Crown size={16} />,
  "contests-bot":  <Star size={16} />,
  "scratchy-bot":  <Hexagon size={16} />,
};

export default function Sidebar() {
  const [location, navigate] = useLocation();

  function logout() {
    clearToken();
    navigate("/login");
  }

  return (
    <aside className="w-64 shrink-0 bg-slate-900 text-slate-100 flex flex-col border-l border-slate-800" dir="rtl">
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-indigo-400 shrink-0" />
          <div>
            <div className="font-bold text-white leading-tight">SUPER ADMIN</div>
            <div className="text-xs text-slate-400">لوحة المدير المركزية</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {/* SOUQRATES SYSTEM */}
        <div className="px-3 mb-2 text-[11px] font-bold tracking-wider text-indigo-300">
          SOUQRATES SYSTEM
          <div className="text-[10px] font-normal text-slate-500 normal-case">المركز المالي للمنصة</div>
        </div>
        <SidebarLink href="/" active={location === "/"} icon={<BarChart2 size={16} />} label="نظرة عامة" />
        <SidebarLink href="/users" active={location.startsWith("/users")} icon={<Users size={16} />} label="المستخدمون" />
        <SidebarLink href="/transactions" active={location.startsWith("/transactions")} icon={<ArrowLeftRight size={16} />} label="سجل المعاملات" />
        <SidebarLink href="/reports" active={location.startsWith("/reports")} icon={<LineChart size={16} />} label="التقارير المالية" sub="إيرادات، إيداعات، نمو" />
        <SidebarLink href="/commissions" active={location.startsWith("/commissions")} icon={<Percent size={16} />} label="تحليلات العمولات" sub="ملخص + جدول مفصّل" />
        <SidebarLink href="/withdrawals" active={location.startsWith("/withdrawals")} icon={<CreditCard size={16} />} label="طلبات السحب" />
        <SidebarLink href="/agreements" active={location.startsWith("/agreements")} icon={<ScrollText size={16} />} label="الاتفاقيات" sub="النص + الموقّعون" />
        <SidebarLink
          href="/bots/mother-bot"
          active={location === "/bots/mother-bot"}
          icon={<Settings size={16} />}
          label="إعدادات النظام"
          sub="عمولات، أسعار، فئات الدخول"
        />

        {/* SOUQRATES SKILLZ */}
        <div className="px-3 mt-5 mb-2 text-[11px] font-bold tracking-wider text-orange-300">
          SOUQRATES SKILLZ
          <div className="text-[10px] font-normal text-slate-500 normal-case">إدارة 110 لعبة + الاقتصاد</div>
        </div>
        <SidebarLink
          href="/games"
          active={location.startsWith("/games") && !location.startsWith("/games-bot")}
          icon={<LayoutGrid size={16} />}
          label="قائمة الألعاب"
          sub="الأسعار، المدة، السكور، النصوص"
        />
        <SidebarLink
          href="/bots/games-bot"
          active={location === "/bots/games-bot"}
          icon={<Wallet size={16} />}
          label="اقتصاد بوت الألعاب"
          sub="عمولة، إعدادات عامة"
        />

        {/* SOUQRATES SOUQ */}
        <div className="px-3 mt-5 mb-2 text-[11px] font-bold tracking-wider" style={{ color: "#0F766E" }}>
          SOUQRATES SOUQ
          <div className="text-[10px] font-normal text-slate-500 normal-case">الكتب والمنتجات الرقمية</div>
        </div>
        <SidebarLink
          href="/books"
          active={location.startsWith("/books") && !location.startsWith("/books-bot")}
          icon={<BookOpen size={16} />}
          label="الكتب"
          sub="مراجعة، تصنيفات، إحصاءات"
        />
        <SidebarLink
          href="/bots/books-bot"
          active={location === "/bots/books-bot"}
          icon={<Wallet size={16} />}
          label="اقتصاد بوت الكتب"
          sub="عمولة، إعدادات عامة"
        />

        {/* SOUQRATES STAGE */}
        <div className="px-3 mt-5 mb-2 text-[11px] font-bold tracking-wider" style={{ color: "#eab308" }}>
          SOUQRATES STAGE
          <div className="text-[10px] font-normal text-slate-500 normal-case">المسابقات والتصويت</div>
        </div>
        <SidebarLink
          href="/contests"
          active={location.startsWith("/contests")}
          icon={<Trophy size={16} />}
          label="المسابقات"
          sub="إنشاء، تفعيل، متسابقون، تدقيق"
        />
        <SidebarLink
          href="/vote-packs"
          active={location.startsWith("/vote-packs")}
          icon={<Ticket size={16} />}
          label="باقات التصويت"
          sub="أسعار + مكافآت حُزم"
        />
        <SidebarLink
          href="/bots/contests-bot"
          active={location === "/bots/contests-bot"}
          icon={<Wallet size={16} />}
          label="اقتصاد بوت المسابقات"
          sub="عمولة، إعدادات عامة"
        />

        {/* SOUQRATES SUB-AGENTS */}
        <div className="px-3 mt-5 mb-2 text-[11px] font-bold tracking-wider" style={{ color: "#D4AF37" }}>
          SOUQRATES SUB-AGENTS
          <div className="text-[10px] font-normal text-slate-500 normal-case">برنامج الشركاء والموزّعين</div>
        </div>
        <SidebarLink
          href="/subagents"
          active={location.startsWith("/subagents") && location !== "/subagents/tiers"}
          icon={<Star size={16} />}
          label="طلبات وشركاء"
          sub="موافقة، رفض، تعليق، KYC"
          color="#D4AF37"
        />
        <SidebarLink
          href="/subagents/tiers"
          active={location === "/subagents/tiers"}
          icon={<Trophy size={16} />}
          label="مراتب الشركاء"
          sub="7 مراتب + نسب الخصومات"
          color="#D4AF37"
        />
        <SidebarLink
          href="/bots/subagents-bot"
          active={location === "/bots/subagents-bot"}
          icon={<Wallet size={16} />}
          label="اقتصاد بوت الشركاء"
          sub="عمولة، إعدادات عامة"
          color="#D4AF37"
        />

        {/* أدوات عامة */}
        <div className="px-3 mt-5 mb-2 text-[11px] uppercase tracking-wider text-slate-500">أدوات</div>
        <SidebarLink href="/scratch-cards" active={location.startsWith("/scratch-cards")} icon={<Hexagon size={16} />} label="بطاقات الحك واربح" sub="كتالوج البطاقات وإعداداتها" />
        <SidebarLink href="/broadcast" active={location.startsWith("/broadcast")} icon={<Megaphone size={16} />} label="إشعار جماعي" />
        <SidebarLink href="/links" active={location.startsWith("/links")} icon={<Link2 size={16} />} label="الروابط/CDN" />
        <SidebarLink href="/integrations" active={location.startsWith("/integrations")} icon={<Plug size={16} />} label="التكاملات الخارجية" sub="Redis, Sentry, Resend…" />
        <SidebarLink href="/bots" active={location === "/bots"} icon={<LayoutGrid size={16} />} label="البوتات" sub="قائمة كل البوتات وروابطها" />
        <SidebarLink href="/health" active={location.startsWith("/health") || location.startsWith("/system-health")} icon={<Activity size={16} />} label="صحة النظام" sub="DB، الخادم، الخدمات الخارجية" />
        <SidebarLink href="/audit-log" active={location.startsWith("/audit-log")} icon={<ScrollText size={16} />} label="سجل تدقيق المدير" sub="من فعل ماذا ومتى" />
        <SidebarLink href="/error-logs" active={location.startsWith("/error-logs")} icon={<AlertTriangle size={16} />} label="سجل الأخطاء" />

        {/* البوتات الفرعية الأخرى */}
        <div className="px-3 mt-5 mb-2 text-[11px] uppercase tracking-wider text-slate-500">بوتات أخرى</div>
        {BOTS.filter((b) => !["mother-bot", "games-bot", "books-bot", "contests-bot", "subagents-bot"].includes(b.slug)).map((b) => {
          const href = `/bots/${b.slug}`;
          return (
            <SidebarLink
              key={b.slug}
              href={href}
              active={location === href}
              icon={SIDEBAR_BOT_ICON[b.slug] ?? <Diamond size={16} />}
              label={b.brand}
              sub={b.arName}
              color={b.color}
            />
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-3">
        <button
          onClick={logout}
          className="w-full text-sm py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
        >
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}

function SidebarLink({
  href,
  active,
  icon,
  label,
  sub,
  color,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  sub?: string;
  color?: string;
}) {
  return (
    <Link href={href}>
      <a
        className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg transition text-right ${
          active ? "bg-indigo-600/90 text-white" : "hover:bg-slate-800 text-slate-200"
        }`}
      >
        <span className="shrink-0 flex items-center justify-center w-5 h-5" style={color ? { color } : undefined}>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{label}</div>
          {sub && <div className="text-[11px] text-slate-400 truncate">{sub}</div>}
        </div>
      </a>
    </Link>
  );
}

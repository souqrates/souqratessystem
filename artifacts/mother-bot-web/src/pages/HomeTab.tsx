import { useQuery } from "@tanstack/react-query";
import { getMe } from "@/lib/api";
import { fmtSkz, fmtInt } from "@/lib/format";
import Avatar from "@/components/Avatar";
import XpBar from "@/components/XpBar";

type Tab = "home" | "profile" | "leaderboard" | "policies" | "contact";

export default function HomeTab({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-32" />
        <div className="skeleton h-24" />
        <div className="skeleton h-40" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="panel p-6 text-center">
        <div className="text-rose font-bold mb-2">تعذّر تحميل البيانات</div>
        <div className="text-sm text-mute">{(error as Error)?.message ?? ""}</div>
        <div className="text-xs text-mute mt-3">
          افتح هذه الصفحة من خلال البوت الأم على Telegram.
        </div>
      </div>
    );
  }

  const { profile, wallet, rank } = data;
  const displayName = profile.displayName || profile.firstName;

  return (
    <div className="space-y-4">
      {/* Greeting */}
      <div className="panel-gold p-5 flex items-center gap-4">
        <Avatar
          src={profile.avatarUrl ? `${profile.avatarUrl}` : null}
          name={displayName}
          size={64}
          ring
        />
        <div className="flex-1 min-w-0">
          <div className="text-mute text-sm">أهلاً بك في</div>
          <div className="text-xl font-black text-glow-gold truncate">SOUQRATES SYSTEM</div>
          <div className="text-fg font-bold mt-0.5 truncate">{displayName}</div>
        </div>
      </div>

      {/* Wallet card */}
      <div className="panel p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-mute text-sm font-bold">💰 المحفظة الموحّدة</div>
          <span className="chip">SKZ</span>
        </div>
        <div className="text-4xl font-black text-glow-gold mb-3">
          {fmtSkz(wallet.balanceSkz)}{" "}
          <span className="text-base text-gold-dim font-bold">SKZ</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-panel-2 rounded-xl p-2 border border-line">
            <div className="text-[10px] text-mute mb-1">USDT</div>
            <div className="font-bold">{fmtSkz(wallet.balanceUsdt)}</div>
          </div>
          <div className="bg-panel-2 rounded-xl p-2 border border-line">
            <div className="text-[10px] text-mute mb-1">⭐ Stars</div>
            <div className="font-bold">{fmtInt(wallet.balanceStars)}</div>
          </div>
          <div className="bg-panel-2 rounded-xl p-2 border border-line">
            <div className="text-[10px] text-mute mb-1">TON</div>
            <div className="font-bold">{fmtSkz(wallet.balanceTon)}</div>
          </div>
        </div>
      </div>

      {/* XP / Rank */}
      <XpBar
        xp={profile.xp}
        currentMinXp={rank.currentMinXp}
        nextMinXp={rank.nextMinXp}
        level={profile.level}
        title={rank.rankTitle}
        color={rank.rankColor}
        icon={rank.rankIcon}
      />

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => onNavigate("profile")} className="panel p-4 text-start hover:border-gold/40 transition-colors">
          <div className="text-2xl mb-1">👤</div>
          <div className="font-bold">ملفي الشخصي</div>
          <div className="text-xs text-mute mt-1">عدّل اسمك وصورتك</div>
        </button>
        <button onClick={() => onNavigate("leaderboard")} className="panel p-4 text-start hover:border-gold/40 transition-colors">
          <div className="text-2xl mb-1">🏆</div>
          <div className="font-bold">المتصدّرون</div>
          <div className="text-xs text-mute mt-1">ترتيب المنظومة كاملةً</div>
        </button>
        <button onClick={() => onNavigate("policies")} className="panel p-4 text-start hover:border-gold/40 transition-colors">
          <div className="text-2xl mb-1">📄</div>
          <div className="font-bold">السياسات</div>
          <div className="text-xs text-mute mt-1">الشروط والأحكام</div>
        </button>
        <button onClick={() => onNavigate("contact")} className="panel p-4 text-start hover:border-gold/40 transition-colors">
          <div className="text-2xl mb-1">💬</div>
          <div className="font-bold">تواصل معنا</div>
          <div className="text-xs text-mute mt-1">قنوات سوقراطس الرسمية</div>
        </button>
      </div>
    </div>
  );
}

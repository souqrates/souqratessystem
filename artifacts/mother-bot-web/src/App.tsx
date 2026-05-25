import { useEffect, useState } from "react";
import { initTelegram, haptic } from "@/lib/telegram";
import HomeTab from "@/pages/HomeTab";
import ProfileTab from "@/pages/ProfileTab";
import LeaderboardTab from "@/pages/LeaderboardTab";
import PoliciesTab from "@/pages/PoliciesTab";
import ContactTab from "@/pages/ContactTab";

type Tab = "home" | "profile" | "leaderboard" | "policies" | "contact";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "home", label: "الرئيسية", icon: "🏠" },
  { id: "profile", label: "ملفي", icon: "👤" },
  { id: "leaderboard", label: "المتصدّرون", icon: "🏆" },
  { id: "policies", label: "السياسات", icon: "📄" },
  { id: "contact", label: "تواصل", icon: "💬" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("home");

  useEffect(() => {
    initTelegram();
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="safe-top sticky top-0 z-30 backdrop-blur-xl bg-bg/80 border-b border-line">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold to-amber-700 grid place-items-center text-black font-black text-lg shadow-lg">
              ♚
            </div>
            <div className="leading-tight">
              <div className="text-base font-extrabold tracking-wide text-glow-gold">
                SOUQRATES SYSTEM
              </div>
              <div className="text-[11px] text-mute">البوت الأم — المحفظة الموحّدة</div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 pb-28 pt-4">
        {tab === "home" && <HomeTab onNavigate={setTab} />}
        {tab === "profile" && <ProfileTab />}
        {tab === "leaderboard" && <LeaderboardTab />}
        {tab === "policies" && <PoliciesTab />}
        {tab === "contact" && <ContactTab />}
      </main>

      <nav className="safe-bottom fixed bottom-0 inset-x-0 z-40 bg-bg/95 backdrop-blur-xl border-t border-line">
        <div className="max-w-2xl mx-auto grid grid-cols-5">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  haptic("tap");
                  setTab(t.id);
                }}
                className={`flex flex-col items-center gap-1 py-2.5 transition-colors ${
                  active ? "text-gold" : "text-mute hover:text-fg"
                }`}
              >
                <span className="text-lg leading-none">{t.icon}</span>
                <span className="text-[11px] font-bold">{t.label}</span>
                {active && <span className="w-6 h-0.5 rounded-full bg-gold" />}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

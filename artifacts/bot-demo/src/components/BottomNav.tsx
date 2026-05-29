import { Page } from "../App";

interface Props {
  current: Page;
  onChange: (p: Page) => void;
}

const tabs: { id: Page; emoji: string; label: string }[] = [
  { id: "home", emoji: "🏠", label: "الرئيسية" },
  { id: "games", emoji: "🎰", label: "الألعاب" },
  { id: "lotto", emoji: "🎱", label: "اللوتو" },
  { id: "tickets", emoji: "🎫", label: "تذاكري" },
];

export default function BottomNav({ current, onChange }: Props) {
  return (
    <nav className="bottom-nav flex items-center justify-around px-2">
      {tabs.map((tab) => {
        const active = current === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl transition-all duration-200"
            style={{
              background: active ? "rgba(245,158,11,0.12)" : "transparent",
              border: "none",
              cursor: "pointer",
              minWidth: 56,
            }}
          >
            <span className="text-2xl leading-none" style={{
              filter: active ? "drop-shadow(0 0 6px rgba(245,158,11,0.8))" : "none",
              transform: active ? "scale(1.15)" : "scale(1)",
              transition: "all 0.2s ease",
            }}>
              {tab.emoji}
            </span>
            <span className="text-xs font-bold" style={{
              color: active ? "#f59e0b" : "rgba(255,255,255,0.4)",
              fontSize: 10,
            }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

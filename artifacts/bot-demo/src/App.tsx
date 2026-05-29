import { useState, useEffect } from "react";
import BottomNav from "./components/BottomNav";
import Home from "./pages/Home";
import Games from "./pages/Games";
import Lotto from "./pages/Lotto";
import MyTickets from "./pages/MyTickets";
import ScratchCard from "./pages/ScratchCard";
import DrawHistory from "./pages/DrawHistory";
import { GameConfig } from "./lib/games";
import { tg } from "./lib/telegram";

export type Page = "home" | "games" | "lotto" | "tickets" | "history";

type AuthState = "checking" | "ok" | "error";

function TelegramGate({ onReady }: { onReady: (initData: string) => void }) {
  const [state, setState] = useState<AuthState>("checking");

  useEffect(() => {
    const wa = tg();
    if (wa) {
      try { wa.ready(); } catch (_) {}
      try { wa.expand(); } catch (_) {}
    }

    // Give SDK a tick to initialize
    const id = setTimeout(() => {
      const webapp = tg();
      const initData = webapp?.initData ?? "";
      if (initData) {
        onReady(initData);
        setState("ok");
      } else {
        // In development/browser preview allow through with empty initData
        const isDev = import.meta.env.DEV || !navigator.userAgent.includes("Telegram");
        if (isDev) {
          onReady("");
          setState("ok");
        } else {
          setState("error");
        }
      }
    }, 150);

    return () => clearTimeout(id);
  }, [onReady]);

  if (state === "checking") {
    return (
      <div className="app-shell flex items-center justify-center flex-col gap-4"
        style={{ background: "#070511" }}>
        <div className="trophy-float text-6xl">🏆</div>
        <div className="font-orbitron font-black text-xl gradient-text-gold">SOUQRATES SWEEP</div>
        <div className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>جاري التحقق…</div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="app-shell flex items-center justify-center flex-col gap-4 px-6 text-center"
        style={{ background: "#070511" }}>
        <div className="text-5xl">🔒</div>
        <div className="font-bold text-lg text-white">يجب فتح التطبيق من داخل تيليغرام</div>
        <div className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
          افتح بوت SOUQRATES SWEEP في تيليغرام ثم اضغط على زر التشغيل
        </div>
        <div className="rounded-2xl px-4 py-3 mt-2 text-xs"
          style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)", color: "rgba(245,158,11,0.7)" }}>
          ⚠️ لا يمكن الوصول مباشرة من المتصفح
        </div>
      </div>
    );
  }

  return null;
}

function SweepApp({ initData }: { initData: string }) {
  const [page, setPage] = useState<Page>("home");
  const [selectedGame, setSelectedGame] = useState<GameConfig | null>(null);

  function openGame(game: GameConfig) {
    setSelectedGame(game);
  }

  function closeGame() {
    setSelectedGame(null);
  }

  if (selectedGame) {
    return (
      <div className="app-shell">
        <ScratchCard game={selectedGame} initData={initData} onClose={closeGame} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="page-scroll">
        {page === "home" && <Home onNavigate={setPage} />}
        {page === "games" && <Games onSelectGame={openGame} />}
        {page === "lotto" && <Lotto initData={initData} />}
        {page === "tickets" && <MyTickets initData={initData} onSelectGame={openGame} />}
        {page === "history" && <DrawHistory initData={initData} />}
      </div>
      <BottomNav current={page} onChange={setPage} />
    </div>
  );
}

export default function App() {
  const [initData, setInitData] = useState<string | null>(null);

  if (initData === null) {
    return <TelegramGate onReady={setInitData} />;
  }

  return <SweepApp initData={initData} />;
}

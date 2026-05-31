import { createRoot } from "react-dom/client";
import { useState } from "react";
import App from "./App";
import { SplashScreen } from "./components/SplashScreen";
import "./index.css";

// Dismiss Telegram's native loading bar immediately — prevents double splash
try { (window as any).Telegram?.WebApp?.ready?.(); } catch {}

const SPLASH_KEY = "souq:splash:v1";

function Root() {
  const [done, setDone] = useState(() => {
    try { return sessionStorage.getItem(SPLASH_KEY) === "1"; } catch { return false; }
  });
  const finish = () => {
    try { sessionStorage.setItem(SPLASH_KEY, "1"); } catch {}
    setDone(true);
  };
  if (!done) return <SplashScreen onDone={finish} />;
  return <App />;
}

createRoot(document.getElementById("root")!).render(<Root />);

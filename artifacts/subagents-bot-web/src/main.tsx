import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Dismiss Telegram's native loading bar immediately — prevents double splash
try {
  (window as any).Telegram?.WebApp?.ready?.();
  (window as any).Telegram?.WebApp?.expand?.();
} catch {}

createRoot(document.getElementById("root")!).render(<App />);

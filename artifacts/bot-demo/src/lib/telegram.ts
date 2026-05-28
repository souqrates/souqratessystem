import { MOCK_USER } from "./mock-data";

export function showTelegramAlert(message: string) {
  if (typeof window === "undefined") return;
  const wa = window.Telegram?.WebApp;
  // showAlert/showPopup exist as functions even on Telegram WebApp 6.0
  // (the preview iframe), where they throw a non-Error rejection
  // "Method ... is not supported in version 6.0". Truthy-checking the
  // function is not enough — wrap each attempt in try/catch and fall
  // through to the next option, ending with browser alert().
  if (wa?.showAlert) {
    try { wa.showAlert(message); return; } catch { /* fall through */ }
  }
  if (wa?.showPopup) {
    try { wa.showPopup({ message }); return; } catch { /* fall through */ }
  }
  try { alert(message); } catch { /* ignore */ }
  try { wa?.HapticFeedback?.impactOccurred?.("light"); } catch { /* ignore */ }
}

export function openTelegramApp(url: string) {
  if (typeof window === "undefined") return;
  const wa = window.Telegram?.WebApp;
  if (wa?.openTelegramLink && url.startsWith("https://t.me/")) {
    wa.openTelegramLink(url);
  } else if (wa?.openLink) {
    wa.openLink(url);
  } else {
    window.open(url, "_blank");
  }
}

export function getTelegramUser() {
  if (typeof window !== "undefined" && window.Telegram && window.Telegram.WebApp) {
    const initDataUnsafe = window.Telegram.WebApp.initDataUnsafe;
    if (initDataUnsafe && initDataUnsafe.user) {
      return {
        firstName: initDataUnsafe.user.first_name,
        lastName: initDataUnsafe.user.last_name || "",
        username: initDataUnsafe.user.username || "",
        isPremium: initDataUnsafe.user.is_premium || false,
        avatarUrl: initDataUnsafe.user.photo_url || null,
      };
    }
  }
  return MOCK_USER;
}

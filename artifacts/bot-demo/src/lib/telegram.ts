import { MOCK_USER } from "./mock-data";

export function showTelegramAlert(message: string) {
  if (typeof window === "undefined") return;
  const wa = window.Telegram?.WebApp;
  if (wa?.showAlert) {
    wa.showAlert(message);
  } else if (wa?.showPopup) {
    wa.showPopup({ message });
  } else {
    alert(message);
  }
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

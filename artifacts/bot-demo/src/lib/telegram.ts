import { MOCK_USER } from "./mock-data";

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

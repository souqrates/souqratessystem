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

  // 1) t.me/... → open in Telegram (other bot, group, channel).
  if (wa?.openTelegramLink && url.startsWith("https://t.me/")) {
    wa.openTelegramLink(url);
    return;
  }

  // 2) Same-origin sub-app (e.g. /games-bot/, /books-bot-web/ on souqrates.com)
  //    → navigate within the SAME Mini App webview so the user stays inside
  //    Telegram. Using wa.openLink() here would force an EXTERNAL browser,
  //    which is what the user was hitting when tapping games/books from the
  //    main Mini App.
  try {
    const target = new URL(url, window.location.href);
    if (target.origin === window.location.origin) {
      window.location.href = target.toString();
      return;
    }
  } catch {
    /* fall through */
  }

  // 3) Cross-origin external URL → Telegram's in-app browser (still inside
  //    Telegram on mobile, just not a Mini App).
  if (wa?.openLink) {
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

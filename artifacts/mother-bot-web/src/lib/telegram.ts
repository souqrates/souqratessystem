interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    start_param?: string;
  };
  ready: () => void;
  expand: () => void;
  openTelegramLink?: (url: string) => void;
  HapticFeedback?: {
    impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
    notificationOccurred: (type: "error" | "success" | "warning") => void;
    selectionChanged: () => void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export const tg = (): TelegramWebApp | null =>
  (window.Telegram?.WebApp ?? null) as TelegramWebApp | null;

export function getTelegramUser() {
  return tg()?.initDataUnsafe?.user ?? null;
}

export function isInTelegram(): boolean {
  return !!tg()?.initData;
}

export function haptic(
  type: "light" | "medium" | "heavy" | "success" | "selection" = "light",
) {
  try {
    const hf = tg()?.HapticFeedback;
    if (!hf) return;
    if (type === "success") hf.notificationOccurred("success");
    else if (type === "selection") hf.selectionChanged();
    else hf.impactOccurred(type);
  } catch (_) {
    /* noop */
  }
}

/** Open a Telegram deep-link (t.me/...) from inside the WebApp or browser. */
export function openTelegram(url: string) {
  const w = tg();
  if (w?.openTelegramLink) {
    w.openTelegramLink(url);
  } else {
    window.open(url, "_blank");
  }
}

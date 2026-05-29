declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

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
  close: () => void;
  colorScheme?: "light" | "dark";
  themeParams?: Record<string, string>;
  HapticFeedback?: {
    impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
    notificationOccurred: (type: "error" | "success" | "warning") => void;
    selectionChanged: () => void;
  };
  MainButton?: {
    show: () => void;
    hide: () => void;
    setText: (text: string) => void;
    onClick: (fn: () => void) => void;
    offClick: (fn: () => void) => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
    enable: () => void;
    disable: () => void;
  };
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  setBottomBarColor?: (color: string) => void;
}

export const tg = (): TelegramWebApp | null =>
  (window.Telegram?.WebApp ?? null) as TelegramWebApp | null;

export function getInitData(): string {
  return tg()?.initData ?? "";
}

export function getTelegramUser() {
  return tg()?.initDataUnsafe?.user ?? null;
}

export function haptic(type: "light" | "medium" | "heavy" | "success" | "error" | "selection" = "light") {
  try {
    const hf = tg()?.HapticFeedback;
    if (!hf) return;
    if (type === "success") hf.notificationOccurred("success");
    else if (type === "error") hf.notificationOccurred("error");
    else if (type === "selection") hf.selectionChanged();
    else hf.impactOccurred(type);
  } catch (_) {}
}

export function isInTelegram(): boolean {
  return !!(tg()?.initData);
}

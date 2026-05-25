/**
 * Telegram Mini App helpers.
 * Reads window.Telegram.WebApp.initData (set by Telegram before our JS runs).
 * For browser preview without Telegram, falls back to ?devUserId=NNN.
 */
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe?: {
          user?: {
            id: number;
            first_name?: string;
            last_name?: string;
            username?: string;
            photo_url?: string;
          };
        };
        ready: () => void;
        expand: () => void;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        colorScheme?: "light" | "dark";
        themeParams?: Record<string, string>;
        MainButton?: {
          setText: (text: string) => void;
          show: () => void;
          hide: () => void;
          onClick: (cb: () => void) => void;
        };
        HapticFeedback?: {
          impactOccurred: (style: "light" | "medium" | "heavy") => void;
          notificationOccurred: (type: "success" | "warning" | "error") => void;
        };
        version?: string;
      };
    };
  }
}

export function getInitData(): string {
  return window.Telegram?.WebApp?.initData ?? "";
}

export function getUnsafeUser() {
  return window.Telegram?.WebApp?.initDataUnsafe?.user ?? null;
}

export function getDevUserId(): string | null {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("devUserId");
  return id && /^\d+$/.test(id) ? id : null;
}

export function isInTelegram(): boolean {
  return Boolean(window.Telegram?.WebApp?.initData);
}

export function initTelegram() {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
    tg.setBackgroundColor("#07070d");
    tg.setHeaderColor("#07070d");
  } catch {
    /* older client */
  }
}

export function haptic(kind: "tap" | "success" | "warning" | "error" = "tap") {
  const h = window.Telegram?.WebApp?.HapticFeedback;
  if (!h) return;
  try {
    if (kind === "tap") h.impactOccurred("light");
    else h.notificationOccurred(kind);
  } catch {
    /* noop */
  }
}

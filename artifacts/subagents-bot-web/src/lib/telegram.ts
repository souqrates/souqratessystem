declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        ready?: () => void;
        expand?: () => void;
        colorScheme?: "light" | "dark";
      }
    }
  }
}

export function getInitData(): string {
  return window.Telegram?.WebApp?.initData ?? "";
}

export function isTelegramEnvironment(): boolean {
  return !!window.Telegram?.WebApp?.initData;
}

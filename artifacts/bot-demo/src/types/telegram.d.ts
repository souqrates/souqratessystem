interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

interface TelegramWebAppInitData {
  user?: TelegramWebAppUser;
  start_param?: string;
  auth_date?: number;
  hash?: string;
}

interface TelegramWebApp {
  initDataUnsafe: TelegramWebAppInitData;
  initData: string;
  version: string;
  platform: string;
  colorScheme: "light" | "dark";
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  expand(): void;
  close(): void;
  ready(): void;
  showPopup(params: { message: string; title?: string }): void;
  openTelegramLink(url: string): void;
  openLink(url: string): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  setBottomBarColor(color: string): void;
  enableClosingConfirmation(): void;
  disableClosingConfirmation(): void;
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    show(): void;
    hide(): void;
    enable(): void;
    disable(): void;
    onClick(callback: () => void): void;
  };
  BackButton: {
    isVisible: boolean;
    show(): void;
    hide(): void;
    onClick(callback: () => void): void;
  };
}

interface Window {
  Telegram?: {
    WebApp: TelegramWebApp;
    WebView?: {
      postEvent(eventType: string, callback: unknown, eventData: unknown): void;
    };
  };
}

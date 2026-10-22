interface TelegramWebApp {
  initData: string;
  ready(): void;
  expand?(): void;
  disableVerticalSwipes?(): void;
  setHeaderColor?(c: string): void;
  setBackgroundColor?(c: string): void;
  HapticFeedback?: { impactOccurred(s: 'light' | 'medium'): void; notificationOccurred(s: 'success' | 'error'): void };
}
interface Window { Telegram?: { WebApp?: TelegramWebApp } }

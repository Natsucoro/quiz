import { create } from 'zustand';

// ログイン/ログアウト等、深い階層のコンポーネント（LoginPage・Settingsなど）からも
// トースト通知を出せるようにするための共有ストア。App.tsxのルートで表示する。
interface ToastState {
  message: string | null;
  showToast: (message: string) => void;
  hideToast: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  showToast: (message) => set({ message }),
  hideToast: () => set({ message: null }),
}));

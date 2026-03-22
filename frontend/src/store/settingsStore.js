import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export const useSettingsStore = create()(persist((set) => ({
    speechRate: 1.0, // 初期値
    isMuted: true, // 初期状態はミュート
    isHandsFree: false, // 初期状態はハンズフリーオフ
    setSpeechRate: (rate) => set({ speechRate: rate }),
    setIsMuted: (muted) => set({ isMuted: muted }),
    setIsHandsFree: (handsFree) => set({ isHandsFree: handsFree }),
}), {
    name: 'quiz-app-settings-storage', // localStorageのキー
}));

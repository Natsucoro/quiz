
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// デバッグ用アカウント（ログインすると全クイズを購入済みとして扱う）
const DEBUG_ACCOUNTS = [
  "watashihadare.quiz@gmail.com",
  "nakaharanatsumi+test1@gmail.com",
];

interface PurchaseState {
  purchasedItems: string[]; // 例: ['動物_3', '昆虫_2'] または ['animal_3', 'insect_2']
  allUnlocked: boolean; // 「全ジャンル・全レベル解放」まとめ買い、またはデバッグ用アカウント
  isLoggedIn: boolean;
  userEmail: string | null;
  login: (email: string) => void;
  logout: () => void;
  setLoggedOut: () => void; // 購入データを消さずにログイン状態のみリセット（アプリ起動時の未ログイン検知用）
  addPurchase: (itemId: string) => void;
  syncWithClaims: (claimItems: string[], allUnlocked?: boolean) => void;
  isPurchased: (itemId: string) => boolean;
  clearPurchases: () => void;
}

export const usePurchaseStore = create<PurchaseState>()(
  persist(
    (set, get) => ({
      purchasedItems: [],
      allUnlocked: false,
      isLoggedIn: false,
      userEmail: null,
      login: (email: string) => {
        const isDebugAccount = DEBUG_ACCOUNTS.includes(email);
        set((state) => ({
          isLoggedIn: true,
          userEmail: email,
          allUnlocked: state.allUnlocked || isDebugAccount,
        }));
      },
      logout: () =>
        set({
          purchasedItems: [], // 明示的ログアウト時は購入情報もリセット
          allUnlocked: false,
          isLoggedIn: false,
          userEmail: null,
        }),
      setLoggedOut: () =>
        set({
          // 購入データは消さずにログイン状態だけリセット
          // （アプリ起動時 / Firebase未ログイン検知時に使用）
          isLoggedIn: false,
          userEmail: null,
        }),
      addPurchase: (itemId) => set((state) => {
        if (!state.purchasedItems.includes(itemId)) {
          return { purchasedItems: [...state.purchasedItems, itemId] };
        }
        return state;
      }),
      syncWithClaims: (claimItems, allUnlocked) => set((state) => {
        // 現在のリストとClaimsのリストをマージして重複排除
        const merged = new Set([...state.purchasedItems, ...claimItems]);
        return {
          purchasedItems: Array.from(merged),
          allUnlocked: state.allUnlocked || !!allUnlocked,
        };
      }),
      isPurchased: (itemId) => get().allUnlocked || get().purchasedItems.includes(itemId),
      clearPurchases: () => set({ purchasedItems: [], allUnlocked: false }),
    }),
    {
      name: 'quiz-app-purchase-storage', // localStorageのキー
    }
  )
);

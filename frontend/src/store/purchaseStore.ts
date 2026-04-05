
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ジャンルIDのリスト
const ALL_GENRES = [
  "animals",
  "insects",
  "plants",
  "vehicles",
  "tools",
  "historical_figures",
  "japan_geography",
  "world_geography",
];

interface PurchaseState {
  purchasedItems: string[]; // 例: ['動物_3', '昆虫_2'] または ['animal_3', 'insect_2']
  isLoggedIn: boolean;
  userEmail: string | null;
  login: (email: string) => void;
  logout: () => void;
  setLoggedOut: () => void; // 購入データを消さずにログイン状態のみリセット（アプリ起動時の未ログイン検知用）
  addPurchase: (itemId: string) => void;
  syncWithClaims: (claimItems: string[]) => void;
  isPurchased: (itemId: string) => boolean;
  clearPurchases: () => void;
}

export const usePurchaseStore = create<PurchaseState>()(
  persist(
    (set, get) => ({
      purchasedItems: [],
      isLoggedIn: false,
      userEmail: null,
      login: (email: string) => {
        let itemsToUnlock: string[] = [];
        if (email === "nakaharanatsumi+test1@gmail.com") {
          // テストアカウントの場合、全ジャンル、難易度3-5, 8-10を解放
          ALL_GENRES.forEach(genre => {
            [3, 4, 5, 8, 9, 10].forEach(difficulty => {
              itemsToUnlock.push(`${genre}_${difficulty}`);
            });
            // 以前のバージョンで含まれていた、step1, step2の購入状態は、
            // 今回の指示「全48アイテム」には含まれないため削除しました。
            // 必要に応じて将来的に追加の要件としてご指示ください。
          });
        }
        set((state) => ({
          isLoggedIn: true,
          userEmail: email,
          // 既存の購入アイテムとテストアカウントで解放するアイテムを結合し、重複を排除
          purchasedItems: Array.from(new Set([...state.purchasedItems, ...itemsToUnlock])),
        }));
      },
      logout: () =>
        set({
          purchasedItems: [], // 明示的ログアウト時は購入情報もリセット
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
      syncWithClaims: (claimItems) => set((state) => {
        // 現在のリストとClaimsのリストをマージして重複排除
        const merged = new Set([...state.purchasedItems, ...claimItems]);
        return { purchasedItems: Array.from(merged) };
      }),
      isPurchased: (itemId) => get().purchasedItems.includes(itemId),
      clearPurchases: () => set({ purchasedItems: [] }),
    }),
    {
      name: 'quiz-app-purchase-storage', // localStorageのキー
    }
  )
);

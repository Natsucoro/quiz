
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 全ジャンルの日本語名（itemId は `${日本語ジャンル名}_${難易度}` 形式で管理される）
const ALL_GENRE_NAMES = [
  "哺乳類",
  "昆虫",
  "植物",
  "魚類",
  "鳥類",
  "爬虫類",
  "海洋生物",
  "乗り物",
  "道具",
  "歴史上の人物",
  "日本の地理",
  "世界の地理",
  "食べ物",
];

// デバッグ用アカウント（ログインすると全クイズを購入済みとして扱う）
const DEBUG_ACCOUNTS = [
  "watashihadare.quiz@gmail.com",
  "nakaharanatsumi+test1@gmail.com",
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
        if (DEBUG_ACCOUNTS.includes(email)) {
          // デバッグ用アカウントの場合、全13ジャンル・全難易度(1〜10)を購入済みとして解放
          ALL_GENRE_NAMES.forEach(genre => {
            for (let difficulty = 1; difficulty <= 10; difficulty++) {
              itemsToUnlock.push(`${genre}_${difficulty}`);
            }
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

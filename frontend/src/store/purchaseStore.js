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
export const usePurchaseStore = create()(persist((set, get) => ({
    purchasedItems: [],
    isLoggedIn: false,
    userEmail: null,
    login: (email) => {
        let itemsToUnlock = [];
        if (email === "test@example.com") {
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
    logout: () => set({
        purchasedItems: [], // ログアウト時に購入情報はリセット
        isLoggedIn: false,
        userEmail: null,
    }),
    addPurchase: (itemId) => {
        // 既に購入済みの場合は追加しない
        if (!get().purchasedItems.includes(itemId)) {
            set((state) => ({
                purchasedItems: [...state.purchasedItems, itemId],
            }));
        }
    },
    isPurchased: (itemId) => get().purchasedItems.includes(itemId),
}), {
    name: 'quiz-app-purchase-storage', // localStorageのキー
}));

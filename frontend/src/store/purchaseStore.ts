
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// デバッグ用アカウント（ログインすると全クイズを購入済みとして扱う）。
// このリポジトリは公開なので、メールアドレスそのものは書かず、
// 小文字にしたアドレスの SHA-256 だけを置く。
// 追加するときは: printf '%s' 'address@example.com' | sha256sum
// functions/src/index.ts の TEST_MODE_ALLOWED_EMAIL_HASHES と一致させること。
const DEBUG_ACCOUNT_HASHES = [
  "e4c6d5a17e685a37d212b68982c1433fe744bacb42a885a86df7cb933a3dfd54",
  "1d8fa7148cb8381d3af31a0ca45aca30d61d570082162d84b8fd737d99833546",
];

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function isDebugAccount(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  try {
    return DEBUG_ACCOUNT_HASHES.includes(await sha256Hex(email.trim().toLowerCase()));
  } catch {
    return false;
  }
}

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
        set({ isLoggedIn: true, userEmail: email });
        // ハッシュの計算は非同期なので、終わってから解放する
        // （その間に別のアカウントに切り替わっていたら何もしない）
        void isDebugAccount(email).then((debug) => {
          if (debug && get().userEmail === email) set({ allUnlocked: true });
        });
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

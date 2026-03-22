interface PurchaseState {
    purchasedItems: string[];
    isLoggedIn: boolean;
    userEmail: string | null;
    login: (email: string) => void;
    logout: () => void;
    addPurchase: (itemId: string) => void;
    isPurchased: (itemId: string) => boolean;
}
export declare const usePurchaseStore: import("zustand").UseBoundStore<Omit<import("zustand").StoreApi<PurchaseState>, "setState" | "persist"> & {
    setState(partial: PurchaseState | Partial<PurchaseState> | ((state: PurchaseState) => PurchaseState | Partial<PurchaseState>), replace?: false | undefined): unknown;
    setState(state: PurchaseState | ((state: PurchaseState) => PurchaseState), replace: true): unknown;
    persist: {
        setOptions: (options: Partial<import("zustand/middleware").PersistOptions<PurchaseState, PurchaseState, unknown>>) => void;
        clearStorage: () => void;
        rehydrate: () => Promise<void> | void;
        hasHydrated: () => boolean;
        onHydrate: (fn: (state: PurchaseState) => void) => () => void;
        onFinishHydration: (fn: (state: PurchaseState) => void) => () => void;
        getOptions: () => Partial<import("zustand/middleware").PersistOptions<PurchaseState, PurchaseState, unknown>>;
    };
}>;
export {};

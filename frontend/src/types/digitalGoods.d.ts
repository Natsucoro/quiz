// src/types/digitalGoods.d.ts
// Digital Goods API (Google Play Billing連携)の型定義。
// TypeScriptの標準libには含まれないため、必要な分だけ最小限に宣言する。
// 参照: https://github.com/WICG/digital-goods

interface DigitalGoodsPriceDetail {
  currency: string;
  value: string;
}

interface DigitalGoodsItemDetails {
  itemId: string;
  title: string;
  description: string;
  price: DigitalGoodsPriceDetail;
}

interface DigitalGoodsPurchaseDetails {
  itemId: string;
  purchaseToken: string;
}

interface DigitalGoodsService {
  getDetails(itemIds: string[]): Promise<DigitalGoodsItemDetails[]>;
  listPurchases(): Promise<DigitalGoodsPurchaseDetails[]>;
  listPurchaseHistory(): Promise<DigitalGoodsPurchaseDetails[]>;
  consume(purchaseToken: string): Promise<void>;
}

interface Window {
  getDigitalGoodsService?: (paymentMethod: string) => Promise<DigitalGoodsService>;
}

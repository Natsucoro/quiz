// src/services/playBilling.ts
// TWA(Trusted Web Activity)内で動作している場合の、Google Play Billing連携。
// 商品情報の取得はDigital Goods API、購入自体はPayment Request API
// (支払い方法 "https://play.google.com/billing") を使う。
// いずれもTWA内のChromeでのみ利用可能で、通常のブラウザでは動作しない
// (呼び出し元でisRunningInTwa()を確認してから使うこと)。

import { getGenreSlug } from '../constants/genreSlugs';

// Play Console側の商品IDは半角英数字・ピリオド・アンダースコアのみのため、
// 日本語ジャンル名はスラッグに変換してから使う。
// この関数が返す値は、Play Consoleに登録する商品IDと完全一致させること。
export const getPlaySingleProductId = (genre: string, difficulty: number): string =>
  `single_${getGenreSlug(genre)}_lv${difficulty}`;

export const getPlayGenreBundleProductId = (genre: string): string =>
  `genre_${getGenreSlug(genre)}`;

export const PLAY_ALL_BUNDLE_PRODUCT_ID = 'bundle_all';

const PLAY_BILLING_PAYMENT_METHOD = 'https://play.google.com/billing';

let cachedService: DigitalGoodsService | null | undefined;

const getService = async (): Promise<DigitalGoodsService | null> => {
  if (cachedService !== undefined) return cachedService;
  if (!window.getDigitalGoodsService) {
    cachedService = null;
    return null;
  }
  try {
    cachedService = await window.getDigitalGoodsService(PLAY_BILLING_PAYMENT_METHOD);
  } catch (error) {
    console.error('Digital Goods Service is unavailable:', error);
    cachedService = null;
  }
  return cachedService;
};

export const isPlayBillingAvailable = async (): Promise<boolean> => {
  return (await getService()) !== null;
};

// Play Consoleに登録済みの商品ID一覧から、価格などの詳細を取得する
export const getPlayProductDetails = async (productIds: string[]): Promise<DigitalGoodsItemDetails[]> => {
  const service = await getService();
  if (!service) return [];
  return service.getDetails(productIds);
};

export interface PlayPurchaseResult {
  productId: string;
  purchaseToken: string;
}

// 商品購入フローを開始する。ユーザーがGoogle Playの決済UIで支払いを完了すると
// purchaseTokenが得られるので、これをバックエンドに送って検証・権利付与する。
export const purchasePlayProduct = async (productId: string): Promise<PlayPurchaseResult> => {
  const supportedInstruments = [{
    supportedMethods: PLAY_BILLING_PAYMENT_METHOD,
    data: { sku: productId },
  }];
  const details = {
    total: {
      label: 'Total',
      amount: { currency: 'JPY', value: '0' }, // 実際の金額はPlay Console側の商品価格が使われる
    },
  };
  const request = new PaymentRequest(supportedInstruments, details);
  const paymentResponse = await request.show();
  const purchaseToken = (paymentResponse.details as { purchaseToken: string }).purchaseToken;
  await paymentResponse.complete('success');
  return { productId, purchaseToken };
};

// 消費型アイテムではない(レベル解放は永続的な権利)ため、consumeは呼ばない。
// 検証・権利付与はバックエンド(functions/src/index.ts の verifyPlayPurchase)側で行う。

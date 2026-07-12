import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import * as cors from "cors";
import { google } from "googleapis";
import { getGenreFromSlug } from "./genreSlugs";

// Firebase Admin SDK の初期化
admin.initializeApp();

const corsHandler = cors({ origin: true });
const PRICE_JPY = 120;
// ジャンルまとめ買いは「有料レベル数 × 55円」で計算する(標準6レベル=330円、
// 歴史上の人物3レベル=165円)。将来レベル数が変わっても自動的に追従する。
const GENRE_BUNDLE_PRICE_PER_LEVEL_JPY = 55;
const ALL_BUNDLE_PRICE_JPY = 1480;
// ジャンルまとめ買いとして許容する有料レベル数(それ以外はなりすまし防止のため拒否する)
const VALID_GENRE_BUNDLE_SIZES = [3, 6];
// 全13ジャンルLv1-10のうち、ゲスト無料レベル[1,2,6,7]を除いた有料レベル
// (frontend/src/store/purchaseStore.ts等と一致させること)
const PAID_DIFFICULTIES = [3, 4, 5, 8, 9, 10];
// AndroidアプリのパッケージID(frontend/src/services/platform.tsと一致させること)
const ANDROID_PACKAGE_NAME = "app.web.watashihadare_quiz.twa";

// 本番ドメインからのリクエストだけLiveキーを使い、それ以外(開発プレビュー等)は
// 常にテストキーを使う。誤って開発中にテスト以外の決済が発生しないようにするため。
const PROD_ORIGINS = ["https://watashihadare-quiz.web.app", "https://watashihadare-quiz.firebaseapp.com"];

function getStripe(req: functions.https.Request): Stripe {
  const origin = req.get("origin") || "";
  const isProd = PROD_ORIGINS.includes(origin);
  const secretName = isProd ? "STRIPE_SECRET_KEY_LIVE" : "STRIPE_SECRET_KEY";
  const stripeSecret = process.env[secretName] || "";
  if (!stripeSecret) {
    throw new Error(`Stripe secret key is not configured (${secretName}).`);
  }
  return new Stripe(stripeSecret, { apiVersion: "2024-04-10" as any });
}

async function getUidFromAuthHeader(authHeader: string | undefined): Promise<string> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing Auth token');
  }
  const idToken = authHeader.split('Bearer ')[1];
  const decodedToken = await admin.auth().verifyIdToken(idToken);
  return decodedToken.uid;
}

// 購入ボタンが押されたときに、その場でStripe Checkout Sessionを作成する。
// どのジャンル/レベル(itemId)の購入かをmetadataに埋め込み、Stripe側にサーバー起点で記録させる。
export const createCheckoutSession = functions.region('asia-northeast1').runWith({ secrets: ["STRIPE_SECRET_KEY", "STRIPE_SECRET_KEY_LIVE"] }).https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
      }

      const uid = await getUidFromAuthHeader(req.headers.authorization);
      const { origin } = req.body;
      const bundleType: 'single' | 'genre' | 'all' = req.body.bundleType || 'single';
      if (!origin) {
        res.status(400).json({ error: 'Missing origin' });
        return;
      }

      let unitAmount: number;
      let productName: string;
      let clientReferenceSuffix: string;
      let metadata: Record<string, string>;
      let successItemId: string;

      if (bundleType === 'all') {
        unitAmount = ALL_BUNDLE_PRICE_JPY;
        productName = '全ジャンル・全レベル まとめ買い解放';
        clientReferenceSuffix = 'BUNDLE_ALL';
        metadata = { uid, bundleType: 'all' };
        successItemId = 'BUNDLE_ALL';
      } else if (bundleType === 'genre') {
        const { genre, itemIds } = req.body;
        if (!genre || !Array.isArray(itemIds) || itemIds.length === 0) {
          res.status(400).json({ error: 'Missing genre or itemIds for genre bundle' });
          return;
        }
        // なりすまし防止: レベル数が想定外、または他ジャンルのitemIdが紛れていないか検証する
        if (!VALID_GENRE_BUNDLE_SIZES.includes(itemIds.length)) {
          res.status(400).json({ error: 'Invalid itemIds count for genre bundle' });
          return;
        }
        if (!itemIds.every((id: unknown) => typeof id === 'string' && id.startsWith(`${genre}_`))) {
          res.status(400).json({ error: 'itemIds must all belong to the specified genre' });
          return;
        }
        unitAmount = itemIds.length * GENRE_BUNDLE_PRICE_PER_LEVEL_JPY;
        productName = `「${genre}」まとめ買い(全レベル解放)`;
        clientReferenceSuffix = `BUNDLE_GENRE_${genre}`;
        metadata = { uid, bundleType: 'genre', genre, itemIds: itemIds.join(',') };
        successItemId = `BUNDLE_GENRE_${genre}`;
      } else {
        const { itemId, genre, difficulty } = req.body;
        if (!itemId || !genre || difficulty === undefined) {
          res.status(400).json({ error: 'Missing itemId, genre or difficulty' });
          return;
        }
        unitAmount = PRICE_JPY;
        productName = `「${genre} Lv.${difficulty}」レベル解放`;
        clientReferenceSuffix = itemId;
        metadata = { uid, bundleType: 'single', itemId };
        successItemId = itemId;
      }

      const stripe = getStripe(req);
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'jpy',
              unit_amount: unitAmount,
              product_data: {
                name: productName,
              },
            },
            quantity: 1,
          },
        ],
        client_reference_id: `${uid}_${clientReferenceSuffix}`,
        metadata,
        success_url: `${origin}/?success=true&itemId=${encodeURIComponent(successItemId)}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/`,
      });

      res.status(200).json({ url: session.url });
    } catch (error: any) {
      console.error('Error creating checkout session:', error);
      res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });
});

export const verifyPayment = functions.region('asia-northeast1').runWith({ secrets: ["STRIPE_SECRET_KEY", "STRIPE_SECRET_KEY_LIVE"] }).https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
      }

      const { sessionId } = req.body;
      if (!sessionId) {
        res.status(400).json({ error: 'Missing sessionId' });
        return;
      }
      const uid = await getUidFromAuthHeader(req.headers.authorization);

      const stripe = getStripe(req);
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status !== 'paid') {
        res.status(400).json({ error: 'Payment not completed or invalid session' });
        return;
      }

      // クライアントの自己申告ではなく、Stripe側に記録されたmetadataを信頼する。
      // かつ、このセッションを作ったのがリクエスト元本人であることを確認する。
      if (session.metadata?.uid !== uid) {
        res.status(403).json({ error: 'This session does not belong to the requesting user' });
        return;
      }
      const bundleType = session.metadata?.bundleType || 'single';

      const userRecord = await admin.auth().getUser(uid);
      const currentClaims = userRecord.customClaims || {};
      const purchasedItems: string[] = currentClaims.purchasedItems || [];

      if (bundleType === 'all') {
        if (!currentClaims.allUnlocked) {
          await admin.auth().setCustomUserClaims(uid, {
            ...currentClaims,
            allUnlocked: true,
          });
        }
        res.status(200).json({ success: true, purchasedItems, allUnlocked: true });
        return;
      }

      let newPurchasedItems = purchasedItems;
      if (bundleType === 'genre') {
        const itemIdsStr = session.metadata?.itemIds;
        if (!itemIdsStr) {
          res.status(400).json({ error: 'Session has no itemIds metadata' });
          return;
        }
        const itemIds = itemIdsStr.split(',');
        const merged = new Set([...purchasedItems, ...itemIds]);
        newPurchasedItems = Array.from(merged);
      } else {
        const itemId = session.metadata?.itemId;
        if (!itemId) {
          res.status(400).json({ error: 'Session has no itemId metadata' });
          return;
        }
        if (!purchasedItems.includes(itemId)) {
          newPurchasedItems = [...purchasedItems, itemId];
        }
      }

      if (newPurchasedItems.length !== purchasedItems.length) {
        await admin.auth().setCustomUserClaims(uid, {
          ...currentClaims,
          purchasedItems: newPurchasedItems,
        });
      }

      res.status(200).json({ success: true, purchasedItems: newPurchasedItems, allUnlocked: !!currentClaims.allUnlocked });
    } catch (error: any) {
      console.error('Error verifying payment:', error);
      res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });
});

// Google Play Consoleの「API アクセス」で紐付けたサービスアカウントの認証情報を使う。
// 事前に `firebase functions:secrets:set GOOGLE_PLAY_SERVICE_ACCOUNT_KEY` で、
// サービスアカウントのJSON鍵ファイルの中身をそのまま登録しておくこと。
function getAndroidPublisher() {
  const keyJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY || "";
  if (!keyJson) {
    throw new Error("GOOGLE_PLAY_SERVICE_ACCOUNT_KEY is not configured.");
  }
  const credentials = JSON.parse(keyJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });
  return google.androidpublisher({ version: "v3", auth });
}

// productId(例: single_tools_lv3 / genre_tools / bundle_all)から、
// このアプリの「itemId」語彙(${genre}_${difficulty} 形式)に変換する。
// 商品IDの命名規則は frontend/src/services/playBilling.ts と完全一致させること。
function resolvePlayProduct(productId: string): { bundleType: "single" | "genre" | "all"; itemIds: string[] } | null {
  if (productId === "bundle_all") {
    return { bundleType: "all", itemIds: [] };
  }
  const genreMatch = productId.match(/^genre_(.+)$/);
  if (genreMatch) {
    const genre = getGenreFromSlug(genreMatch[1]);
    if (!genre) return null;
    return { bundleType: "genre", itemIds: PAID_DIFFICULTIES.map((lv) => `${genre}_${lv}`) };
  }
  const singleMatch = productId.match(/^single_(.+)_lv(\d+)$/);
  if (singleMatch) {
    const genre = getGenreFromSlug(singleMatch[1]);
    if (!genre) return null;
    return { bundleType: "single", itemIds: [`${genre}_${singleMatch[2]}`] };
  }
  return null;
}

// AndroidアプリでのGoogle Play Billing購入を検証し、Stripe版のverifyPaymentと
// 同じcustom claims(purchasedItems / allUnlocked)を付与する。
export const verifyPlayPurchase = functions.region("asia-northeast1").runWith({ secrets: ["GOOGLE_PLAY_SERVICE_ACCOUNT_KEY"] }).https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
      }

      const { productId, purchaseToken } = req.body;
      if (!productId || !purchaseToken) {
        res.status(400).json({ error: "Missing productId or purchaseToken" });
        return;
      }
      const uid = await getUidFromAuthHeader(req.headers.authorization);

      const resolved = resolvePlayProduct(productId);
      if (!resolved) {
        res.status(400).json({ error: "Unknown productId" });
        return;
      }

      const androidPublisher = getAndroidPublisher();
      const purchase = await androidPublisher.purchases.products.get({
        packageName: ANDROID_PACKAGE_NAME,
        productId,
        token: purchaseToken,
      });

      // purchaseState: 0=購入済み, 1=キャンセル済み, 2=保留中
      if (purchase.data.purchaseState !== 0) {
        res.status(400).json({ error: "Purchase is not in a completed state" });
        return;
      }

      // 3日以内に確認応答しないとGoogle側で自動返金されるため、未確認なら確認する
      if (purchase.data.acknowledgementState === 0) {
        await androidPublisher.purchases.products.acknowledge({
          packageName: ANDROID_PACKAGE_NAME,
          productId,
          token: purchaseToken,
          requestBody: {},
        });
      }

      const userRecord = await admin.auth().getUser(uid);
      const currentClaims = userRecord.customClaims || {};
      const purchasedItems: string[] = currentClaims.purchasedItems || [];

      if (resolved.bundleType === "all") {
        if (!currentClaims.allUnlocked) {
          await admin.auth().setCustomUserClaims(uid, { ...currentClaims, allUnlocked: true });
        }
        res.status(200).json({ success: true, purchasedItems, allUnlocked: true });
        return;
      }

      const merged = new Set([...purchasedItems, ...resolved.itemIds]);
      const newPurchasedItems = Array.from(merged);
      if (newPurchasedItems.length !== purchasedItems.length) {
        await admin.auth().setCustomUserClaims(uid, { ...currentClaims, purchasedItems: newPurchasedItems });
      }

      res.status(200).json({ success: true, purchasedItems: newPurchasedItems, allUnlocked: !!currentClaims.allUnlocked });
    } catch (error: any) {
      console.error("Error verifying Play purchase:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });
});

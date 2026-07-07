import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import * as cors from "cors";

// Firebase Admin SDK の初期化
admin.initializeApp();

const corsHandler = cors({ origin: true });
const PRICE_JPY = 120;

function getStripe(): Stripe {
  const stripeSecret = process.env.STRIPE_SECRET_KEY || "";
  if (!stripeSecret) {
    throw new Error("Stripe secret key is not configured.");
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
export const createCheckoutSession = functions.region('asia-northeast1').runWith({ secrets: ["STRIPE_SECRET_KEY"] }).https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
      }

      const uid = await getUidFromAuthHeader(req.headers.authorization);

      const { itemId, genre, difficulty, origin } = req.body;
      if (!itemId || !genre || difficulty === undefined || !origin) {
        res.status(400).json({ error: 'Missing itemId, genre, difficulty or origin' });
        return;
      }

      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'jpy',
              unit_amount: PRICE_JPY,
              product_data: {
                name: `「${genre} Lv.${difficulty}」レベル解放 + 50問追加`,
              },
            },
            quantity: 1,
          },
        ],
        client_reference_id: `${uid}_${itemId}`,
        metadata: { uid, itemId },
        success_url: `${origin}/?success=true&itemId=${encodeURIComponent(itemId)}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/`,
      });

      res.status(200).json({ url: session.url });
    } catch (error: any) {
      console.error('Error creating checkout session:', error);
      res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });
});

export const verifyPayment = functions.region('asia-northeast1').runWith({ secrets: ["STRIPE_SECRET_KEY"] }).https.onRequest((req, res) => {
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

      const stripe = getStripe();
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
      const itemId = session.metadata?.itemId;
      if (!itemId) {
        res.status(400).json({ error: 'Session has no itemId metadata' });
        return;
      }

      const userRecord = await admin.auth().getUser(uid);
      const currentClaims = userRecord.customClaims || {};
      const purchasedItems: string[] = currentClaims.purchasedItems || [];

      let newPurchasedItems = purchasedItems;
      if (!purchasedItems.includes(itemId)) {
        newPurchasedItems = [...purchasedItems, itemId];
        await admin.auth().setCustomUserClaims(uid, {
          ...currentClaims,
          purchasedItems: newPurchasedItems,
        });
      }

      res.status(200).json({ success: true, purchasedItems: newPurchasedItems });
    } catch (error: any) {
      console.error('Error verifying payment:', error);
      res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });
});

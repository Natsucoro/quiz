"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPayment = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const stripe_1 = require("stripe");
const cors = require("cors");
// Firebase Admin SDK の初期化
admin.initializeApp();
const corsHandler = cors({ origin: true });
exports.verifyPayment = functions.region('asia-northeast1').https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        try {
            // リクエスト時にStripeの中身を初期化（デプロイ起動時のエラー回避）
            const stripeSecret = process.env.STRIPE_SECRET_KEY || "";
            if (!stripeSecret) {
                throw new Error("Stripe secret key is not configured.");
            }
            const stripe = new stripe_1.default(stripeSecret, {
                apiVersion: "2024-04-10",
            });
            if (req.method !== 'POST') {
                res.status(405).send('Method Not Allowed');
                return;
            }
            // クライアントから送信されたセッションIDとトークン（UID）を受け取る
            const { sessionId } = req.body;
            const authHeader = req.headers.authorization;
            if (!sessionId || !authHeader || !authHeader.startsWith('Bearer ')) {
                res.status(400).json({ error: 'Missing sessionId or Auth token' });
                return;
            }
            const idToken = authHeader.split('Bearer ')[1];
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            const uid = decodedToken.uid;
            // Stripe API でセッションを検証
            const session = await stripe.checkout.sessions.retrieve(sessionId);
            if (session.payment_status === 'paid') {
                // 現在の Custom Claims を取得
                const userRecord = await admin.auth().getUser(uid);
                const currentClaims = userRecord.customClaims || {};
                const purchasedItems = currentClaims.purchasedItems || [];
                // セッションから購入内容を判定（アプリからは genre_level 形式としてメタデータを送るか、ここでは簡便に全てを許可するテストでも可）
                // 今回アプリ側は `?success=true&genre=animal&level=3` 等で戻ってくるが、StripeのCheckoutSessionから直接何を買ったか判定できない場合は
                // クライアントから申告されたitemIdを信じるか、Payment Linkのmetadataに仕込む必要がある。
                // ※ 本来は PaymentLink 側でメタデータを持たせるべきだが、現在は設定されていない。
                // そこで、今回はフロントエンド側から `itemId` を受け取り、それを単に `paid` であれば承認するロジックとする。（「1つの決済で1つのロック解除許可」）
                const { itemId } = req.body;
                if (!itemId) {
                    res.status(400).json({ error: 'Missing itemId' });
                    return;
                }
                // 既に持っていなければ追加
                let newPurchasedItems = [...purchasedItems];
                if (!newPurchasedItems.includes(itemId)) {
                    newPurchasedItems.push(itemId);
                }
                // Custom Claims の更新
                await admin.auth().setCustomUserClaims(uid, {
                    ...currentClaims,
                    purchasedItems: newPurchasedItems
                });
                res.status(200).json({ success: true, purchasedItems: newPurchasedItems });
            }
            else {
                res.status(400).json({ error: 'Payment not completed or invalid session' });
            }
        }
        catch (error) {
            console.error('Error verifying payment:', error);
            res.status(500).json({ error: error.message || 'Internal Server Error' });
        }
    });
});
//# sourceMappingURL=index.js.map
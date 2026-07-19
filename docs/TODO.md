# TODO（あとでやること）

## 課金通知（メール）が届かない件の調査 — 保留中（2026-07-19）

### 状況
課金成立時に、運営者の既存Gmailからメール通知を送る機能は **実装・デプロイ済み**。
ただしテスト購入でメールが届かず、原因調査の途中で保留にした。

### できていること（確認済み）
- `functions/src/index.ts` の `notifyPurchase()` で、Stripe課金確定時（`verifyPayment`）に
  Gmail(SMTP / nodemailer)でメール送信する実装。
- 自動デプロイCI `.github/workflows/deploy-functions.yml`（`functions/**` 変更時 or 手動実行）。
  Web(Stripe)の `createCheckoutSession` / `verifyPayment` のみデプロイ対象。
- GitHub Secrets `GMAIL_USER` / `GMAIL_APP_PASSWORD` は登録済みで、
  手動Run（run #5, 2026-07-19 07:57 UTC）でデプロイ成功済み。

### 未解決（次に調べること）
テスト購入で通知メールが届かなかった。候補：
1. 送信元Gmail（`GMAIL_USER`）の**迷惑メールフォルダ**に入っていないか。
2. 購入が**デプロイ完了(07:57 UTC)より前**だった可能性。→ デプロイ後に再購入して確認。
3. **すでに解放済みレベル / デバッグアカウント**での購入だと“新規解放”が起きず通知は飛ばない
   （`purchaseStore.ts` の `DEBUG_ACCOUNTS`。通常アカウント×未購入レベルで要再検証）。
4. 実行時のGmail送信エラー（アプリパスワード等）。
   → Firebase関数ログで `verifyPayment` を絞り、`notifyPurchase failed:` の有無を確認。
   ログ: https://console.firebase.google.com/project/watashihadare-quiz/functions/logs

### 補足
- Android(Google Play)版の通知（`verifyPlayPurchase`）は、Secret
  `GOOGLE_PLAY_SERVICE_ACCOUNT_KEY` が未設定でデプロイできないため対象外。
  Play課金を有効化してSecret登録後、CIのデプロイ対象に `functions:verifyPlayPurchase` を追記する。
- 関連PR: #200, #201, #202, #203, #204

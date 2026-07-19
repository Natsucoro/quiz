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

---

## SNSで自動投稿してアプリを普及させる — 検討中（2026-07-19）

### やりたいこと
「1日1問クイズ」を SNS に**自動投稿し続ける**仕組みを作り、集客の入口を増やす。
コンテンツ生成（画像・文章・出題ローテーション）は自動化し、なつみの継続作業はゼロにする。
GitHub Actions の cron で定期実行すれば、サーバー上でずっと自動で回せる。

### プラットフォーム選定（2026-07時点でリサーチ済み）
- **X（旧Twitter）**: 日本の利用者は最多クラスだが、**2026-02-06にAPI無料枠が廃止**。
  新規は従量課金（1投稿 約$0.015、リンク入りは$0.20）＋クレジット前払いが必要。
  →「無料での自動投稿」は不可。手動投稿なら無料。
- **Bluesky**: **API無料**（アプリパスワードのみ・費用なし）で自動投稿できる。
  日本の利用者はまだ少なめだが、「無料 × 完全自動」を満たす唯一の選択肢。
- **Instagram**: ママ・知育層と相性◎だが自動投稿はビジネス垢＋Meta審査が必要でハードルが高い。

### 次にやること（なつみの判断待ち）
- 方針決定：まず **Bluesky（無料・自動）** で始めるか、**X（有料API・月100円〜）** で数を取るか。
- 決まったら実装：クイズデータからの出題ローテーション → 画像＋文章生成（OGP生成の仕組みを流用可）
  → cron で各SNSのAPIへ投稿。認証情報はGitHub Secretから渡す。
- なつみの作業は「アカウント作成＋鍵をGitHubに1回貼る」だけになるよう設計する。

### 正直な注意点
自動投稿は"土台"であって、フォロワー0の新規アカウントがすぐ拡散するわけではない。
数ヶ月の継続で効いてくる前提で考える。

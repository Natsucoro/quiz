# Androidアプリ化(TWA)セットアップ

このディレクトリは、既存のPWA(`watashihadare-quiz.web.app`)をGoogle Play向けの
TWA(Trusted Web Activity)としてラップするための設定です。Webアプリのコード自体は
変更せず、常に本番URLを読み込むだけなので、通常のデプロイ(Firebase Hosting)は
これまで通り即座に反映されます。Play Storeの審査が必要になるのは、アプリの入れ物
(APK/AAB)自体を更新するとき(アイコン変更・権限変更・課金方式の変更など)だけです。

## すでに実装済みのもの

- `frontend/vite.config.ts` — PWA manifestは`lang: 'ja'`、アイコン一式(72px〜512px、
  maskable含む)、`display: 'standalone'`まで設定済み。TWA化に必要な要件は満たしている
- `frontend/src/services/platform.ts` — TWA内で動作しているかの判定(`isRunningInTwa`)
- `frontend/src/services/playBilling.ts` — Digital Goods API / Payment Request API
  経由でのGoogle Play Billing購入フロー
- `frontend/src/components/common/PaywallModal.tsx` — TWA内ではPlay Billing、
  それ以外(通常のブラウザ)では従来通りStripeを使うよう自動判定
- `functions/src/index.ts`の`verifyPlayPurchase` — Google Play Developer APIで
  購入トークンを検証し、Stripe版(`verifyPayment`)と同じcustom claimsを付与する
- `android/twa-manifest.json` — Bubblewrapが読み込むTWAプロジェクトの設定

## ここから先、なつみさんに対応していただく必要があること

以下は外部アカウントの作成や秘密鍵の管理が絡むため、このセッションでは実行していません。

### 1. Google Play Developer アカウントの作成
- https://play.google.com/console/ で登録(初回$25、本人確認あり)

### 2. 署名鍵(keystore)の生成
- **重要**: この鍵を紛失すると、そのアプリは二度と更新できなくなります
- ご自身のPC上で `npx @bubblewrap/cli init --manifest https://watashihadare-quiz.web.app/manifest.webmanifest`
  を実行すると対話形式で鍵を生成できます(このクラウドセッションでは行わない方針にしました。
  紛失リスクがあるためです)
- 生成した鍵は、パスワード管理ツールなど安全な場所に必ずバックアップしてください
- Google Play App Signingの利用を推奨します(Google側が本番署名鍵を安全に保管してくれる仕組み)

### 3. Digital Asset Links の設定
- 生成した署名鍵のSHA-256フィンガープリントを使い、
  `frontend/public/.well-known/assetlinks.json` を作成してデプロイする
  (Bubblewrapが対話式セットアップの最後に内容を教えてくれます)
- これが無いとTWAがアドレスバー付きの通常タブとして開いてしまい、
  「アプリらしさ」が損なわれます

### 4. Google Play Console側の商品(In-app products)登録
以下の命名規則(`frontend/src/services/playBilling.ts`と一致させること)で、
Play Consoleに商品を登録してください:

- 単品レベル解放: `single_${ジャンルスラッグ}_lv${レベル}` (例: `single_tools_lv3`)
- ジャンルまとめ買い: `genre_${ジャンルスラッグ}` (例: `genre_tools`)
- 全ジャンル・全レベル: `bundle_all`

ジャンルスラッグの対応表は `frontend/src/constants/genreSlugs.ts` を参照してください。
14ジャンル × 有料レベル6つ(Lv3,4,5,8,9,10)= 84個の単品商品 + 14個のジャンルまとめ買い +
全ジャンルまとめ買い1個 = 合計99商品と数が多いため、手作業ではなく
`android/create-play-products.mjs` で一括登録できるようにしてあります:

```
cd android
npm install
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json npm run create-play-products
```

価格はGoogleの手数料(通常15%)を踏まえてWeb版より高めに設定したい場合、
スクリプト冒頭の`SINGLE_PRICE_JPY`等の定数を編集してから実行してください
(何度実行しても、既存の商品はスキップされ安全です)。

### 5. サービスアカウントの発行とCloud Functionsへの設定
- Play Console の「ユーザーとアクセス権」→「API アクセス」から、
  Cloud Functions用のサービスアカウントを作成し、
  「注文管理」権限(購入の確認・検証に必要)を付与する
- サービスアカウントのJSON鍵をダウンロードし、以下のコマンドで
  Cloud Functionsのシークレットとして登録する:
  ```
  firebase functions:secrets:set GOOGLE_PLAY_SERVICE_ACCOUNT_KEY
  ```
  (プロンプトが出たらJSON鍵の中身をそのまま貼り付ける)

### 6. Bubblewrapでのビルド・Play Consoleへのアップロード
- 上記の鍵生成が完了したら、`bubblewrap build` でAAB(Android App Bundle)を生成
- Play Consoleの「内部テスト」トラックにアップロードし、実機で動作確認
- Play Billingの商品購入テストは、内部テストトラックにアップロード済みの状態でないと行えません

## 現時点でのおすすめの進め方

1〜3(アカウント作成・鍵生成・Asset Links)を先に完了させ、実機でTWAとして
正しく起動する(アドレスバーが出ない)ところまで確認してから、4〜6の決済まわりに
着手するのがリスクが低いと思います。決済連携が未完成でも、無料レベルだけは
問題なく遊べる状態でPlay Storeに公開すること自体は可能です。

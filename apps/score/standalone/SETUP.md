# はじめの設定（なつみがやること）

Claudeが代われないのは「アカウントを作る・鍵を発行する」ところだけ。
それ以外は全部Claudeがやるので、ここに書いてあることだけお願いします。

**第1段階だけやれば、アプリは公開URLで使えるようになります。**
高精度の読み取りサーバー（第2段階）は、あとからで大丈夫です。

---

## 第1段階：アプリを公開する（10分ほど）

### 1-1. GitHubに空のリポジトリを作る

このリンクを開くと、名前などが入った状態で作成画面が開きます。

**https://github.com/new?name=gakufu-camera&visibility=private&description=%E6%A5%BD%E8%AD%9C%E3%82%AB%E3%83%A1%E3%83%A9**

- 名前が `gakufu-camera`、Private が選ばれていることを確認
- **「Add a README file」にはチェックを入れない**（入れるとpushできません）
- 緑の「Create repository」を押す

作ったらClaudeに「作った」と伝えてください。**中身のpushはClaudeがやります。**

### 1-2. Firebaseにプロジェクトを作る

**https://console.firebase.google.com/**

- 「プロジェクトを追加」→ 名前は `gakufu-camera`
- Googleアナリティクスは「無効」でOK
- できたら、画面上部に出る**プロジェクトID**（例 `gakufu-camera-1a2b3`）をメモ

### 1-3. 鍵（サービスアカウント）を発行する

**https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk**

- 「新しい秘密鍵を生成」→ ダウンロードされる **.json ファイル** を開いて中身を全部コピー

### 1-4. GitHubに2つ登録する

**https://github.com/Natsucoro/gakufu-camera/settings/secrets/actions/new**

| Name | Secret（値） |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | 1-3でコピーしたjsonの中身（まるごと貼る） |
| `FIREBASE_PROJECT_ID` | 1-2でメモしたプロジェクトID |

（1つ登録したら、同じページからもう1つ登録します）

**ここまで終わったらClaudeに伝えてください。** 配信はClaudeが実行し、
公開URLをお知らせします。

---

## 第2段階：高精度の読み取りサーバーを動かす（あとで・10分ほど）

きれいな画像で 音高99% になるサーバーです。Googleの課金設定が要ります
（使った分だけの支払いで、1日数回の利用なら実質0円です）。

### 2-1. お支払い情報をプロジェクトに紐づける

**https://console.cloud.google.com/billing/linkedaccount?project=＜プロジェクトID＞**

- 「請求先アカウントをリンク」を押す（クイズで使っているものを選べばOK）

### 2-2. 2つの機能を有効にする（それぞれ「有効にする」を押すだけ）

- Cloud Run … **https://console.cloud.google.com/apis/library/run.googleapis.com?project=＜プロジェクトID＞**
- Cloud Build … **https://console.cloud.google.com/apis/library/cloudbuild.googleapis.com?project=＜プロジェクトID＞**

### 2-3. 鍵に権限を足す

**https://console.cloud.google.com/iam-admin/iam?project=＜プロジェクトID＞**

`firebase-adminsdk-…` という名前の行の鉛筆マークを押して、
「別のロールを追加」から次の4つを足して保存:

- Cloud Run 管理者
- サービス アカウント ユーザー
- Cloud Build 編集者
- Artifact Registry 管理者

### 2-4. GitHubに3つ登録する

**https://github.com/Natsucoro/gakufu-camera/settings/secrets/actions/new**

| Name | Secret（値） |
|---|---|
| `GCP_SERVICE_ACCOUNT` | 1-3と同じjsonの中身 |
| `GCP_PROJECT_ID` | プロジェクトID |
| `OMR_API_KEY` | 好きな合言葉（例 `piano-natsumi-2026`） |

終わったらClaudeに伝えてください。デプロイと、アプリへのサーバー設定は
Claudeがやります。

---

## 困ったとき

配信の様子はここで見られます（赤い×が出たらClaudeに知らせてください）:
**https://github.com/Natsucoro/gakufu-camera/actions**

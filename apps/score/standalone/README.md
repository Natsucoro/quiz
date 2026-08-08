# 楽譜カメラを独立したリポジトリにする

このフォルダの `gakufu-camera.bundle` が、**独立した楽譜カメラのリポジトリまるごと**。
git の履歴つきで1ファイルに固めてある(2.8MB)。

## 移し方（なつみの手元で1回だけ）

1. GitHub で空のリポジトリを作る。名前は **`gakufu-camera`**、
   **Private**、「Add a README file」は**チェックしない**
2. パソコンで次を実行する（バンドルはこのフォルダからダウンロードしておく）

```bash
git clone gakufu-camera.bundle gakufu-camera
cd gakufu-camera
git remote set-url origin https://github.com/Natsucoro/gakufu-camera.git
git push -u origin main
```

これで、ぶんなび・クイズと同じように独立したリポジトリになる。

## そのあと（配信の設定）

リポジトリの README に手順がある。要点だけ:

- **画面を配る**: Firebase でプロジェクトを1つ作り、GitHub Secret に
  `FIREBASE_SERVICE_ACCOUNT` と `FIREBASE_PROJECT_ID` を登録する
- **高精度サーバーも使う**: さらに `GCP_SERVICE_ACCOUNT` `GCP_PROJECT_ID`
  `OMR_API_KEY` を登録し、Google Cloud で Cloud Run API と Cloud Build API を有効にする

`main` に push すれば自動で配られる。

## 中身

```
gakufu-camera/
  web/      アプリ本体（1枚のHTMLに組み上がる）
  server/   高精度の読み取りサーバー（Audiveris / Cloud Run）
  bench/    精度の物差し（3つのF1・実物の楽譜での回帰テスト）
  docs/     設計と記録
  .github/workflows/  配信の自動化
```

独立リポジトリの中でベンチが同じ数字を出すことは確認済み
（音高86.0% / 音価69.1% / 鳴り出し52.1%、実物の楽譜も従来どおり）。

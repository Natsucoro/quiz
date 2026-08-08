# 楽譜カメラ 読み取りサーバー

写真を Audiveris(機械学習ベースの楽譜認識)で MusicXML にして返す小さなサーバー。

## なぜサーバーか(実測にもとづく判断・2026-08)

| 入力 | 手元エンジン(ブラウザ内) | Audiveris(このサーバー) |
|---|---|---|
| きれいな画像(スクショ・スキャン) | 音高97.5% 鳴り出し84.1% | **音高99.3% 鳴り出し92.6%**(取り込み正規化込み) |
| ぼけたスマホ写真 | **音高86〜93%** | 音高58〜75%・リズム崩壊 |

どちらか一方では足りないので、アプリは両方を実行して
「小節が拍子どおりに埋まった割合(sanity)」で良いほうを選ぶ。
サーバー結果の取り込みと正規化は `../prototype/import_xml.js`。

## API

```
POST /read
  ヘッダ  X-Api-Key: <合言葉>     (環境変数 API_KEY と一致)
  本文    multipart/form-data, image=<切り取り済みの楽譜画像>
  返り    {"musicxml": ["...xml..."], "seconds": 10.9}
GET /healthz → "ok"
```

## 動かし方

ローカル:
```bash
# Audiveris 5.8.1 の deb を展開して AUDIVERIS_BIN に指す
AUDIVERIS_BIN=/opt/audiveris/bin/Audiveris API_KEY=合言葉 python3 app.py
```

本番(Cloud Run): `.github/workflows/deploy-omr.yml` が
main への push か手動実行でデプロイする。初回はサービスアカウントへの
役割付与が要る(ワークフロー内のコメント参照)。

処理時間の目安: 1ページ 10〜20秒(2GiB/2CPU)。月々の費用は
使った分だけ(1日数回の利用なら実質0円〜数十円)。

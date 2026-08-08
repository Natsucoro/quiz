#!/usr/bin/env python3
"""楽譜カメラの読み取りサーバー。

写真(切り取り済みの楽譜画像)を受け取り、Audiveris(機械学習ベースの
楽譜認識エンジン)で MusicXML にして返す。

- きれいな画像(スキャン・スクリーンショット・ピントの合った写真)では
  手元エンジンより大幅に正確(実測: いつも何度でもで音高99.3%・音価95.8%)
- ぼけた写真では手元エンジンのほうが強いので、アプリ側は品質のてがかり
  (quality)を見てどちらの結果を使うか選ぶ

API:
  POST /read   multipart/form-data: image=<file>
               ヘッダ X-Api-Key: 環境変数 API_KEY と一致すること
  返り: {"musicxml": [楽章ごとのXML文字列], "seconds": 処理秒数}
  エラー時: {"error": "..."} と 4xx/5xx
"""
import os, subprocess, tempfile, time, zipfile, glob
from flask import Flask, request, jsonify

AUDIVERIS = os.environ.get("AUDIVERIS_BIN", "/opt/audiveris/bin/Audiveris")
API_KEY = os.environ.get("API_KEY", "")
MAX_BYTES = 20 * 1024 * 1024

app = Flask(__name__)


@app.after_request
def cors(resp):
    # 許可する呼び出し元。未設定なら全許可(開発用)
    origin = os.environ.get("ALLOW_ORIGIN", "*")
    resp.headers["Access-Control-Allow-Origin"] = origin
    resp.headers["Access-Control-Allow-Headers"] = "X-Api-Key, Content-Type"
    resp.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    return resp


@app.route("/read", methods=["OPTIONS"])
def preflight():
    return "", 204


@app.route("/healthz")
def healthz():
    return "ok"


@app.route("/read", methods=["POST"])
def read_score():
    if API_KEY and request.headers.get("X-Api-Key") != API_KEY:
        return jsonify({"error": "認証エラー"}), 401
    f = request.files.get("image")
    if f is None:
        return jsonify({"error": "image がありません"}), 400
    data = f.read()
    if len(data) > MAX_BYTES:
        return jsonify({"error": "画像が大きすぎます"}), 413

    t0 = time.time()
    with tempfile.TemporaryDirectory() as td:
        img = os.path.join(td, "input.png")
        with open(img, "wb") as fh:
            fh.write(data)
        out = os.path.join(td, "out")
        try:
            subprocess.run(
                [AUDIVERIS, "-batch", "-export", "-output", out, img],
                check=True, capture_output=True, timeout=280,
            )
        except subprocess.TimeoutExpired:
            return jsonify({"error": "解析がタイムアウトしました"}), 504
        except subprocess.CalledProcessError as e:
            return jsonify({"error": "解析に失敗しました",
                            "detail": e.stderr.decode(errors="replace")[-500:]}), 500

        # .mxl(圧縮MusicXML)を展開して中身を返す。楽章が分かれることがある
        xmls = []
        for mxl in sorted(glob.glob(os.path.join(out, "*.mxl"))):
            with zipfile.ZipFile(mxl) as z:
                for name in z.namelist():
                    if name.endswith(".xml") and not name.startswith("META-INF"):
                        xmls.append(z.read(name).decode("utf-8", errors="replace"))
        if not xmls:
            return jsonify({"error": "楽譜を見つけられませんでした"}), 422

    return jsonify({"musicxml": xmls, "seconds": round(time.time() - t0, 1)})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))

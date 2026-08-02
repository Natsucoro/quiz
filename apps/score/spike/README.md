# M0 技術検証スクリプト

`docs/技術検証レポート_M0.md` の数値を再現するためのスクリプト群。

## 環境（バージョン固定が必須）

```bash
# 楽譜生成・移調・描画用
python3 -m venv omr-spike
./omr-spike/bin/pip install music21 verovio cairosvg opencv-python-headless pillow numpy

# OMRエンジン用（別venv。依存が競合するため分ける）
python3 -m venv omr-engine
./omr-engine/bin/pip install oemer
./omr-engine/bin/pip install "numpy<2" "onnxruntime==1.19.2" "opencv-python-headless<5" "scikit-learn<1.6"
```

⚠️ oemer は `onnxruntime-gpu` を要求するが、CPU環境では上記のとおり
`onnxruntime==1.19.2` に差し替える。1.28 系は oemer のモデルを読み込めない
（`ConvTranspose` の負pad）。numpy 2.x も不可。

## 実行順

| スクリプト | 内容 |
|---|---|
| `gen.py` | 正解MusicXMLを作り、A4浄書 → 「スマホ写真風」画像を合成 |
| （`oemer <画像> -o out`） | OMR実行。1ページ約5〜6分（4vCPU） |
| `compare.py <正解> <認識結果> <ラベル>` | 音高の再現率・適合率・F1 |
| `rhythm.py` | 音価・拍子・強弱・スラー・反復・休符まで含めた比較 |
| `transpose_test.py` | 半音数指定では調号が破綻することの確認 |
| `transpose2.py` | オクターブ移動の音域判定、PDF/MIDI出力 |
| `e2e.py` | OMR出力 → 移調 → 再組版 → PDF の一気通貫 |
| `fix_ts.py` | 拍子記号を与えると連桁が復活する仮説の検証 |

## samples/

| ファイル | 内容 |
|---|---|
| `mozart_photo.jpg` / `joplin_photo.jpg` | 合成した「スマホ撮影」入力 |
| `mozart_photo_omr.jpg` / `joplin_photo_omr.jpg` | OMR結果をそのまま浄書したもの（連桁なし・拍子なし） |
| `mozart_photo_fixed.jpg` | 拍子記号を与えて割り直したもの（連桁が復活） |
| `transposed_M2.jpg` | 正解データを長2度上げた結果（ハ長調→ニ長調） |

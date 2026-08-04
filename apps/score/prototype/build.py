#!/usr/bin/env python3
"""index.template.html に部品を流し込んで、1枚で完結する index.html を作る。

流し込むもの:
  verovio.js      浄書エンジン（WASM。これがあるので楽譜データを組み直せる）
  omr.js          写真から音符を読み取る
  score.js        読み取り結果を MusicXML に組み立てる
  demo.musicxml   お手本（モーツァルト K.545 冒頭8小節・著作権切れ）
"""
import json, pathlib

here = pathlib.Path(__file__).parent
tpl = (here / "index.template.html").read_text(encoding="utf-8")

parts = {
    "__VEROVIO_JS__": (here / "verovio.js").read_text(encoding="utf-8"),
    "__OMR_JS__": (here / "omr.js").read_text(encoding="utf-8"),
    "__SCORE_JS__": (here / "score.js").read_text(encoding="utf-8"),
}
# MusicXML は <script type="text/plain"> に入れるので、閉じタグと解釈されないようにする
demo = (here / "demo.musicxml").read_text(encoding="utf-8")
parts["__DEMO_XML__"] = demo.replace("</script", "<\\/script")

out_text = tpl
for key, val in parts.items():
    if key not in out_text:
        raise SystemExit(f"テンプレートに {key} がありません")
    out_text = out_text.replace(key, val)

out = here / "index.html"
out.write_text(out_text, encoding="utf-8")
mb = out.stat().st_size / 1024 / 1024
print(f"{out} : {mb:.1f} MB")
for k, v in parts.items():
    print(f"  {k:<16} {len(v)//1024:>6} KB")

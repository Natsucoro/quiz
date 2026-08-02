#!/usr/bin/env python3
"""index.template.html に移調デモのデータを流し込んで index.html を作る。

デモデータ (demo_data.json) は spike/build_demo.py で生成する。
"""
import json, pathlib, sys

here = pathlib.Path(__file__).parent
tpl = (here / "index.template.html").read_text(encoding="utf-8")

data_path = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else here / "demo_data.json"
data = json.loads(data_path.read_text(encoding="utf-8"))

# <script type="application/json"> の中で閉じタグと解釈されないようにエスケープする
blob = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")

out = here / "index.html"
out.write_text(tpl.replace("__DEMO_DATA__", blob), encoding="utf-8")
print(f"{out} : {out.stat().st_size // 1024} KB  (移調 {len(data)} 段階)")

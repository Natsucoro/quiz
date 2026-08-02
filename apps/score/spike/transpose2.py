"""オクターブ移動と、PDF/MIDI 出力の検証"""
from music21 import converter, interval, note, pitch
import verovio, cairosvg, io

src = converter.parse("spike/mozart_truth.musicxml")

def rng(sc):
    ps = [p.midi for n in sc.flatten().notes for p in n.pitches]
    return min(ps), max(ps)

lo0, hi0 = rng(src)
print(f"原曲の音域        : MIDI {lo0}–{hi0} ({pitch.Pitch(midi=lo0).nameWithOctave}〜{pitch.Pitch(midi=hi0).nameWithOctave})")
for lbl, iv in [("1oct上", "P8"), ("2oct上", "P15"), ("1oct下", "-P8")]:
    t = src.transpose(interval.Interval(iv))
    lo, hi = rng(t)
    warn = ""
    if hi > 108: warn = " ⚠ ピアノ音域(MIDI21-108)を超過"
    if lo < 21: warn = " ⚠ ピアノ音域を下回る"
    print(f"{lbl:<16}: MIDI {lo}–{hi} ({pitch.Pitch(midi=lo).nameWithOctave}〜{pitch.Pitch(midi=hi).nameWithOctave}){warn}")

# 実用パス: 長2度上げ -> Verovio描画 -> PDF & MIDI
t = src.transpose(interval.Interval("M2"))
xml = t.write('musicxml')
tk = verovio.toolkit()
tk.setOptions({"pageWidth":2100,"pageHeight":2970,"scale":45,"adjustPageHeight":False,"footer":"none","header":"none"})
assert tk.loadData(open(xml).read())
pages = tk.getPageCount()
svgs = [tk.renderToSVG(i+1) for i in range(pages)]
cairosvg.svg2pdf(bytestring=svgs[0].encode(), write_to="spike/transposed_M2.pdf")
cairosvg.svg2png(bytestring=svgs[0].encode(), write_to="spike/transposed_M2.png", output_width=1400, background_color="white")
mid = tk.renderToMIDI()
open("spike/transposed_M2.mid","wb").write(__import__("base64").b64decode(mid))
import os
print(f"\nVerovio: {pages}ページ描画  PDF={os.path.getsize('spike/transposed_M2.pdf')}B  MIDI={os.path.getsize('spike/transposed_M2.mid')}B")
print("→ 移調 → 再組版 → PDF/MIDI まで一気通貫で成功")

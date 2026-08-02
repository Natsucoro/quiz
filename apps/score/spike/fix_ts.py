"""仮説検証: 拍子記号を1回与えるだけで連桁・小節割りが復活するか"""
from music21 import converter, meter, stream
import verovio, cairosvg

def render(xml_text, png, w=1500):
    tk = verovio.toolkit()
    tk.setOptions({"pageWidth":2100,"pageHeight":2600,"scale":42,"adjustPageHeight":True,
                   "footer":"none","header":"none"})
    assert tk.loadData(xml_text)
    cairosvg.svg2png(bytestring=tk.renderToSVG(1).encode(), write_to=png,
                     output_width=w, background_color="white")

for tag, ts in [("mozart_photo","4/4"), ("joplin_photo","2/4")]:
    sc = converter.parse(f"out/{tag}.musicxml")
    fixed = stream.Score()
    for part in sc.parts:
        flat = part.flatten().notesAndRests.stream()
        p = stream.Part()
        p.insert(0, meter.TimeSignature(ts))
        for el in flat:
            p.insert(el.offset, el)
        p.makeNotation(inPlace=True)      # 小節割り直し + 連桁の自動生成
        fixed.insert(0, p)
    out = fixed.write('musicxml')
    render(open(out).read(), f"spike/{tag}_fixed.png")
    nb = sum(1 for n in fixed.flatten().notes if getattr(n,'beams',None) and len(n.beams))
    print(f"[{tag}] 拍子{ts}を付与 → 小節数 {len(fixed.parts[0].getElementsByClass('Measure'))} / 連桁の付いた音符 {nb}個")

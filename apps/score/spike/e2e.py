"""一気通貫: OMR出力 -> 移調 -> 再組版 -> PDF"""
from music21 import converter, interval, key
import verovio, cairosvg, os

def render(xml_text, png, pdf=None, width=1500):
    tk = verovio.toolkit()
    tk.setOptions({"pageWidth":2100,"pageHeight":2400,"scale":42,"adjustPageHeight":True,
                   "footer":"none","header":"none"})
    assert tk.loadData(xml_text), "verovio load failed"
    svg = tk.renderToSVG(1)
    cairosvg.svg2png(bytestring=svg.encode(), write_to=png, output_width=width, background_color="white")
    if pdf: cairosvg.svg2pdf(bytestring=svg.encode(), write_to=pdf)
    return tk.getPageCount()

for tag in ["mozart_photo", "joplin_photo"]:
    src = converter.parse(f"out/{tag}.musicxml")
    k0 = src.analyze('key')
    render(open(f"out/{tag}.musicxml").read(), f"spike/{tag}_omr.png")
    t = src.transpose(interval.Interval("M2"))
    k1 = t.analyze('key')
    xml = t.write('musicxml')
    pages = render(open(xml).read(), f"spike/{tag}_omr_M2.png", f"spike/{tag}_omr_M2.pdf")
    sz = os.path.getsize(f"spike/{tag}_omr_M2.pdf")
    print(f"[{tag}] {k0} → 長2度上げ → {k1} / {pages}ページ / PDF {sz:,}B  ✓")

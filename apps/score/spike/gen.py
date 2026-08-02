"""正解つきテスト楽譜を生成: MusicXML -> Verovio SVG -> PNG -> 「スマホ写真」風の劣化画像"""
import io, math, numpy as np, cv2, cairosvg, verovio
from music21 import corpus, converter

OUT = "spike"

def make_score(corpus_path, n_measures, tag):
    s = corpus.parse(corpus_path)
    ex = s.measures(1, n_measures)
    xml_path = f"{OUT}/{tag}_truth.musicxml"
    ex.write('musicxml', fp=xml_path)
    return xml_path

def render_png(xml_path, tag, dpi=200):
    tk = verovio.toolkit()
    tk.setOptions({
        "pageWidth": 2100, "pageHeight": 2970,   # A4 (1/10mm)
        "scale": 45, "adjustPageHeight": False,
        "footer": "none", "header": "none",
    })
    with open(xml_path) as f:
        ok = tk.loadData(f.read())
    assert ok, f"verovio load failed: {xml_path}"
    pages = tk.getPageCount()
    svg = tk.renderToSVG(1)
    png_path = f"{OUT}/{tag}_clean.png"
    # A4 210mm 幅 -> dpi 換算
    px_w = int(210 / 25.4 * dpi)
    cairosvg.svg2png(bytestring=svg.encode(), write_to=png_path,
                     output_width=px_w, background_color="white")
    return png_path, pages

def simulate_phone_photo(png_path, tag, seed=0):
    """台形歪み + 照明ムラ + 影 + 手ブレ + JPEG圧縮 でスマホ撮影を再現"""
    rng = np.random.default_rng(seed)
    img = cv2.imread(png_path)
    h, w = img.shape[:2]
    # 1) 少し余白を足して紙が浮いてる感じに
    pad = int(w * 0.06)
    img = cv2.copyMakeBorder(img, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=(245,243,238))
    h, w = img.shape[:2]
    # 2) 台形歪み(カメラを斜めから構えた想定)
    d = w * 0.035
    src = np.float32([[0,0],[w,0],[w,h],[0,h]])
    dst = np.float32([[d*rng.uniform(.6,1.4), d*rng.uniform(.3,1.0)],
                      [w-d*rng.uniform(.3,1.0), d*rng.uniform(.6,1.4)],
                      [w-d*rng.uniform(.6,1.4), h-d*rng.uniform(.3,1.0)],
                      [d*rng.uniform(.3,1.0), h-d*rng.uniform(.6,1.4)]])
    M = cv2.getPerspectiveTransform(src, dst)
    img = cv2.warpPerspective(img, M, (w,h), borderValue=(150,148,145))
    # 3) 照明ムラ(左上が明るく右下が暗い) + 影
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    grad = 1.0 - 0.32*((xx/w)*0.6 + (yy/h)*0.8)/1.4
    shadow = 1.0 - 0.22*np.exp(-((xx-w*0.82)**2/(2*(w*0.30)**2) + (yy-h*0.86)**2/(2*(h*0.30)**2)))
    img = np.clip(img.astype(np.float32) * (grad*shadow)[...,None], 0, 255)
    # 4) 手ブレ + ノイズ
    img = cv2.GaussianBlur(img, (3,3), 0.8)
    img = np.clip(img + rng.normal(0, 3.5, img.shape), 0, 255).astype(np.uint8)
    # 5) スマホ解像度に縮小 + JPEG圧縮
    target_w = 1836   # 一般的な 3:4 スマホ撮影の短辺相当
    img = cv2.resize(img, (target_w, int(h*target_w/w)), interpolation=cv2.INTER_AREA)
    out = f"{OUT}/{tag}_photo.jpg"
    cv2.imwrite(out, img, [cv2.IMWRITE_JPEG_QUALITY, 82])
    return out

for tag, path, nm in [("mozart", "mozart/k545/movement1_exposition", 12),
                      ("joplin", "joplin/maple_leaf_rag", 12)]:
    xml = make_score(path, nm, tag)
    png, pages = render_png(xml, tag)
    jpg = simulate_phone_photo(png, tag, seed=hash(tag) % 1000)
    sc = converter.parse(xml)
    notes = len(sc.flatten().notes)
    print(f"[{tag}] truth={xml} notes={notes} pages={pages}")
    print(f"        clean={png}  photo={jpg}")

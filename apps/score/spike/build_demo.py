"""移調デモ用データ生成: -12〜+12半音の25段階。SVG + 再生用ノートイベント + 調名"""
import verovio, re, json, base64, os
from music21 import corpus, midi as m21midi
NOTE_ON = m21midi.ChannelVoiceMessages.NOTE_ON

corpus.parse("mozart/k545/movement1_exposition").measures(1, 8).write(
    'musicxml', fp='spike/demo8.musicxml')
SRC = open('spike/demo8.musicxml').read()
# music21 が付ける "MusicXML Part" のラベルを消す（譜面に出てしまうため）
SRC = re.sub(r'<part-name[^>]*>.*?</part-name>', '<part-name print-object="no"/>', SRC, flags=re.S)
SRC = re.sub(r'<part-abbreviation[^>]*>.*?</part-abbreviation>', '', SRC, flags=re.S)

UP   = [None,"m2","M2","m3","M3","P4","A4","P5","m6","M6","m7","M7","P8"]
KEY  = ["ハ長調","変ニ長調","ニ長調","変ホ長調","ホ長調","ヘ長調","嬰ヘ長調",
        "ト長調","変イ長調","イ長調","変ロ長調","ロ長調"]

def interval_for(n):
    if n == 0: return None
    return UP[n] if n > 0 else "-" + UP[-n]

def build(iv):
    tk = verovio.toolkit()
    o = {"pageWidth":1500,"pageHeight":2200,"scale":56,"adjustPageHeight":True,
         "footer":"none","header":"none","svgRemoveXlink":True}
    if iv: o["transpose"] = iv
    tk.setOptions(o); assert tk.loadData(SRC)
    svg = tk.renderToSVG(1)
    tmap = tk.renderToTimemap({"includeRests": False})
    if isinstance(tmap, str): tmap = json.loads(tmap)
    mf = m21midi.MidiFile(); mf.readstr(base64.b64decode(tk.renderToMIDI()))
    tpq = mf.ticksPerQuarterNote
    ons = []
    for tr in mf.tracks:
        t = 0
        for e in tr.events:
            if hasattr(e, 'time') and e.time is not None and e.isDeltaTime(): t += e.time
            elif e.type is NOTE_ON and e.velocity > 0: ons.append((t, e.pitch))
    ons.sort()
    by_q = {}
    for tick, p in ons: by_q.setdefault(round(tick/tpq, 4), []).append(p)
    ev = []
    for ent in tmap:
        ids = ent.get("on") or []
        if not ids: continue
        ps = by_q.get(round(ent["qstamp"], 4), [])
        for i, nid in enumerate(ids):
            if i < len(ps): ev.append({"t": round(ent["tstamp"]), "id": nid, "m": ps[i]})
    return svg, ev, max(e["tstamp"] for e in tmap) + 600

out = {}
for n in range(-12, 13):
    svg, ev, dur = build(interval_for(n))
    svg = re.sub(r'<desc>.*?</desc>', '', svg, flags=re.S)
    svg = re.sub(r'(\d+\.\d)\d+', r'\1', svg)          # 小数1桁に丸める
    svg = re.sub(r'\s+', ' ', svg)
    out[str(n)] = {"svg": svg, "ev": ev, "key": KEY[n % 12], "dur": dur}

json.dump(out, open("spike/demo_data.json","w"), ensure_ascii=False, separators=(",",":"))
base = sorted(e["m"] for e in out["0"]["ev"])
ok = all(sorted(e["m"] for e in out[str(n)]["ev"]) == [p+n for p in base] for n in range(-12,13))
print(f"25段階すべて生成。音高の検算: {'✅ 全段階が半音数どおり' if ok else '❌'}")
print(f"調名: -12→{out['-12']['key']} / 0→{out['0']['key']} / +2→{out['2']['key']} / +12→{out['12']['key']}")
print(f"音域: 原調 MIDI {min(base)}〜{max(base)} / 1oct下 {min(base)-12} / 1oct上 {max(base)+12}")
print(f"データ: {os.path.getsize('spike/demo_data.json')//1024} KB")

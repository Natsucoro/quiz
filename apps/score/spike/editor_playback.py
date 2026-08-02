"""エディタと再生の前提検証:
   (1) SVGの音符にIDが振られ、データ側の音符と対応づくか
   (2) 再生位置と音符IDの対応表(timemap)が取れるか
   (3) 移調後のMIDIが正しい音高になっているか"""
import json, base64, re, io
import verovio
from music21 import converter, interval

tk = verovio.toolkit()
tk.setOptions({"pageWidth":2100,"pageHeight":2970,"scale":45,"adjustPageHeight":True,
               "footer":"none","header":"none"})
src = open("spike/mozart_truth.musicxml").read()
assert tk.loadData(src)

# --- (1) SVG内のIDを調べる ---
svg = tk.renderToSVG(1)
note_ids = re.findall(r'class="note"[^>]*id="([^"]+)"', svg) or re.findall(r'id="([^"]+)"[^>]*class="note"', svg)
print(f"(1) SVG内の音符要素: {len(note_ids)}個  例: {note_ids[:4]}")
classes = sorted(set(re.findall(r'class="([a-z]+)"', svg)))
print(f"    付与されたclass: {[c for c in classes if c in ('note','rest','chord','measure','staff','layer','beam','slur','clef','keySig','meterSig','accid','tie','dynam')]}")

# MEIに変換して、同じIDが存在するか確認(= データ側と対応づくか)
mei = tk.getMEI()
mei_ids = set(re.findall(r'<note[^>]*xml:id="([^"]+)"', mei))
hit = sum(1 for i in note_ids if i in mei_ids)
print(f"    データ(MEI)側と一致したID: {hit}/{len(note_ids)}  → {'✅ タップで音符を特定できる' if hit==len(note_ids) and hit>0 else '❌'}")

# --- (2) timemap ---
tmap = tk.renderToTimemap({"includeRests": True, "includeMeasures": True})
if isinstance(tmap, str): tmap = json.loads(tmap)
withnotes = [e for e in tmap if e.get("on")]
print(f"\n(2) timemapのエントリ数: {len(tmap)}  発音イベント: {len(withnotes)}")
print(f"    例: {json.dumps(withnotes[0], ensure_ascii=False)}")
sample_id = withnotes[0]["on"][0]
print(f"    先頭イベントの音符IDがSVGに存在するか: {'✅' if sample_id in note_ids else '❌'} ({sample_id})")
print(f"    → 再生時刻から光らせる音符を引ける")

# --- (3) 移調後のMIDIの音高 ---
def midi_pitches(b64):
    raw = base64.b64decode(b64); out=[]; i=0
    while i < len(raw)-2:
        if raw[i] & 0xF0 == 0x90 and raw[i+2] > 0: out.append(raw[i+1])
        i += 1
    return out

orig = set(midi_pitches(tk.renderToMIDI()))
t = converter.parse("spike/mozart_truth.musicxml").transpose(interval.Interval("M2"))
tk2 = verovio.toolkit(); tk2.setOptions({"footer":"none","header":"none"})
assert tk2.loadData(open(t.write('musicxml')).read())
trans = set(midi_pitches(tk2.renderToMIDI()))
shifted = {p+2 for p in orig}
print(f"\n(3) 原曲MIDIの音高種: {len(orig)}種 (最低{min(orig)}〜最高{max(orig)})")
print(f"    移調後MIDI    : {len(trans)}種 (最低{min(trans)}〜最高{max(trans)})")
print(f"    全音符がちょうど+2半音: {'✅' if trans == shifted else '❌ 差分=' + str(sorted(trans ^ shifted))}")

"""移調ロジックの検証: 半音数だけでは調号が破綻することを確認する"""
from music21 import converter, interval, key, clef, note

src = converter.parse("spike/mozart_truth.musicxml")   # ハ長調
orig_key = src.analyze('key')
print(f"原曲の調: {orig_key}")
print("-" * 62)
print(f"{'操作':<22}{'音程指定':<10}{'結果の調':<16}{'調号'}")
print("-" * 62)

# 「+1半音」に対応する音程は2通りある = 異名同音の選択が必要
cases = [
    ("+1半音 (増1度)", "A1"), ("+1半音 (短2度)", "m2"),
    ("+2半音 (長2度)", "M2"), ("+2半音 (減3度)", "d3"),
    ("+3半音 (短3度)", "m3"), ("+4半音 (長3度)", "M3"),
    ("+5半音 (完全4度)", "P4"), ("+6半音 (増4度)", "A4"),
    ("+6半音 (減5度)", "d5"), ("+7半音 (完全5度)", "P5"),
]
for label, iv in cases:
    t = src.transpose(interval.Interval(iv))
    k = t.analyze('key')
    ks = t.flatten().getElementsByClass(key.KeySignature)
    sharps = ks[0].sharps if ks else 0
    sign = f"♯{sharps}" if sharps > 0 else (f"♭{-sharps}" if sharps < 0 else "なし")
    print(f"{label:<22}{iv:<10}{str(k):<16}{sign}  ({interval.Interval(iv).semitones}半音)")

print("-" * 62)
# オクターブ移動: 音部記号を変えないと加線だらけになる
t8 = src.transpose(interval.Interval("P8"))
ns = list(t8.flatten().notes)
lo = min(n.pitch.midi for n in ns); hi = max(n.pitch.midi for n in ns)
ns0 = list(src.flatten().notes)
lo0 = min(n.pitch.midi for n in ns0); hi0 = max(n.pitch.midi for n in ns0)
print(f"原曲の音域       : MIDI {lo0}-{hi0}  ({note.Note(midi=lo0).nameWithOctave}〜{note.Note(midi=hi0).nameWithOctave})")
print(f"1オクターブ上げ後: MIDI {lo}-{hi}  ({note.Note(midi=lo).nameWithOctave}〜{note.Note(midi=hi).nameWithOctave})")
print(f"※ ピアノの実音域は MIDI 21-108。上げすぎ判定と音部記号の切替が必要")

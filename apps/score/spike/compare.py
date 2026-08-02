"""OMR結果 vs 正解 の突き合わせ"""
import sys, difflib
from music21 import converter, key, meter

def profile(path):
    sc = converter.parse(path)
    fl = sc.flatten()
    pitches = []
    for n in sorted(fl.notes, key=lambda x: (float(x.offset), min(p.midi for p in x.pitches))):
        for p in sorted(n.pitches, key=lambda p: p.midi):
            pitches.append(p.midi)
    ks = fl.getElementsByClass(key.KeySignature)
    ts = fl.getElementsByClass(meter.TimeSignature)
    return {
        "notes": len(pitches),
        "measures": len(sc.parts[0].getElementsByClass('Measure')) if sc.parts else 0,
        "parts": len(sc.parts),
        "key": ks[0].sharps if ks else None,
        "time": ts[0].ratioString if ts else None,
        "pitches": pitches,
    }

truth, pred, label = sys.argv[1], sys.argv[2], sys.argv[3]
t = profile(truth)
try:
    p = profile(pred)
except Exception as e:
    print(f"{label}: 解析不能 {type(e).__name__}: {str(e)[:80]}"); sys.exit()

sm = difflib.SequenceMatcher(None, t["pitches"], p["pitches"], autojunk=False)
matched = sum(b.size for b in sm.get_matching_blocks())
recall = matched / max(1, t["notes"])
prec   = matched / max(1, p["notes"])
f1 = 2*prec*recall/max(1e-9, prec+recall)
print(f"■ {label}")
print(f"   音符数     正解{t['notes']:>4} / 認識{p['notes']:>4}")
print(f"   小節数     正解{t['measures']:>4} / 認識{p['measures']:>4}   パート 正解{t['parts']}/認識{p['parts']}")
print(f"   調号       正解{t['key']} / 認識{p['key']}      拍子 正解{t['time']} / 認識{p['time']}")
print(f"   音高一致   再現率{recall:6.1%}  適合率{prec:6.1%}  F1 {f1:6.1%}")

"""音高だけでなくリズム・記号の再現率も測る"""
import sys, difflib
from music21 import converter, key, meter, expressions, dynamics, spanner, bar

def prof(path):
    sc = converter.parse(path); fl = sc.flatten()
    ev = []
    for n in sorted(fl.notes, key=lambda x: (float(x.offset), min(p.midi for p in x.pitches))):
        ev.append((min(p.midi for p in n.pitches), round(float(n.quarterLength), 3)))
    return {
        "pitch": [e[0] for e in ev],
        "pd":    ev,
        "ts":    [t.ratioString for t in fl.getElementsByClass(meter.TimeSignature)],
        "dyn":   len(fl.getElementsByClass(dynamics.Dynamic)),
        "slur":  len(sc.getElementsByClass(spanner.Slur)),
        "orn":   len(fl.getElementsByClass(expressions.Ornament)),
        "rep":   len([b for b in fl.getElementsByClass(bar.Repeat)]),
        "rest":  len(fl.notesAndRests) - len(fl.notes),
    }

def f1(a, b):
    m = sum(x.size for x in difflib.SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks())
    r, p = m/max(1,len(a)), m/max(1,len(b))
    return 2*r*p/max(1e-9, r+p)

print(f"{'':<16}{'音高':>8}{'音高+音価':>11}{'拍子':>8}{'強弱':>10}{'スラー':>9}{'装飾':>8}{'反復':>8}{'休符':>10}")
for tag, truth in [("mozart_clean","mozart"),("mozart_photo","mozart"),
                   ("joplin_clean","joplin"),("joplin_photo","joplin")]:
    t = prof(f"spike/{truth}_truth.musicxml"); p = prof(f"out/{tag}.musicxml")
    print(f"{tag:<16}{f1(t['pitch'],p['pitch']):>7.1%}{f1(t['pd'],p['pd']):>11.1%}"
          f"{(str(t['ts'][:1])+'→'+str(p['ts'][:1])).replace(' ',''):>16}"
          f"{t['dyn']}→{p['dyn']:<7}{t['slur']}→{p['slur']:<6}{t['orn']}→{p['orn']:<5}{t['rep']}→{p['rep']:<5}{t['rest']}→{p['rest']}")

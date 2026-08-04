#!/usr/bin/env python3
"""正解データを作り直す。

元は music21 コーパスから起こした MusicXML（gen.py が同時に書き出したもの）。
音符ひとつ＝符頭ひとつなので、和音は構成音の数だけ数える。
装飾音は符頭としては紙に載っているので、読み取り側が拾うのは正しい。数に入れる。

  *_truth.json    音高だけ（MIDI番号）
  *_truthpd.json  音高と音価（"MIDI/4分音符いくつ分"）
"""
import json, pathlib, sys
import xml.etree.ElementTree as ET

STEP = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
HERE = pathlib.Path(__file__).parent
SRC = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "truth-src"


def collect(path):
    root = ET.parse(path).getroot()
    pitches, pd = [], []
    for part in root.iter('part'):
        div = 1
        for measure in part.iter('measure'):
            for attr in measure.iter('divisions'):
                div = int(attr.text)
            for note in measure.iter('note'):
                if note.find('rest') is not None:
                    continue
                p = note.find('pitch')
                if p is None:
                    continue
                step = STEP[p.findtext('step')]
                octv = int(p.findtext('octave'))
                alter = int(float(p.findtext('alter') or 0))
                midi = (octv + 1) * 12 + step + alter
                pitches.append(midi)
                # 装飾音には <duration> が無い。符頭としては最短の16分とみなす
                d = note.findtext('duration')
                q = (int(d) / div) if d else 0.25
                pd.append(f"{midi}/{q}")
    return pitches, pd


for tag in ('mozart', 'joplin'):
    src = SRC / f"{tag}_truth.musicxml"
    pitches, pd = collect(src)
    (HERE / f"{tag}_truth.json").write_text(json.dumps(pitches), encoding="utf-8")
    (HERE / f"{tag}_truthpd.json").write_text(json.dumps(pd), encoding="utf-8")
    print(f"{tag}: {len(pitches)} 音")

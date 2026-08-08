#!/usr/bin/env python3
"""任意の MusicXML を正解データ(*_truth.json 等)と突き合わせて3つのF1を出す。
   使い方: python3 score_xml.py 出力.musicxml 曲名(mozart|joplin)
   他エンジン(oemer 等)と自作エンジンを同じ物差しで比べるための道具。"""
import sys, json, re, os
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
STEP = {'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}

def walk(path):
    # 名前空間や DOCTYPE を無視して parse
    txt = open(path, encoding='utf-8', errors='replace').read()
    txt = re.sub(r'<!DOCTYPE[^>]*>', '', txt)
    txt = re.sub(r'xmlns="[^"]*"', '', txt, count=1)
    root = ET.fromstring(txt)
    pitches, pds, onsets = [], [], []
    for part in root.iter('part'):
        div = 1; t = 0.0
        for meas in part.iter('measure'):
            d = meas.find('.//divisions')
            if d is not None: div = float(d.text)
            mt = 0.0; prev = 0.0; mmax = 0.0
            for el in meas:
                if el.tag == 'backup':
                    mt -= float(el.find('duration').text)/div; prev = 0; continue
                if el.tag == 'forward':
                    mt += float(el.find('duration').text)/div; continue
                if el.tag != 'note': continue
                dur_el = el.find('duration')
                dur = float(dur_el.text)/div if dur_el is not None else 0.0
                chord = el.find('chord') is not None
                at = mt - prev if chord else mt
                p = el.find('pitch')
                if p is not None:
                    midi = (int(p.find('octave').text)+1)*12 + STEP[p.find('step').text]
                    alt = p.find('alter')
                    if alt is not None: midi += int(round(float(alt.text)))
                    pitches.append(midi)
                    pds.append(f"{midi}/{dur:g}")
                    onsets.append(f"{midi}@{round((t+at)*4)/4:.2f}")
                if not chord:
                    prev = dur; mt += dur
                mmax = max(mmax, mt)
            t += mmax
    return pitches, pds, onsets

def f1(truth, got):
    from collections import Counter
    T, G = Counter(map(str, truth)), Counter(map(str, got))
    it = sum(min(v, G[k]) for k, v in T.items())
    r = it/max(1, sum(T.values())); p = it/max(1, sum(G.values()))
    return 2*r*p/(r+p) if r+p else 0.0, r, p

if __name__ == '__main__':
    xml_path, piece = sys.argv[1], sys.argv[2]
    load = lambda n: json.load(open(os.path.join(HERE, f'{piece}_{n}.json')))
    pitches, pds, onsets = walk(xml_path)
    fP, rP, pP = f1(load('truth'), pitches)
    fD, rD, pD = f1(load('truthpd'), pds)
    fT, rT, pT = f1(load('truthtime'), onsets)
    print(f"{os.path.basename(xml_path)} vs {piece}: 音数{len(pitches)}")
    print(f"  音高F1 {fP*100:.1f}% (再現{rP*100:.1f} 適合{pP*100:.1f})")
    print(f"  音高+音価F1 {fD*100:.1f}% (再現{rD*100:.1f} 適合{pD*100:.1f})")
    print(f"  鳴り出しF1 {fT*100:.1f}% (再現{rT*100:.1f} 適合{pT*100:.1f})")

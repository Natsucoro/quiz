#!/usr/bin/env python3
"""
イントロベット 倍率キャリブレーション

仕様書 §4.3 の候補提示アルゴリズムをシミュレーションし、
「表示されたワードが正解である確率」を実測して倍率を算出する。

倍率を素の出現率の逆数(1/p)にしてはいけない。
「正解2個以上になるまで引き直す」処理が入っているため、
表示されたワードの正解率は本来の出現率より押し上げられるからである。
必ずこのスクリプトの実測値を使うこと。

使い方:
    python3 scripts/simulate-odds.py [--min-correct 2] [--rounds 200000]

楽曲データが揃ったら WORD_TIERS を実データの出現率に差し替えること。
"""
import argparse, collections, json, random

# 実データが入るまでの暫定値。(出現率の下限, 上限, 1ラウンドの表示枠数)
WORD_TIERS = {
    'common':   (0.35, 0.60, 2),
    'uncommon': (0.15, 0.35, 2),
    'rare':     (0.05, 0.15, 2),
    'jackpot':  (0.02, 0.05, 0),  # 30%の確率で rare 1枠と入れ替わる
}
JACKPOT_SWAP_RATE = 0.30
HOUSE_EDGE = 0.00           # MVPは控除なし。引き締めたくなったら 0.05 程度
MAX_REDRAWS = 50            # これを超えたらフォールバック（歌詞のワードを直接ねじ込む）


def draw_candidates(rng):
    """曲を一切見ずに、辞書からティア別に候補6個を抽出する。"""
    swap = rng.random() < JACKPOT_SWAP_RATE
    slots = []
    for tier, (lo, hi, n) in WORD_TIERS.items():
        count = n
        if tier == 'rare' and swap:
            count -= 1
        if tier == 'jackpot' and swap:
            count = 1
        for _ in range(count):
            slots.append((tier, rng.uniform(lo, hi)))
    return slots


def simulate(min_correct, rounds, seed=42):
    rng = random.Random(seed)
    shown = collections.Counter()
    hit = collections.Counter()
    correct_counts = []
    redraws = []
    fallbacks = 0

    for _ in range(rounds):
        for attempt in range(1, MAX_REDRAWS + 1):
            result = [(t, p, rng.random() < p) for t, p in draw_candidates(rng)]
            if sum(1 for _, _, c in result if c) >= min_correct:
                break
        else:
            fallbacks += 1
        redraws.append(attempt)
        correct_counts.append(sum(1 for _, _, c in result if c))
        for tier, _p, is_correct in result:
            shown[tier] += 1
            if is_correct:
                hit[tier] += 1

    odds = {}
    for tier in WORD_TIERS:
        if not shown[tier]:
            continue
        q = hit[tier] / shown[tier]
        odds[tier] = {
            'hit_rate': round(q, 4),
            'odds': round((1 - HOUSE_EDGE) / q, 1),
        }

    return {
        'min_correct': min_correct,
        'rounds': rounds,
        'house_edge': HOUSE_EDGE,
        'tiers': odds,
        'avg_correct_per_round': round(sum(correct_counts) / rounds, 2),
        'correct_distribution': {
            str(k): round(v / rounds, 3)
            for k, v in sorted(collections.Counter(correct_counts).items())
        },
        'avg_redraws': round(sum(redraws) / rounds, 2),
        'fallback_rate': round(fallbacks / rounds, 5),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--min-correct', type=int, default=2,
                    help='1ラウンドで保証する正解数の下限（2=当てやすい / 1=倍率に夢がある）')
    ap.add_argument('--rounds', type=int, default=200_000)
    ap.add_argument('--json', action='store_true', help='JSONだけを出力する')
    args = ap.parse_args()

    r = simulate(args.min_correct, args.rounds)
    if args.json:
        print(json.dumps(r, ensure_ascii=False, indent=2))
        return

    print(f"=== 正解{r['min_correct']}個以上を保証 / {r['rounds']:,}ラウンド ===")
    for tier, v in r['tiers'].items():
        print(f"  {tier:9s} 表示時の正解率 {v['hit_rate']*100:5.1f}%  → 倍率 {v['odds']:6.1f}倍")
    print(f"\n  1ラウンドの平均正解数: {r['avg_correct_per_round']}")
    print("  正解数の分布: " + "  ".join(
        f"{k}個 {v*100:.0f}%" for k, v in r['correct_distribution'].items() if v >= 0.01))
    print(f"  平均引き直し回数: {r['avg_redraws']}")
    print(f"  フォールバック率: {r['fallback_rate']*100:.3f}%")


if __name__ == '__main__':
    main()

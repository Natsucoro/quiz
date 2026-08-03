/* ブラウザ内で動く軽量OMR。
 *
 * 対象は「このアプリ自身が作った、まっすぐで白黒のページ」に限る。
 * 汎用のOMRではなく、入力の素性が分かっている前提で単純な手法だけを使う。
 *
 *   1. 行ごとの黒画素数から五線を見つける
 *   2. 五線を2段ずつまとめて大譜表とみなす
 *   3. 積分画像で「符頭らしい塗り」を総当たりで探す（塗りつぶし／白抜きの両方）
 *   4. 五線からの高さで音の高さを決める
 *
 * 音価（音の長さ）は読み取らない。M0の検証では、学習済みモデルでも
 * 複雑な曲では74%しか合わなかった箇所であり、単純な手法では歯が立たない。
 */
(function (global) {
  "use strict";

  /** RGBA の ImageData を 0/1 の二値配列にする（黒=1） */
  function binarize(img) {
    const { width: W, height: H, data } = img;
    const bin = new Uint8Array(W * H);
    for (let i = 0, p = 0; i < bin.length; i++, p += 4) {
      bin[i] = (data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114) < 128 ? 1 : 0;
    }
    return { bin, W, H };
  }

  /** 積分画像。矩形内の黒画素数を O(1) で数えられるようにする */
  function integral(bin, W, H) {
    const W1 = W + 1, ii = new Int32Array(W1 * (H + 1));
    for (let y = 0; y < H; y++) {
      let run = 0;
      for (let x = 0; x < W; x++) {
        run += bin[y * W + x];
        ii[(y + 1) * W1 + x + 1] = ii[y * W1 + x + 1] + run;
      }
    }
    return ii;
  }
  const rectSum = (ii, W1, x0, y0, x1, y1) =>
    ii[(y1 + 1) * W1 + x1 + 1] - ii[y0 * W1 + x1 + 1] - ii[(y1 + 1) * W1 + x0] + ii[y0 * W1 + x0];

  /** 残った傾きを見つける。
   *  四隅を指で合わせる以上、わずかなズレは必ず残る。1290px幅で0.5°傾くだけで
   *  11px ずれ、1本の五線が複数の行にまたがって「長い横の連なり」が消えてしまう。
   *  縦に潰した黒画素の分布がいちばん尖る傾きを探す。 */
  function estimateShear(bin, W, H) {
    const cx = W / 2;
    // 縦は1行も飛ばさない。太さ1〜2画素の五線は、間引くと丸ごと抜け落ちる。
    // 代わりに列のほうを間引いて速さを保つ。
    const score = s => {
      const acc = new Int32Array(H);
      for (let x = 0; x < W; x += 4) {
        const dy = Math.round(s * (x - cx));
        const y0 = Math.max(0, -dy), y1 = Math.min(H, H - dy);
        for (let y = y0; y < y1; y++) acc[y] += bin[(y + dy) * W + x];
      }
      let sum = 0;
      for (let y = 0; y < H; y++) sum += acc[y] * acc[y];
      return sum;
    };
    let best = 0, bestScore = score(0);
    for (let s = -0.09; s <= 0.0901; s += 0.005) {           // ±5度をざっと
      const v = score(s);
      if (v > bestScore) { bestScore = v; best = s; }
    }
    for (let s = best - 0.005; s <= best + 0.0051; s += 0.0008) {   // そのまわりを細かく
      const v = score(s);
      if (v > bestScore) { bestScore = v; best = s; }
    }
    return best;
  }

  /** 見つけた傾きぶんだけ、列ごとに縦へずらして水平に直す */
  function deshear(bin, W, H, s) {
    if (!s) return bin;
    const out = new Uint8Array(W * H);
    const cx = W / 2;
    for (let x = 0; x < W; x++) {
      const dy = Math.round(s * (x - cx));
      const y0 = Math.max(0, -dy), y1 = Math.min(H, H - dy);
      for (let y = y0; y < y1; y++) out[y * W + x] = bin[(y + dy) * W + x];
    }
    return out;
  }

  /** 五線の候補行をまとめる。
   *  黒画素の総数では、符頭や符尾が密な行と区別がつかず帯が融合してしまう。
   *  五線だけが持つ「長く途切れない横の連なり」を数える。 */
  function findStaffLines(bin, W, H, sensitivity) {
    const k = sensitivity || 1;
    const minRun = Math.max(12, Math.round(W / 45));
    const BRIDGE = 2;   // 印刷のかすれで五線は点線状に途切れる。数画素の隙間は繋がっているとみなす
    const dens = new Int32Array(H);
    for (let y = 0; y < H; y++) {
      const off = y * W;
      let score = 0, run = 0, gap = 0;
      for (let x = 0; x < W; x++) {
        if (bin[off + x]) { run += gap + 1; gap = 0; }
        else if (run) {
          gap++;
          if (gap > BRIDGE) { if (run >= minRun) score += run; run = 0; gap = 0; }
        }
      }
      if (run >= minRun) score += run;
      dens[y] = score;
    }
    let peak = 0;
    for (let y = 0; y < H; y++) if (dens[y] > peak) peak = dens[y];
    if (peak < W * 0.10) return [];
    // しきい値はページ幅ではなく「いちばん長い五線」を基準にする。
    // ページ幅を基準にすると、余白の取り方が変わっただけで検出が崩れる。
    const thr = peak * 0.22 * k;
    const lines = [];
    let y = 0;
    while (y < H) {
      if (dens[y] >= thr) {
        let y2 = y;
        while (y2 + 1 < H && dens[y2 + 1] >= thr) y2++;
        lines.push({ y: (y + y2) / 2, thickness: y2 - y + 1, span: dens[(y + y2) >> 1] });
        y = y2 + 1;
      } else y++;
    }
    return lines;
  }

  /** 5本ずつ等間隔に並ぶものを1つの五線としてまとめる。
   *  かすれた線は断片に割れて出てくるので、先に近すぎるものを1本に統合する。 */
  function groupStaves(lines, knownS) {
    if (lines.length < 5) return [];

    /** ごく近い行はまず1本にまとめる（同じ線が2〜3行に分かれて出るため） */
    const join = (src, limit) => {
      const out = [];
      for (const l of src) {
        const last = out[out.length - 1];
        if (last && l.y - last.y < limit) {
          const w = last.thickness + l.thickness;
          last.y = (last.y * last.thickness + l.y * l.thickness) / w;
          last.thickness = w;
        } else out.push({ y: l.y, thickness: l.thickness });
      }
      return out;
    };
    let ls = join(lines, 3);

    // 線間は「いちばん多く現れる間隔」で決める。
    // 中央値だと、かすれて割れた線が作る細かい間隔に引きずられる。
    let S = knownS;
    if (!S) {
      const hist = new Map();
      for (let i = 1; i < ls.length; i++) {
        const g = Math.round(ls[i].y - ls[i - 1].y);
        if (g >= 4 && g <= 60) hist.set(g, (hist.get(g) || 0) + 1);
      }
      let best = 0, bestScore = 0;
      for (const [g] of hist) {
        const sc = (hist.get(g - 1) || 0) + (hist.get(g) || 0) + (hist.get(g + 1) || 0);
        if (sc > bestScore) { bestScore = sc; best = g; }
      }
      if (!best) return [];
      // 代表値のまわりの実測から平均を取り直す
      let sum = 0, n = 0;
      for (let i = 1; i < ls.length; i++) {
        const g = ls[i].y - ls[i - 1].y;
        if (Math.abs(g - best) <= 1.6) { sum += g; n++; }
      }
      S = n ? sum / n : best;
    }
    if (!(S > 3)) return [];

    ls = join(ls, S * 0.45);

    const staves = [];
    for (let i = 0; i + 4 < ls.length; ) {
      const five = ls.slice(i, i + 5);
      const g = [];
      for (let k = 1; k < 5; k++) g.push(five[k].y - five[k - 1].y);
      const ok = g.every(v => v >= S * 0.72 && v <= S * 1.28);
      if (ok) {
        const mean = g.reduce((a, b) => a + b) / 4;
        staves.push({ lines: five.map(l => l.y), space: mean, top: five[0].y, bottom: five[4].y });
        i += 5;
      } else i++;
    }
    return staves;
  }

  /** 五線を消す。上下が白い細い横棒だけを白に戻す */
  function eraseStaffLines(bin, W, H, staves) {
    const out = Uint8Array.from(bin);
    for (const st of staves) {
      const t = Math.max(1, Math.round(st.space * 0.22));
      for (const ly of st.lines) {
        const y0 = Math.round(ly - t), y1 = Math.round(ly + t);
        for (let x = 0; x < W; x++) {
          const above = y0 - 1 >= 0 ? bin[(y0 - 1) * W + x] : 0;
          const below = y1 + 1 < H ? bin[(y1 + 1) * W + x] : 0;
          if (above || below) continue;          // 符頭や符尾が乗っている所は消さない
          for (let y = y0; y <= y1; y++) if (y >= 0 && y < H) out[y * W + x] = 0;
        }
      }
    }
    return out;
  }

  /** 各画素が属する「横に連なる黒の長さ」を求める。
   *  符頭は横に短く独立しているが、梁は横に長く続く。これが両者を分ける決め手になる。 */
  function horizontalRunLength(bin, W, H) {
    const run = new Int32Array(W * H);
    for (let y = 0; y < H; y++) {
      const off = y * W;
      let x = 0;
      while (x < W) {
        if (!bin[off + x]) { x++; continue; }
        let x2 = x;
        while (x2 + 1 < W && bin[off + x2 + 1]) x2++;
        const len = x2 - x + 1;
        for (let k = x; k <= x2; k++) run[off + k] = len;
        x = x2 + 1;
      }
    }
    return run;
  }

  /** 縦に連なる黒の長さ。音部記号・小節線・符尾は縦に長く、符頭は短い */
  function verticalRunLength(bin, W, H) {
    const run = new Int32Array(W * H);
    for (let x = 0; x < W; x++) {
      let y = 0;
      while (y < H) {
        if (!bin[y * W + x]) { y++; continue; }
        let y2 = y;
        while (y2 + 1 < H && bin[(y2 + 1) * W + x]) y2++;
        const len = y2 - y + 1;
        for (let k = y; k <= y2; k++) run[k * W + x] = len;
        y = y2 + 1;
      }
    }
    return run;
  }

  /** 符頭を探す。塗りつぶし（4分音符以下）と白抜き（2分・全音符）の両方 */
  function findNoteheads(ii, W1, W, H, staves, runLen, vRunLen) {
    const found = [];
    for (let si = 0; si < staves.length; si++) {
      const st = staves[si];
      const S = st.space;
      const maxRun = S * 2.6;   // これより横に長く続くものは梁や加線とみなす
      const maxVRun = S * 2.2;  // これより縦に長く続くものは音部記号や小節線とみなす
      const hw = Math.max(2, Math.round(S * 0.40));   // 判定窓の半幅
      const hh = Math.max(2, Math.round(S * 0.45));   // 半高。梁(太さ約0.5S)を弾くため符頭並みに取る
      const area = (hw * 2 + 1) * (hh * 2 + 1);
      const ihw = Math.max(1, Math.round(S * 0.20));  // 白抜きの内側
      const ihh = Math.max(1, Math.round(S * 0.16));
      const iarea = (ihw * 2 + 1) * (ihh * 2 + 1);
      // 符頭は上下のどちらかが必ず空いている。
      // 16分音符の二重の梁は「梁・すきま・梁」で判定窓が埋まってしまうため、
      // この上下の空きを見ないと梁を符頭と取り違える。
      const bw = Math.max(2, Math.round(S * 0.34));   // 空きを見る帯の半幅
      const bh = Math.max(1, Math.round(S * 0.22));   // 帯の高さ
      const barea = (bw * 2 + 1) * (bh + 1);
      const openSide = (x, y) => {
        const ay0 = y - hh - 1 - bh, by0 = y + hh + 1;
        if (ay0 < 0 || by0 + bh >= H) return true;
        const up = rectSum(ii, W1, x - bw, ay0, x + bw, ay0 + bh) / barea;
        const dn = rectSum(ii, W1, x - bw, by0, x + bw, by0 + bh) / barea;
        return Math.min(up, dn) < 0.45;
      };

      const yTop = Math.max(hh + bh + 2, Math.round(st.top - S * 4.2));
      const yBot = Math.min(H - hh - bh - 3, Math.round(st.bottom + S * 4.2));
      // 段の頭には音部記号・調号・拍子記号が並ぶ。ここは符頭が来ないので飛ばす
      const xFrom = Math.max(hw + bw, Math.round((st.xStart || 0) + S * 1.2));
      const xTo = Math.min(W - hw - bw - 1, Math.round(st.xEnd !== undefined ? st.xEnd : W));
      const cand = [];
      for (let y = yTop; y <= yBot; y++) {
        for (let x = xFrom; x <= xTo; x++) {
          const idx = y * W + x;
          if (runLen[idx] > maxRun) continue;    // 梁・加線の伸びた所を除く
          if (vRunLen[idx] > maxVRun) continue;  // 音部記号・小節線・符尾を除く
          const fill = rectSum(ii, W1, x - hw, y - hh, x + hw, y + hh) / area;
          if (fill >= 0.88) {
            if (openSide(x, y)) cand.push({ x, y, s: fill, staff: si, hollow: false });
          } else if (fill >= 0.42 && fill <= 0.78) {
            // 白抜き（2分・全音符）。中が白く、左右が黒い輪であること
            const inner = rectSum(ii, W1, x - ihw, y - ihh, x + ihw, y + ihh) / iarea;
            if (inner > 0.14) continue;
            const side = Math.max(2, Math.round(S * 0.10));
            const lf = rectSum(ii, W1, x - hw, y - ihh, x - hw + side, y + ihh) / ((side + 1) * (ihh * 2 + 1));
            const rf = rectSum(ii, W1, x + hw - side, y - ihh, x + hw, y + ihh) / ((side + 1) * (ihh * 2 + 1));
            if (lf < 0.62 || rf < 0.62) continue;
            if (openSide(x, y)) cand.push({ x, y, s: 0.87, staff: si, hollow: true });
          }
        }
      }
      // 重なりを間引く
      cand.sort((a, b) => b.s - a.s);
      const rx = S * 1.05, ry = S * 0.55, keep = [];
      for (const c of cand) {
        if (keep.some(k => Math.abs(k.x - c.x) < rx && Math.abs(k.y - c.y) < ry)) continue;
        keep.push(c);
      }
      found.push(...keep);
    }
    return found;
  }

  const LETTER_SEMI = [0, 2, 4, 5, 7, 9, 11];   // C D E F G A B
  const LETTER_NAME = ["C", "D", "E", "F", "G", "A", "B"];
  /** 全音階の通し番号 → MIDI番号 */
  function diaToMidi(d) {
    const oct = Math.floor(d / 7), le = ((d % 7) + 7) % 7;
    return (oct + 1) * 12 + LETTER_SEMI[le];
  }

  /**
   * @param {ImageData} img  白黒に補正済みのページ
   * @param {{clefs?: string[]}} opts  各五線の音部記号。省略時は上=ト音／下=ヘ音
   */
  function readScore(img, opts) {
    opts = opts || {};
    const raw = binarize(img);
    const W = raw.W, H = raw.H;
    // 先に傾きを取り除く。これをしないと五線がどの行にも揃わず検出できない
    const shear = estimateShear(raw.bin, W, H);
    const bin = deshear(raw.bin, W, H, shear);

    // 1回目は厳しく。確実な五線だけを取り、そこから線間を知る
    let staves = groupStaves(findStaffLines(bin, W, H, 1));
    if (!staves.length) return { staves: [], notes: [], W, H, shear, reason: "五線が見つかりませんでした" };
    const S = staves.reduce((a, s) => a + s.space, 0) / staves.length;

    // 2回目は緩く。小節数の少ない最終段は線が短く、音符で寸断されて
    // 1回目のしきい値に届かないことがある。線間が分かった今なら緩めても取り違えない
    const more = groupStaves(findStaffLines(bin, W, H, 0.45), S)
      .filter(s => Math.abs(s.space - S) <= S * 0.2);
    for (const c of more) {
      if (!staves.some(s => Math.abs(s.top - c.top) < S * 2)) staves.push(c);
    }
    staves.sort((a, b) => a.top - b.top);

    // 各五線が横方向にどこからどこまで引かれているかを測る
    const minRun2 = Math.max(12, Math.round(W / 45));
    for (const st of staves) {
      let lo = W, hi = 0;
      for (const ly of st.lines) {
        for (let dy = -1; dy <= 1; dy++) {
          const y = Math.round(ly) + dy;
          if (y < 0 || y >= H) continue;
          const off = y * W;
          let x = 0;
          while (x < W) {
            if (!bin[off + x]) { x++; continue; }
            let x2 = x;
            while (x2 + 1 < W && bin[off + x2 + 1]) x2++;
            if (x2 - x + 1 >= minRun2) { if (x < lo) lo = x; if (x2 > hi) hi = x2; }
            x = x2 + 1;
          }
        }
      }
      st.xStart = lo < hi ? lo : 0;
      st.xEnd = hi > lo ? hi : W - 1;
    }

    const cleaned = eraseStaffLines(bin, W, H, staves);
    const ii = integral(cleaned, W, H);
    const runLen = horizontalRunLength(cleaned, W, H);
    const vRunLen = verticalRunLength(cleaned, W, H);
    let heads = findNoteheads(ii, W + 1, W, H, staves, runLen, vRunLen);

    // 大譜表では上下の五線の走査範囲が重なるため、同じ符頭が二度出る。
    // 近すぎるものは、五線の中心に近いほうだけ残す。
    const S0 = staves.reduce((a, s) => a + s.space, 0) / staves.length;
    const mid = staves.map(s => (s.top + s.bottom) / 2);
    heads.sort((a, b) =>
      Math.abs(a.y - mid[a.staff]) - Math.abs(b.y - mid[b.staff]));
    const kept = [];
    for (const h of heads) {
      if (kept.some(k => Math.abs(k.x - h.x) < S0 * 1.05 && Math.abs(k.y - h.y) < S0 * 0.55)) continue;
      kept.push(h);
    }
    heads = kept;

    // 音部記号。指定がなければ大譜表とみなし、段の中で上をト音・下をヘ音にする
    const clefs = opts.clefs || staves.map((_, i) => (i % 2 === 0 ? "G" : "F"));
    const BASE = { G: 30, F: 18 };   // ト音の第1線=E4(30) / ヘ音の第1線=G2(18)

    const notes = heads.map(h => {
      const st = staves[h.staff];
      const step = Math.round((st.bottom - h.y) / (st.space / 2));
      const d = (BASE[clefs[h.staff]] !== undefined ? BASE[clefs[h.staff]] : BASE.G) + step;
      return {
        x: h.x, y: h.y, staff: h.staff, hollow: h.hollow,
        // 傾きを戻した座標。元の写真の上に重ねて描くときはこちらを使う
        yImg: h.y + shear * (h.x - W / 2),
        space: st.space, system: h.staff >> 1,
        dia: d, midi: diaToMidi(d),
        name: LETTER_NAME[((d % 7) + 7) % 7] + Math.floor(d / 7),
      };
    });
    // 段ごと・左から順に並べる
    notes.sort((a, b) => (a.staff >> 1) - (b.staff >> 1) || a.x - b.x || a.midi - b.midi);
    return { staves, notes, W, H, shear };
  }

  /** 半音の増減を「全音階で何段動くか」に直す。
   *  五線の上で音符が動く距離は半音数ではなく段数で決まる。
   *  例: +2半音(長2度)は1段、+3半音(短3度)は2段。 */
  const STEP_OF_SEMI = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6, 7];
  function semiToSteps(semi) {
    const sign = semi < 0 ? -1 : 1, a = Math.abs(semi);
    return sign * (Math.floor(a / 12) * 7 + STEP_OF_SEMI[a % 12]);
  }

  global.OMR = { readScore, diaToMidi, semiToSteps, LETTER_NAME };
})(typeof window !== "undefined" ? window : globalThis);

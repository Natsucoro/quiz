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
    // 基準は最大値ではなく上位値で取る。
    // 紙の外の暗い縁は幅いっぱいに連なるため最大値を押し上げ、
    // 基準が高くなりすぎて本物の五線が切り捨てられる。
    const nz = [];
    for (let y = 0; y < H; y++) if (dens[y] > 0) nz.push(dens[y]);
    if (!nz.length) return [];
    nz.sort((a, b) => a - b);
    const peak = nz[Math.min(nz.length - 1, Math.floor(nz.length * 0.97))];
    if (peak < W * 0.10) return [];

    // しきい値で切ると、線の周りの強い行まで拾って1本の帯に融合してしまう。
    // （実測: 間隔13pxの完璧な5本が、90px幅の1本の塊になって消えていた）
    // 代わりに「まわりより高い山」を線とみなす。線の強さがまちまちでも取りこぼさない。
    const floor = peak * 0.10 * k;
    const win = 3;
    const lines = [];
    for (let y = win; y < H - win; y++) {
      const v = dens[y];
      if (v < floor) continue;
      let isTop = true;
      for (let d = -win; d <= win; d++) {
        if (!d) continue;
        if (dens[y + d] > v) { isTop = false; break; }
        if (dens[y + d] === v && d < 0) { isTop = false; break; }   // 平らな頂は先頭だけ採る
      }
      if (!isTop) continue;
      // 同じ高さが続くときは、その真ん中を線の位置にする
      let y2 = y;
      while (y2 + 1 < H && dens[y2 + 1] === v) y2++;
      lines.push({ y: (y + y2) / 2, thickness: Math.max(1, y2 - y + 1), span: v });
      y = y2;
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
          last.span = Math.max(last.span || 1, l.span || 1);
        } else out.push({ y: l.y, thickness: l.thickness, span: l.span || 1 });
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

    // どの5本を1つの段とするかは、上から順にではなく「濃さと等間隔さ」で決める。
    // 濃い線と薄い線が6本以上並ぶ所を上から詰めて取ると、薄い線を巻き込んで
    // 段全体が1本ぶんずれる。ずれた段の音は丸ごと3度ずれる（実測でジョプリンの2段がこれ）。
    const cands = [];
    for (let i = 0; i + 4 < ls.length; i++) {
      const five = ls.slice(i, i + 5);
      const g = [];
      for (let k = 1; k < 5; k++) g.push(five[k].y - five[k - 1].y);
      if (!g.every(v => v >= S * 0.72 && v <= S * 1.28)) continue;
      const mean = g.reduce((a, b) => a + b) / 4;
      const dev = g.reduce((a, v) => a + Math.abs(v - mean), 0) / 4 / mean;
      const strength = five.reduce((a, l) => a + (l.span || 1), 0);
      cands.push({ i, five, mean, strength, score: strength * (1 - dev) });
    }
    cands.sort((a, b) => b.score - a.score);
    const staves = [], taken = [];
    for (const c of cands) {
      if (taken.some(t => Math.abs(t - c.i) <= 4)) continue;   // 線を分け合う組は採らない
      taken.push(c.i);
      staves.push({ lines: c.five.map(l => l.y), space: c.mean,
                    top: c.five[0].y, bottom: c.five[4].y, strength: c.strength });
    }
    staves.sort((a, b) => a.top - b.top);
    // 縦に重なる段は、線を掴み損ねてできた偽物。濃いほうを残す。
    // 重なったまま残すと大譜表の組が狂い、低音部が高音部として読まれる。
    for (let i = staves.length - 2; i >= 0; i--) {
      const a = staves[i], b = staves[i + 1];
      if (Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > S * 0.5) {
        if ((a.strength || 0) >= (b.strength || 0)) staves.splice(i + 1, 1);
        else staves.splice(i, 1);
      }
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

  /** 休符を探す。
   *
   *  休符が読めないと、小節の途中で音が前に詰まり、そこから後ろが全部ずれる。
   *  鳴らしたときにいちばん耳につくのがこれ。
   *
   *  見分け方は形の照合ではなく、置かれ方。休符は
   *    ・左右が空いている（符尾も梁も繋がっていない）
   *    ・五線のまん中あたりに、縦に細長く立っている
   *    ・縦にまっすぐ長い線を持たない（符尾や小節線と違う）
   *  4分休符は線間の2倍ほど、8分休符は1.3倍ほどの高さになる。
   *
   *  @param {Array} heads すでに見つけた符頭。臨時記号を休符と取り違えないため、
   *                       符頭のすぐ左にあるものは除く。
   */
  function findRests(bin, vRunLen, W, H, staves, heads) {
    const out = [];
    for (let si = 0; si < staves.length; si++) {
      const st = staves[si];
      const S = st.space;
      const y0 = Math.max(0, Math.round(st.top - S * 0.6));
      const y1 = Math.min(H - 1, Math.round(st.bottom + S * 0.6));
      const mid = (st.top + st.bottom) / 2;
      const xa = Math.max(0, Math.round(st.xMusic || 0));
      const xb = Math.min(W - 1, Math.round(st.xEnd || W - 1));
      const mine = heads.filter(h => h.staff === si);

      // 列ごとの黒の量を数え、白で切れる区間に分ける
      const col = new Int32Array(xb - xa + 1);
      for (let x = xa; x <= xb; x++) {
        let c = 0;
        for (let y = y0; y <= y1; y++) if (bin[y * W + x]) c++;
        col[x - xa] = c;
      }
      let i = 0;
      while (i < col.length) {
        if (!col[i]) { i++; continue; }
        let j = i;
        let gap = 0;
        while (j + 1 < col.length && (col[j + 1] || ++gap <= 1)) { j++; if (col[j]) gap = 0; }
        const x0 = xa + i, x1 = xa + j, w = x1 - x0 + 1;
        i = j + 1;
        if (w < S * 0.40 || w > S * 1.45) continue;
        // 縦の広がりと、まっすぐな縦線の長さを測る
        let ya = -1, yb = -1, vmax = 0;
        for (let x = x0; x <= x1; x++) {
          let run = 0;
          for (let y = y0; y <= y1; y++) {
            if (!bin[y * W + x]) { run = 0; continue; }
            if (ya < 0 || y < ya) ya = y;
            if (y > yb) yb = y;
            // 縦の連なりは五線の帯の中だけで測る。画像全体で測ると、
            // 帯の外へ伸びた符尾の長さを休符の一部と数えてしまう
            if (++run > vmax) vmax = run;
          }
        }
        if (ya < 0) continue;
        const h = yb - ya + 1;
        if (vmax > S * 3.6) continue;             // 小節線・段をまたぐ縦線はここで落ちる
        if (Math.abs((ya + yb) / 2 - mid) > S * 1.1) continue;   // 休符は五線のまん中に立つ
        // 符頭がすぐ近くにあるものは、臨時記号か符頭そのもの
        if (mine.some(n => n.x > x0 - S * 0.6 && n.x < x1 + S * 2.0)) continue;
        let q = 0;
        // 4分休符は五線の中2間ぶん、8分休符はその半分ほどの高さになる
        if (h >= S * 2.1 && h <= S * 3.7 && w >= S * 0.70) q = 1;
        else if (h >= S * 1.1 && h < S * 2.1 && w >= S * 0.55) q = 0.5;
        if (!q) continue;
        out.push({ x: (x0 + x1) / 2, staff: si, q });
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
      const xFrom = Math.max(hw + bw, Math.round(
        st.xMusic !== undefined ? st.xMusic : (st.xStart || 0) + S * 3.2));
      const xTo = Math.min(W - hw - bw - 1, Math.round(st.xEnd !== undefined ? st.xEnd : W));
      const cand = [];
      for (let y = yTop; y <= yBot; y++) {
        for (let x = xFrom; x <= xTo; x++) {
          const idx = y * W + x;
          if (runLen[idx] > maxRun) continue;    // 梁・加線の伸びた所を除く
          if (vRunLen[idx] > maxVRun) continue;  // 音部記号・小節線・符尾を除く
          const fill = rectSum(ii, W1, x - hw, y - hh, x + hw, y + hh) / area;
          if (fill >= 0.88) {
            // 真っ黒に見えても、2分音符の穴が塗りつぶされているだけのことがある。
            // 五線の上に乗った符頭では線が穴を横切るので、穴はごく細い筋になる。
            // 中心のまわりに残る白の量で、塗りつぶしと白抜きを分ける。
            // （これをしないと、この楽譜の左手の付点2分音符が全部4分音符になった）
            const cw = Math.max(2, Math.round(S * 0.34)), ch = Math.max(1, Math.round(S * 0.30));
            const carea = (cw * 2 + 1) * (ch * 2 + 1);
            const white = 1 - rectSum(ii, W1, x - cw, y - ch, x + cw, y + ch) / carea;
            if (openSide(x, y)) cand.push({ x, y, s: fill, staff: si, hollow: white >= 0.06 });
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

  /* ══════════ 音の長さを読む ══════════
     符頭だけでは長さは分からない。符尾・梁・旗・付点を順に読み取る。 */

  /** 符頭に付く符尾を探す。
   *  符頭の中心から外へ辿るのではなく、符頭の高さに触れている縦の連なりを丸ごと取る。
   *  符尾は符頭の左右どちらかの縁に付くので、中心から辿ると長さ0で終わってしまう。 */
  function findStem(bin, W, H, n, S) {
    const need = S * 1.8;
    const cy = Math.round(n.y);
    let best = null;
    for (let d = Math.round(S * 0.30); d <= Math.round(S * 0.85); d++) {
      for (const sgn of [1, -1]) {
        const x = Math.round(n.x) + sgn * d;
        if (x < 1 || x >= W - 1) continue;
        // 符頭の高さのどこかで黒い所を探す
        let y = -1;
        for (let dy = 0; dy <= Math.round(S * 0.45); dy++) {
          if (bin[(cy - dy) * W + x]) { y = cy - dy; break; }
          if (bin[(cy + dy) * W + x]) { y = cy + dy; break; }
        }
        if (y < 0) continue;
        let ya = y, yb = y;
        while (ya > 0 && bin[(ya - 1) * W + x]) ya--;
        while (yb < H - 1 && bin[(yb + 1) * W + x]) yb++;
        const len = yb - ya;
        if (len < need) continue;
        // 符頭より上に長ければ上向き、下に長ければ下向き
        const dir = (cy - ya) >= (yb - cy) ? 1 : -1;
        const tip = dir > 0 ? ya : yb;
        if (!best || len > best.len) best = { x, len, dir, tip, ya, yb };
      }
    }
    return best;
  }

  /** 符尾に沿って走る梁（または旗）の本数を数える。
   *  8分＝1本、16分＝2本、32分＝3本。太さは線間の半分ほど、間に白い隙間が入る。 */
  function countBeams(bin, W, H, stem, S, beamed) {
    if (!stem) return 0;
    const thickMin = S * 0.20, thickMax = S * 1.00;
    const depth = Math.round(S * 3.0);   // 先端からここまでの間に梁が並ぶ
    const gapMax = Math.max(2, Math.round(S * 0.55));
    const ests = [];
    // 梁は水平ではなく傾いている。広い幅で平均すると、どの行も基準に届かず数え落とす。
    // 3列ぶんだけならして雑音を消し、いくつかの距離で見る。
    // 梁につながっていない音符に付くのは旗だけ。旗は符尾のすぐ右にしか出ない。
    // 遠くまで見にいくと、五線や譜表の下の括弧を旗と数えて、4分音符が8分になる。
    const signs = beamed ? [1, -1] : [1];
    const offs = beamed ? [0.40, 0.60, 0.85, 1.10, 1.35] : [0.40, 0.55];
    for (const sgn of signs) {
      for (const f of offs) {
        const xc = stem.x + sgn * Math.round(S * f);
        if (xc < 1 || xc >= W - 1) continue;
        let bands = 0, run = 0, last = -1, first = -1;
        for (let k = 0; k < depth; k++) {
          const y = stem.tip + stem.dir * k;
          if (y < 0 || y >= H) break;
          const c = bin[y * W + xc - 1] + bin[y * W + xc] + bin[y * W + xc + 1];
          if (c >= 2) { run++; last = k; if (first < 0) first = k; }
          else {
            if (run >= thickMin && run <= thickMax) bands++;
            run = 0;
            if (last >= 0 && k - last > gapMax) break;   // 梁の並びはここで終わり
          }
        }
        if (run >= thickMin && run <= thickMax) bands++;
        if (last < 0) continue;
        // 印刷や写真のにじみで2本の梁がくっつくと、数えた「本数」は1になる。
        // 梁は太さ0.5線間・すきま0.25線間で並ぶので、全体の広がりからも本数を出し、
        // 多いほうを採る。（実測: 16分音符の連なりが丸ごと8分と読まれていた）
        const byExtent = beamed ? Math.round(((last - first + 1) / S + 0.25) / 0.75) : 0;
        ests.push(Math.max(bands, byExtent));
      }
    }
    // 梁の見えない位置（梁の外側など）は数えない。見えた所だけで多数決する。
    const seen = ests.filter(e => e > 0);
    if (!seen.length) return 0;
    const tally = new Map();
    for (const e of seen) tally.set(e, (tally.get(e) || 0) + 1);
    let win = 0, cnt = 0;
    for (const [k, v] of tally) if (v > cnt || (v === cnt && k > win)) { win = k; cnt = v; }
    return Math.min(win, 3);
  }

  /** 符尾の先から梁が横にどこまで伸びているかを測る。
   *  同じ梁につながる音符どうしをまとめるために使う。 */
  function beamSpan(bin, W, H, stem, S) {
    if (!stem) return null;
    const y = stem.tip + stem.dir * Math.round(S * 0.25);
    if (y < 0 || y >= H) return null;
    const ok = x => {
      if (x < 0 || x >= W) return false;
      for (let d = -1; d <= 1; d++) {
        const yy = y + d;
        if (yy >= 0 && yy < H && bin[yy * W + x]) return true;
      }
      return false;
    };
    if (!ok(stem.x)) return null;
    let xa = stem.x, xb = stem.x, gap = 0;
    while (xa > 0) { if (ok(xa - 1)) { xa--; gap = 0; } else if (++gap <= 2) xa--; else break; }
    gap = 0;
    while (xb < W - 1) { if (ok(xb + 1)) { xb++; gap = 0; } else if (++gap <= 2) xb++; else break; }
    return (xb - xa) >= S * 1.2 ? [xa, xb] : null;   // 短いものは旗であって梁ではない
  }

  /** 符頭の右にある付点。あれば長さが1.5倍になる。
   *  付点は「小さくて、まわりが白い」。この孤立の条件を課さないと、
   *  隣の符頭や符尾を付点と取り違えて大量に誤検出する。 */
  function hasDot(ii, W1, W, H, n, S) {
    const r = Math.max(1, Math.round(S * 0.15));      // 付点そのもの
    const R = Math.max(r + 2, Math.round(S * 0.45));  // まわりの余白
    const area = (r * 2 + 1) * (r * 2 + 1);
    const bigArea = (R * 2 + 1) * (R * 2 + 1);
    for (let dx = Math.round(S * 0.95); dx <= Math.round(S * 1.5); dx++) {
      for (const dy of [0, -Math.round(S * 0.5), Math.round(S * 0.5)]) {
        const x = Math.round(n.x + dx), y = Math.round(n.y + dy);
        if (x - R < 0 || x + R >= W || y - R < 0 || y + R >= H) continue;
        const inner = rectSum(ii, W1, x - r, y - r, x + r, y + r);
        if (inner / area < 0.85) continue;
        const outer = rectSum(ii, W1, x - R, y - R, x + R, y + R) - inner;
        if (outer / (bigArea - area) < 0.10) return true;   // まわりがほぼ白なら付点
      }
    }
    return false;
  }

  /** 段の頭に並ぶ調号を読む。
   *  調号を無視すると、♭4つの曲では音の半分近くが半音ずれる（実測でF1が26%→52%変わった）。
   *
   *  記号を切り分けて数える方法は、隣り合う♭がくっついて1つに融合するため使えない。
   *  代わりに「♯と♭で並ぶ高さが決まっている」ことを使い、その位置に黒があるかで採点する。
   *  ♭は シ ミ ラ レ ソ ド ファ、♯は ファ ド ソ レ ラ ミ シ の順に並ぶ。 */
  const KEY_STEPS_FLAT = [4, 7, 3, 6, 2, 5, 1];    // ト音の第1線を0とした高さ
  const KEY_STEPS_SHARP = [8, 5, 9, 6, 3, 7, 4];
  function detectKey(bin, W, H, staves) {
    const votes = new Map(), detail = [];
    for (const st of staves) {
      const S = st.space;
      const shift = (st.clef === "F") ? -2 : 0;      // ヘ音記号では2段ぶん下がる
      const bw = Math.max(1, Math.round(S * 0.32));  // 見る箱の半幅
      const bh = Math.max(1, Math.round(S * 0.70));  // 半高
      const area = (bw * 2 + 1) * (bh * 2 + 1);
      const inkAt = (cx, step) => {
        const cy = Math.round(st.bottom - (step + shift) * (S / 2));
        if (cx - bw < 0 || cx + bw >= W || cy - bh < 0 || cy + bh >= H) return 0;
        let c = 0;
        for (let y = cy - bh; y <= cy + bh; y++)
          for (let x = cx - bw; x <= cx + bw; x++) if (bin[y * W + x]) c++;
        return c / area;
      };
      // 音部記号の幅は版によって違うので、調号の始まる位置を少し探す
      let bestN = 0, bestSign = 0, bestScore = 0, bestEnd = 0;
      for (let start = S * 1.8; start <= S * 5.0; start += S * 0.12) {
        for (const sign of [-1, 1]) {
          const steps = sign < 0 ? KEY_STEPS_FLAT : KEY_STEPS_SHARP;
          // 調号の1つ目の記号の左は必ず空いている。空いていなければ、
          // それは音部記号そのものの一部（ヘ音記号の胴や点）を見ている。
          // これを見ないと、ヘ音記号が「♯が1つ」に化けて調が丸ごと変わる。
          const before = inkAt(Math.round((st.xStart || 0) + start - S * 0.62),
                               (sign < 0 ? KEY_STEPS_FLAT : KEY_STEPS_SHARP)[0]);
          if (before > 0.35) continue;
          let n = 0, sum = 0;
          for (let i = 0; i < 7; i++) {
            const cx = Math.round((st.xStart || 0) + start + i * S * 1.02);
            const v = inkAt(cx, steps[i]);
            if (v < 0.40) break;
            // 本来その記号が無いはずの高さも見る。
            // 拍子記号は縦に広いのでここにも黒が出るが、♯♭は出ない。
            const off = Math.max(inkAt(cx, steps[i] + 4), inkAt(cx, steps[i] - 4));
            if (off > 0.34) break;
            n++; sum += v - off;
          }
          if (!n) continue;
          // 次の枠にも記号があるなら、まだ続いている
          const nxt = n < 7 ? inkAt(Math.round((st.xStart || 0) + start + n * S * 1.02), steps[n]) : 0;
          const score = sum - (nxt > 0.40 ? 0.5 : 0);
          if (score > bestScore) {
            bestScore = score; bestN = n; bestSign = sign;
            bestEnd = (st.xStart || 0) + start + n * S * 1.02;
          }
        }
      }
      // 平均の黒さが薄いものは調号ではないとみなす。
      // 基準を上げすぎると、♭1つの譜面（この曲がそう）を読み落とす
      const f = (bestN && bestScore / bestN >= 0.42) ? bestSign * bestN : 0;
      // 調号がどこで終わるかを覚えておく。ここまでは符頭が来ない
      st.keyEnd = f ? bestEnd : 0;
      st.keyOwn = f;                 // この段が自分で読み取った調号
      detail.push({ n: bestN, sign: bestSign, score: +bestScore.toFixed(2) });
      votes.set(f, (votes.get(f) || 0) + 1);
    }
    let best = 0, cnt = 0;
    for (const [f, v] of votes) if (v > cnt) { cnt = v; best = f; }
    detectKey.detail = detail;
    return best;
  }

  /** 段の頭の音部記号を見分ける。
   *
   *  「上の段はト音、下の段はヘ音」と決めうちにはできない。実際の楽譜では
   *  左手が高い所を弾く間だけト音になったり、曲の途中で入れ替わったりする。
   *  （手元の2曲とも、下の段がト音の箇所があった。決めうちだと丸ごと1オクターブ半ずれる）
   *
   *  見分け方は形の照合ではなく、はみ出し方。ト音記号は五線の下へ長く垂れ、
   *  ヘ音記号は五線の上半分に収まって下へは出ない。この差は写真がぼけても残る。
   */
  function clefFeatures(bin, W, H, st) {
    const S = st.space;
    const x0 = Math.max(0, Math.round((st.xStart || 0) + S * 0.4));
    const x1 = Math.min(W - 1, Math.round((st.xStart || 0) + S * 3.2));
    const band = (ya, yb) => {
      const y0 = Math.max(0, Math.round(ya)), y1 = Math.min(H - 1, Math.round(yb));
      let c = 0, n = 0;
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) { n++; if (bin[y * W + x]) c++; }
      return n ? c / n : 0;
    };
    return {
      below: band(st.bottom + S * 0.55, st.bottom + S * 1.7),   // ト音の垂れ
      above: band(st.top - S * 1.4, st.top - S * 0.35),         // ト音の頭
      lower: band(st.bottom - S * 1.2, st.bottom),              // 五線の下寄り（ヘ音は空く）
    };
  }
  function detectClef(bin, W, H, st) {
    const f = clefFeatures(bin, W, H, st);
    return (f.below > 0.12) ? "G" : "F";
  }

  /** 音部記号が横にどこまで占めているかを測る。
   *  「線間の3.2倍」と決めうちすると、ト音記号の下の巻きひげが残って
   *  符頭として拾われる。実際に黒が途切れる所を見て終わりを決める。 */
  function clefRight(bin, W, H, st) {
    const S = st.space;
    const y0 = Math.max(0, Math.round(st.top - S * 1.6));
    const y1 = Math.min(H - 1, Math.round(st.bottom + S * 2.0));
    const x0 = Math.max(0, Math.round((st.xStart || 0) + S * 0.35));
    const xMax = Math.min(W - 1, Math.round((st.xStart || 0) + S * 6.0));
    const ink = x => {
      let c = 0;
      for (let y = y0; y <= y1; y++) if (bin[y * W + x]) c++;
      return c;
    };
    let seen = false, blank = 0, end = x0;
    const need = Math.max(1, Math.round(S * 0.20));   // かすれた1〜2画素は無視する
    for (let x = x0; x <= xMax; x++) {
      if (ink(x) >= need) { seen = true; blank = 0; end = x; }
      else if (seen && ++blank >= Math.max(2, Math.round(S * 0.25))) break;
    }
    return seen ? end : x0;
  }

  /** その段で音符が始まる x を決める。
   *  音部記号・調号・拍子記号は、どれも符頭ほどの黒い塊を持っている。
   *  ここを読み飛ばさないと、段の頭で必ず何音か誤検出する（実測でジョプリンの
   *  ♭4つがそのまま4つの音として拾われていた）。 */
  function musicStart(bin, W, H, st, fifths) {
    const S = st.space;
    const x0 = st.xStart || 0;
    const clefEnd = st.clefEnd !== undefined ? st.clefEnd : clefRight(bin, W, H, st);
    // 調号の終わりは detectKey が実測している。ただし、その段が自分で読んだ調号が
    // 曲全体の調号と食い違うときは当てにならない（見当違いの場所を指している）ので、
    // 記号の数から見積もり直す。
    const trust = st.keyOwn === fifths && st.keyEnd;
    const keyEnd = trust ? st.keyEnd
                         : (clefEnd + S * (0.35 + Math.abs(fifths || 0) * 1.02));
    let x = Math.max(x0 + S * 2.6, clefEnd, keyEnd) + S * 0.4;

    // 拍子記号は五線の上半分と下半分の両方にまたがる、幅のある塊。
    // 符尾も上下にまたがるが、幅が細いので見分けられる。
    const y0 = Math.round(st.top), y1 = Math.round(st.bottom), ym = (y0 + y1) / 2;
    const tall = xx => {
      if (xx < 0 || xx >= W) return false;
      let up = false, dn = false;
      for (let y = y0; y <= y1; y++) {
        if (!bin[y * W + xx]) continue;
        if (y < ym - S * 0.5) up = true; else if (y > ym + S * 0.5) dn = true;
      }
      return up && dn;
    };
    const limit = Math.min(W - 1, Math.round(x + S * 4.5));
    let a = -1, b = -1, gap = 0;
    for (let xx = Math.round(x); xx <= limit; xx++) {
      if (tall(xx)) { if (a < 0) a = xx; b = xx; gap = 0; }
      else if (a >= 0 && ++gap > Math.round(S * 0.4)) break;
      else if (a < 0 && xx > x + S * 1.6) break;    // すぐ後ろに無ければ拍子記号は無い
    }
    if (a >= 0 && b - a + 1 >= S * 0.5) x = b + S * 0.4;
    return x;
  }

  /** 小節線を探す。
   *
   *  1つの段の中だけで「上から下まで黒い縦線」を探すと、符尾や音符の連なりが
   *  同じ形に見えて大量に混じる（実測で、3本しかない段に13本の偽物が出た）。
   *  ピアノ譜の小節線は大譜表の上の段から下の段まで貫いているので、
   *  システム全体を通して見る。ついでに、左右の手で小節の切れ目がそろう。 */
  function findBarlines(bin, W, H, staves) {
    const bars = staves.map(() => []);
    const bySys = new Map();
    for (let i = 0; i < staves.length; i++) {
      const k = staves[i].system || 0;
      if (!bySys.has(k)) bySys.set(k, []);
      bySys.get(k).push(i);
    }
    for (const idx of bySys.values()) {
      const first = staves[idx[0]], last = staves[idx[idx.length - 1]];
      const y0 = Math.round(first.top), y1 = Math.round(last.bottom);
      const span = y1 - y0 + 1;
      const S = first.space;
      const cols = [];
      for (let x = 0; x < W; x++) {
        let c = 0;
        for (let y = y0; y <= y1; y++) if (bin[y * W + x]) c++;
        if (c >= span * 0.96) cols.push(x);
      }
      const group = [];
      for (const x of cols) {
        const g = group[group.length - 1];
        if (g && x - g.x1 <= 2) g.x1 = x; else group.push({ x0: x, x1: x });
      }
      // 音部記号・調号・拍子記号の前後にある縦線は、譜表の始まりや複縦線であって
      // 小節線ではない。数えると先頭に空っぽの小節ができ、以降の小節が丸ごと1つずれる。
      const left = Math.max.apply(null, idx.map(i =>
        Math.max((staves[i].xStart || 0) + S * 1.5, (staves[i].xMusic || 0) - S * 0.4)));
      const found = group
        .filter(g => g.x1 - g.x0 <= S * 0.45 && (g.x0 + g.x1) / 2 > left)
        .map(g => (g.x0 + g.x1) / 2);
      // 二重線・終止線は近い2本に見えるので1本にまとめる
      const merged = [];
      for (const x of found) {
        if (merged.length && x - merged[merged.length - 1] < S * 1.2) merged[merged.length - 1] = x;
        else merged.push(x);
      }
      // 行の終わりの縦線は、その小節の終わりであって次の小節の始まりではない。
      // 残すと、どのシステムにも空っぽの小節が1つ増えてしまう。
      const right = Math.max.apply(null, idx.map(i => staves[i].xEnd || W)) - S * 2.0;
      while (merged.length && merged[merged.length - 1] > right) merged.pop();
      for (const i of idx) bars[i] = merged.slice();
    }
    // 大譜表になっていない（1段だけの）システムだけ、段ごとの見つけ方で埋める。
    // 大譜表で見つからなかったのは「その行が1小節だけ」という意味なので、
    // ここで段ごとに探すと左右の手で小節の切れ目がずれてしまう。
    for (const idx of bySys.values()) {
      if (idx.length !== 1) continue;
      const i = idx[0];
      if (!bars[i].length) bars[i] = perStaffBars(bin, W, H, staves[i]);
    }
    return bars;
  }

  /** 大譜表になっていない段のための、段ひとつぶんの小節線さがし */
  function perStaffBars(bin, W, H, st) {
    const bars = [];
    {
      const y0 = Math.round(st.top), y1 = Math.round(st.bottom);
      const span = y1 - y0 + 1, S = st.space;
      const cols = [];
      for (let x = 0; x < W; x++) {
        let c = 0;
        for (let y = y0; y <= y1; y++) if (bin[y * W + x]) c++;
        if (c >= span * 0.97) cols.push(x);         // 上から下まで隙間なく黒
      }
      const group = [];
      for (const x of cols) {
        const last = group[group.length - 1];
        if (last && x - last.x1 <= 2) { last.x1 = x; } else group.push({ x0: x, x1: x });
      }
      const ym = (y0 + y1) >> 1;
      const clearAt = x => {
        // 小節線は左右が空いている。符尾は符頭や梁が隣接するので除ける
        let c = 0, n = 0;
        for (let d = Math.round(S * 0.55); d <= Math.round(S * 1.1); d++) {
          for (const sgn of [-1, 1]) {
            const xx = x + sgn * d;
            if (xx < 0 || xx >= W) continue;
            n++;
            for (let y = ym - Math.round(S); y <= ym + Math.round(S); y++)
              if (bin[y * W + xx]) { c++; break; }
          }
        }
        return n ? c / n < 0.5 : true;
      };
      // 段の先頭にある縦線は小節線ではなく譜表の始まりの線。
      // これを数えると、空っぽの1小節目ができてしまう。
      const left = (st.xStart || 0) + S * 1.5;
      bars.push.apply(bars, group
        .filter(g => g.x1 - g.x0 <= S * 0.30 && (g.x0 + g.x1) / 2 > left && clearAt((g.x0 + g.x1) / 2))
        .map(g => (g.x0 + g.x1) / 2));
    }
    return bars;
  }

  const LETTER_SEMI = [0, 2, 4, 5, 7, 9, 11];   // C D E F G A B
  const LETTER_NAME = ["C", "D", "E", "F", "G", "A", "B"];
  const FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3];    // シ ミ ラ レ ソ ド ファ
  const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6];   // ファ ド ソ レ ラ ミ シ
  /** 調号による半音のずれ。♭4つなら シミラレ が半音下がる */
  function keyAlter(letter, fifths) {
    if (!fifths) return 0;
    const order = fifths > 0 ? SHARP_ORDER : FLAT_ORDER;
    const n = Math.min(7, Math.abs(fifths));
    for (let i = 0; i < n; i++) if (order[i] === letter) return fifths > 0 ? 1 : -1;
    return 0;
  }
  /** 全音階の通し番号 → MIDI番号 */
  function diaToMidi(d, fifths) {
    const oct = Math.floor(d / 7), le = ((d % 7) + 7) % 7;
    return (oct + 1) * 12 + LETTER_SEMI[le] + keyAlter(le, fifths || 0);
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
    for (const st of staves) st.slope = 0;
    const more = groupStaves(findStaffLines(bin, W, H, 0.30), S)
      .filter(s => Math.abs(s.space - S) <= S * 0.2);
    // 「重なり」は本当に食い込んでいる場合だけ。隣り合っているだけの段を落とさない
    const overlaps = (a, b) =>
      Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > S * 0.5;
    for (const c of more) {
      if (!staves.some(s => overlaps(s, c))) { c.slope = 0; staves.push(c); }
    }

    // 3回目: 段ごとに残る傾きを吸収する。
    // 紙は完全な平面ではないので、四隅を合わせても段ごとに傾きが少しずつ違う。
    // 全体を一律に直しただけでは、傾きの違う段の五線が行に揃わず取りこぼす。
    for (const d of [-0.010, -0.006, -0.003, 0.003, 0.006, 0.010]) {
      const tilted = deshear(bin, W, H, d);
      const found = groupStaves(findStaffLines(tilted, W, H, 0.30), S)
        .filter(s => Math.abs(s.space - S) <= S * 0.2);
      for (const c of found) {
        if (staves.some(s => overlaps(s, c))) continue;
        c.slope = d;           // この段は全体より d だけ傾いている
        staves.push(c);
      }
    }
    staves.sort((a, b) => a.top - b.top);

    // 本物の段どうしは必ず離れている（実測で最も狭い大譜表でも5.9線間）。
    // すぐ下に接している段は、加線や梁を五線と見間違えた偽物。
    // これを残すと左手の枠を奪い、本物の低音部が別の段の右手として読まれて
    // 音高が6度ずれる。
    for (let i = staves.length - 2; i >= 0; i--) {
      const gap = staves[i + 1].top - staves[i].bottom;
      if (gap < S * 1.6) {
        if ((staves[i].strength || 0) >= (staves[i + 1].strength || 0)) staves.splice(i + 1, 1);
        else staves.splice(i, 1);
      }
    }

    // 大譜表かどうかは「小節線が2つの段をつないでいるか」で決める。
    // 隙間の広さで決めると危うい。実測では段の中の隙間が5.9線間、段と段の間が
    // 7.8線間しかなく、この差では判定できずに全段が右手扱いになっていた。
    // 低音部の段を高音部として読むと、音高が丸ごと狂う。
    {
      const linked = (a, b) => {
        const y0 = Math.round(a.bottom) + 1, y1 = Math.round(b.top) - 1;
        if (y1 <= y0) return true;
        const need = (y1 - y0 + 1) * 0.92;
        for (let x = 0; x < W; x++) {
          let c = 0;
          for (let y = y0; y <= y1; y++) if (bin[y * W + x]) c++;
          if (c >= need) return true;     // 上下をつなぐ縦線がある
        }
        return false;
      };
      let sys = 0;
      staves[0].system = 0;
      staves[0].hand = 0;
      for (let i = 1; i < staves.length; i++) {
        if (staves[i - 1].hand === 0 && linked(staves[i - 1], staves[i])) {
          staves[i].hand = 1;
        } else { sys++; staves[i].hand = 0; }
        staves[i].system = sys;
      }
    }

    // 各五線が横方向にどこからどこまで引かれているかを測る
    const minRun2 = Math.max(12, Math.round(W / 45));
    for (const st of staves) {
      // 見つけた横棒をいったん全部集める。紙の外の黒い縁も同じ行に出るので、
      // いちばん長い棒（＝五線そのもの）に比べて短すぎるものは捨てる。
      // これをしないと、切り取りを広めに取ったとき縁が五線の一部と見なされ、
      // 段が紙の端から端まであることになって、音部記号の読み取りごと狂う。
      const runs = [];
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
            if (x2 - x + 1 >= minRun2) runs.push([x, x2]);
            x = x2 + 1;
          }
        }
      }
      let longest = 0;
      for (const r of runs) longest = Math.max(longest, r[1] - r[0] + 1);
      const need = Math.max(minRun2, longest * 0.25);
      let lo = W, hi = 0;
      for (const r of runs) {
        if (r[1] - r[0] + 1 < need) continue;
        if (r[0] < lo) lo = r[0];
        if (r[1] > hi) hi = r[1];
      }
      st.xStart = lo < hi ? lo : 0;
      st.xEnd = hi > lo ? hi : W - 1;
    }

    const cleaned = eraseStaffLines(bin, W, H, staves);
    const ii = integral(cleaned, W, H);
    const runLen = horizontalRunLength(cleaned, W, H);
    const vRunLen = verticalRunLength(cleaned, W, H);

    // 音部記号は、置かれている位置ではなく形から決める。
    // 「下の段はヘ音」と決めうちにすると、下の段がト音の楽譜で全部の音が狂う。
    const clefDetail = staves.map(st => clefFeatures(cleaned, W, H, st));
    const clefs = opts.clefs || staves.map((st, i) => {
      st.clef = detectClef(cleaned, W, H, st);
      return st.clef;
    });
    // 音部記号がどこで終わるかは、この先の調号さがしでも符頭さがしでも使う
    for (let i = 0; i < staves.length; i++) {
      staves[i].clef = clefs[i];
      staves[i].clefEnd = clefRight(cleaned, W, H, staves[i]);
    }

    // 調号を先に読む。段の頭は「音部記号＋調号（＋拍子記号）」で埋まっており、
    // ここに符頭は来ない。読み飛ばす幅は調号の数で変わるので、先に知る必要がある。
    const fifths = (opts.fifths !== undefined && opts.fifths !== null)
      ? opts.fifths : detectKey(cleaned, W, H, staves);
    for (const st of staves) st.xMusic = musicStart(cleaned, W, H, st, fifths);

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

    const BASE = { G: 30, F: 18 };   // ト音の第1線=E4(30) / ヘ音の第1線=G2(18)

    const bars = findBarlines(bin, W, H, staves);

    // 検出した位置は、判定窓が最も黒くなる場所であって符頭の中心ではない。
    // 符頭のまわりの黒の重心を取り直して、中心をより正確にする。
    // 音の高さは五線からの高さで決まるので、ここのわずかなズレが音を1つ変える。
    for (const h of heads) {
      const S = staves[h.staff].space;
      const rx = Math.max(1, Math.round(S * 0.22));
      const lim = Math.round(S * 0.85);
      let sum = 0, n = 0;
      for (let x = Math.round(h.x) - rx; x <= Math.round(h.x) + rx; x++) {
        if (x < 0 || x >= W) continue;
        let y = Math.round(h.y);
        if (!cleaned[y * W + x]) continue;
        let ya = y, yb = y;
        while (ya > 0 && cleaned[(ya - 1) * W + x] && y - ya < lim) ya--;
        while (yb < H - 1 && cleaned[(yb + 1) * W + x] && yb - y < lim) yb++;
        sum += (ya + yb) / 2; n++;
      }
      if (n) h.y = sum / n;
    }
    // 重心を取り直したうえで、五線の位置から大きく外れるものだけ落とす
    heads = heads.filter(h => {
      const st = staves[h.staff];
      const baseY = st.bottom + (st.slope || 0) * (h.x - W / 2);
      const raw = (baseY - h.y) / (st.space / 2);
      return Math.abs(raw - Math.round(raw)) <= 0.34;
    });

    const cxAll = W / 2;
    let notes = heads.map(h => {
      const st = staves[h.staff];
      const S = st.space;
      // 段が傾いている場合、基準となる第1線の高さは x によって変わる
      const baseY = st.bottom + (st.slope || 0) * (h.x - cxAll);
      const step = Math.round((baseY - h.y) / (S / 2));
      const stem = findStem(cleaned, W, H, h, S);
      const span = h.hollow ? null : beamSpan(cleaned, W, H, stem, S);
      const beams = h.hollow ? 0 : countBeams(cleaned, W, H, stem, S, !!span);
      const dot = hasDot(ii, W + 1, W, H, h, S);
      // 白抜き＝2分/全音符、塗りつぶし＋梁の本数で8分・16分…と決まる
      let q = h.hollow ? (stem ? 2 : 4) : (stem ? 1 / Math.pow(2, beams) : 1);
      if (dot) q *= 1.5;
      const myBars = bars[h.staff] || [];
      let measure = 0;
      for (const bx of myBars) if (bx < h.x) measure++;
      const d = (BASE[clefs[h.staff]] !== undefined ? BASE[clefs[h.staff]] : BASE.G) + step;
      return {
        x: h.x, y: h.y, staff: h.staff, hollow: h.hollow,
        // 傾きを戻した座標。元の写真の上に重ねて描くときはこちらを使う
        yImg: h.y + shear * (h.x - W / 2),
        space: S, system: st.system, hand: st.hand,
        q, beams, dot, measure, span,
        stemDir: stem ? stem.dir : 0, stemX: stem ? stem.x : h.x,
        dia: d, midi: diaToMidi(d, fifths),
        name: LETTER_NAME[((d % 7) + 7) % 7] + Math.floor(d / 7),
      };
    });
    // 最初の音符より左にある「小節線」は、複縦線か譜表の始まりの線。
    // 残すと空っぽの1小節目ができ、以降の小節が丸ごと1つずれて、
    // 鳴らしたときに曲の頭に無音が入る。
    {
      const firstX = new Map();
      for (const n of notes) {
        const k = staves[n.staff].system || 0;
        if (!firstX.has(k) || n.x < firstX.get(k)) firstX.set(k, n.x);
      }
      for (let i = 0; i < staves.length; i++) {
        const lim = firstX.get(staves[i].system || 0);
        if (lim === undefined || !bars[i]) continue;
        while (bars[i].length && bars[i][0] < lim) bars[i].shift();
      }
      for (const n of notes) {
        const my = bars[n.staff] || [];
        let m = 0;
        for (const bx of my) if (bx < n.x) m++;
        n.measure = m;
      }
    }

    // 塗りつぶした符頭には必ず符尾が付く。付いていないものは符頭ではない。
    // 曲名や発想標語の文字（"Allegro" など）が符頭の大きさの黒い塊として
    // 引っかかるので、この一手で落とす。
    notes = notes.filter(n => n.hollow || n.stemDir !== 0);

    // 同じ梁につながる音符は同じ本数のはず。1音ずつの判定はぶれるので多数決で揃える。
    // これをしないと、ひと続きの16分音符が 2,1,0,1,2… とばらついてしまう。
    const linked = notes.filter(n => n.span);
    linked.sort((a, b) => a.staff - b.staff || a.span[0] - b.span[0]);
    for (let i = 0; i < linked.length; ) {
      let j = i, hi = linked[i].span[1];
      while (j + 1 < linked.length && linked[j + 1].staff === linked[i].staff &&
             linked[j + 1].span[0] <= hi + 2) {
        j++; hi = Math.max(hi, linked[j].span[1]);
      }
      const group = linked.slice(i, j + 1);
      if (group.length > 1) {
        const tally = new Map();
        for (const g of group) if (g.beams > 0) tally.set(g.beams, (tally.get(g.beams) || 0) + 1);
        let win = 0, cnt = 0;
        for (const [k, v] of tally) if (v > cnt || (v === cnt && k > win)) { win = k; cnt = v; }
        if (win > 0) for (const g of group) {
          g.beams = win;
          g.q = (1 / Math.pow(2, win)) * (g.dot ? 1.5 : 1);
        }
      }
      i = j + 1;
    }

    // 休符も拾う。読めないと、そこから後ろの音が全部前に詰まる
    const rests = findRests(cleaned, vRunLen, W, H, staves, notes);
    for (const r of rests) {
      const my = bars[r.staff] || [];
      let m = 0;
      for (const bx of my) if (bx < r.x) m++;
      r.measure = m;
    }

    // 段ごと・左から順に並べる
    notes.sort((a, b) => (a.staff >> 1) - (b.staff >> 1) || a.x - b.x || a.midi - b.midi);
    return { staves, notes, rests, bars, fifths, clefs, clefDetail,
             keyDetail: detectKey.detail, W, H, shear };
  }

  /** 半音の増減を「全音階で何段動くか」に直す。
   *  五線の上で音符が動く距離は半音数ではなく段数で決まる。
   *  例: +2半音(長2度)は1段、+3半音(短3度)は2段。 */
  const STEP_OF_SEMI = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6, 7];
  function semiToSteps(semi) {
    const sign = semi < 0 ? -1 : 1, a = Math.abs(semi);
    return sign * (Math.floor(a / 12) * 7 + STEP_OF_SEMI[a % 12]);
  }

  global.OMR = { readScore, diaToMidi, semiToSteps, keyAlter, LETTER_NAME,
                 // 中身を目で確かめるため（bench/diag.mjs から使う）
                 _internal: { binarize, estimateShear, deshear, findStaffLines, groupStaves, findRests } };
})(typeof window !== "undefined" ? window : globalThis);

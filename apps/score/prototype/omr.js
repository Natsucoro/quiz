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
  function countBeams(bin, W, H, stem, S) {
    if (!stem) return 0;
    const thickMin = S * 0.20, thickMax = S * 1.00;
    const depth = Math.round(S * 2.8);   // 先端からここまでの間に梁が並ぶ
    let best = 0;
    // 梁は水平ではなく傾いている。広い幅で平均すると、どの行も基準に届かず数え落とす。
    // 3列ぶんだけならして雑音を消し、いくつかの距離で見て最も多い本数を採る。
    for (const sgn of [1, -1]) {
      for (const f of [0.40, 0.60, 0.85, 1.10, 1.35]) {
        const xc = stem.x + sgn * Math.round(S * f);
        if (xc < 1 || xc >= W - 1) continue;
        let bands = 0, run = 0;
        for (let k = 0; k < depth; k++) {
          const y = stem.tip + stem.dir * k;
          if (y < 0 || y >= H) break;
          const c = bin[y * W + xc - 1] + bin[y * W + xc] + bin[y * W + xc + 1];
          if (c >= 2) run++;
          else {
            if (run >= thickMin && run <= thickMax) bands++;
            run = 0;
          }
        }
        if (run >= thickMin && run <= thickMax) bands++;
        if (bands > best) best = bands;
      }
    }
    return Math.min(best, 3);
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
      const shift = (st.hand === 1) ? -2 : 0;        // ヘ音記号では2段ぶん下がる
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
      let bestN = 0, bestSign = 0, bestScore = 0;
      for (let start = S * 1.8; start <= S * 5.0; start += S * 0.12) {
        for (const sign of [-1, 1]) {
          const steps = sign < 0 ? KEY_STEPS_FLAT : KEY_STEPS_SHARP;
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
          if (score > bestScore) { bestScore = score; bestN = n; bestSign = sign; }
        }
      }
      // 平均の黒さが薄いものは調号ではないとみなす
      const f = (bestN && bestScore / bestN >= 0.50) ? bestSign * bestN : 0;
      detail.push({ n: bestN, sign: bestSign, score: +bestScore.toFixed(2) });
      votes.set(f, (votes.get(f) || 0) + 1);
    }
    let best = 0, cnt = 0;
    for (const [f, v] of votes) if (v > cnt) { cnt = v; best = f; }
    detectKey.detail = detail;
    return best;
  }

  /** 小節線を探す。五線の高さいっぱいに伸びる細い縦線 */
  function findBarlines(bin, W, H, staves) {
    const bars = [];
    for (const st of staves) {
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
      bars.push(group
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
    const more = groupStaves(findStaffLines(bin, W, H, 0.45), S)
      .filter(s => Math.abs(s.space - S) <= S * 0.2);
    for (const c of more) {
      if (!staves.some(s => Math.abs(s.top - c.top) < S * 2)) staves.push(c);
    }
    staves.sort((a, b) => a.top - b.top);

    // 大譜表の中の隙間は狭く、段と段の間は広い。この差でシステムに束ねる。
    // 段番号で機械的に2つずつ組むと、1段取りこぼした瞬間に右手と左手が入れ替わる。
    {
      const S0 = staves.reduce((a, s) => a + s.space, 0) / staves.length;
      let sys = 0;
      staves[0].system = 0;
      staves[0].hand = 0;
      for (let i = 1; i < staves.length; i++) {
        const gap = staves[i].top - staves[i - 1].bottom;
        if (gap > S0 * 3.2) { sys++; staves[i].hand = 0; }
        else staves[i].hand = Math.min(1, (staves[i - 1].hand || 0) + 1);
        staves[i].system = sys;
      }
    }

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

    const bars = findBarlines(bin, W, H, staves);
    // 調号は指定があればそれを、なければ自動で読む。
    // 必ず五線を消した画像で調べること。五線が残っていると全部の列に黒があり、
    // 記号のかたまりに切り分けられない。
    const fifths = (opts.fifths !== undefined && opts.fifths !== null)
      ? opts.fifths : detectKey(cleaned, W, H, staves);

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
      const raw = (st.bottom - h.y) / (st.space / 2);
      return Math.abs(raw - Math.round(raw)) <= 0.34;
    });

    const notes = heads.map(h => {
      const st = staves[h.staff];
      const S = st.space;
      const step = Math.round((st.bottom - h.y) / (S / 2));
      const stem = findStem(cleaned, W, H, h, S);
      const beams = h.hollow ? 0 : countBeams(cleaned, W, H, stem, S);
      const span = h.hollow ? null : beamSpan(cleaned, W, H, stem, S);
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

    // 段ごと・左から順に並べる
    notes.sort((a, b) => (a.staff >> 1) - (b.staff >> 1) || a.x - b.x || a.midi - b.midi);
    return { staves, notes, bars, fifths, keyDetail: detectKey.detail, W, H, shear };
  }

  /** 半音の増減を「全音階で何段動くか」に直す。
   *  五線の上で音符が動く距離は半音数ではなく段数で決まる。
   *  例: +2半音(長2度)は1段、+3半音(短3度)は2段。 */
  const STEP_OF_SEMI = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6, 7];
  function semiToSteps(semi) {
    const sign = semi < 0 ? -1 : 1, a = Math.abs(semi);
    return sign * (Math.floor(a / 12) * 7 + STEP_OF_SEMI[a % 12]);
  }

  global.OMR = { readScore, diaToMidi, semiToSteps, keyAlter, LETTER_NAME };
})(typeof window !== "undefined" ? window : globalThis);

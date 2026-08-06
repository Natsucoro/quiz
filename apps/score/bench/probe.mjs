/* 白抜きの符頭（2分・付点2分）が、どんな数字に見えているのかを直接測る。
   使い方: node probe.mjs 画像 x y  （x,y は取り込んだ画像の中の符頭のあたり） */
import { chromium } from 'playwright'; import fs from 'fs'; import path from 'path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const [file, X, Y] = [process.argv[2] || 'real_crop.png', +process.argv[3], +process.argv[4]];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage();
await pg.goto('file:///home/user/quiz/apps/score/prototype/index.html');
await pg.waitForTimeout(300);
const src = 'data:image/png;base64,' + fs.readFileSync(path.join(HERE, file)).toString('base64');
const out = await pg.evaluate(async (a) => {
  const im = new Image(); im.src = a.src; await im.decode();
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  c.getContext('2d').drawImage(im, 0, 0);
  const img = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  const I = OMR._internal;
  const raw = I.binarize(img), W = raw.W, H = raw.H;
  const bin = I.deshear(raw.bin, W, H, I.estimateShear(raw.bin, W, H));
  const o = OMR.readScore(img);
  // その位置にいちばん近い段の線間を使う
  let st = o.staves[0];
  for (const s of o.staves) if (Math.abs((s.top + s.bottom) / 2 - a.Y) < Math.abs((st.top + st.bottom) / 2 - a.Y)) st = s;
  const S = st.space;
  // 五線を消した画像で測る（本番と同じ条件）
  const cleaned = (() => {
    const out = Uint8Array.from(bin);
    for (const s of o.staves) {
      const t = Math.max(1, Math.round(s.space * 0.22));
      for (const ly of s.lines) {
        for (let x = 0; x < W; x++) {
          const y0 = Math.round(ly - t), y1 = Math.round(ly + t);
          let clear = true;
          for (const yy of [y0 - 2, y1 + 2]) if (yy >= 0 && yy < H && bin[yy * W + x]) clear = false;
          if (clear) for (let y = y0; y <= y1; y++) if (y >= 0 && y < H) out[y * W + x] = 0;
        }
      }
    }
    return out;
  })();
  const rect = (bb, x0, y0, x1, y1) => {
    let c2 = 0, n = 0;
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++)
      for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) { n++; if (bb[y * W + x]) c2++; }
    return n ? c2 / n : 0;
  };
  const hw = Math.max(2, Math.round(S * 0.40)), hh = Math.max(2, Math.round(S * 0.45));
  const ihw = Math.max(1, Math.round(S * 0.20)), ihh = Math.max(1, Math.round(S * 0.16));
  const best = [];
  for (let y = a.Y - 8; y <= a.Y + 8; y++) for (let x = a.X - 12; x <= a.X + 12; x++) {
    const fill = rect(cleaned, x - hw, y - hh, x + hw, y + hh);
    const inner = rect(cleaned, x - ihw, y - ihh, x + ihw, y + ihh);
    best.push({ x, y, fill: +fill.toFixed(2), inner: +inner.toFixed(2) });
  }
  best.sort((p, q) => (q.fill - q.inner) - (p.fill - p.inner));
  // まわりの黒さの様子も出す（縦横の断面）
  const prof = [];
  for (let dy = -8; dy <= 8; dy++) {
    let row = '';
    for (let dx = -12; dx <= 12; dx++) row += cleaned[(a.Y + dy) * W + (a.X + dx)] ? '#' : '.';
    prof.push(row);
  }
  return { S: +S.toFixed(1), hw, hh, ihw, ihh, top5: best.slice(0, 5), prof };
}, { src, X, Y });
await b.close();
console.log(`線間 ${out.S}  判定窓 ±${out.hw}x±${out.hh}  内側 ±${out.ihw}x±${out.ihh}`);
console.log('中心候補（黒さ-内側の白さ が大きい順）:', JSON.stringify(out.top5));
console.log('そのあたりの見え方:');
out.prof.forEach(r => console.log('  ' + r));

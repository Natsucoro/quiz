/* 拾った符頭ひとつずつについて「まん中がどれだけ白いか」を測り、分布を見る。
   白抜き（2分・付点2分）と塗りつぶし（4分・8分）が数字で分かれるかを確かめる。 */
import { chromium } from 'playwright'; import fs from 'fs'; import path from 'path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const file = process.argv[2] || 'real_crop.png';
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
  const white = (x, y, S) => {
    const cw = Math.max(2, Math.round(S * 0.34)), ch = Math.max(1, Math.round(S * 0.30));
    let n = 0, w = 0;
    for (let yy = Math.round(y) - ch; yy <= Math.round(y) + ch; yy++)
      for (let xx = Math.round(x) - cw; xx <= Math.round(x) + cw; xx++) {
        if (yy < 0 || yy >= H || xx < 0 || xx >= W) continue;
        n++; if (!bin[yy * W + xx]) w++;
      }
    return n ? w / n : 0;
  };
  return o.notes.map(n => ({ x: Math.round(n.x), y: Math.round(n.y), q: n.q,
                             h: n.hollow, w: +white(n.x, n.y, n.space).toFixed(3) }));
}, { src });
await b.close();
const bins = {};
for (const n of out) { const k = (Math.floor(n.w * 20) / 20).toFixed(2); bins[k] = (bins[k] || 0) + 1; }
console.log('符頭', out.length, '個の「まん中の白さ」の分布:');
for (const k of Object.keys(bins).sort((a,b)=>a-b)) console.log(`  ${k}: ${'#'.repeat(bins[k])} (${bins[k]})`);
console.log('白い順に20個:', JSON.stringify(out.slice().sort((a,b)=>b.w-a.w).slice(0,20)));

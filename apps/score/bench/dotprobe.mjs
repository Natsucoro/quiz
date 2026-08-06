/* 付点がなぜ拾えないかを、実物の付点の場所で測る */
import { chromium } from 'playwright'; import fs from 'fs'; import path from 'path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage();
await pg.goto('file:///home/user/quiz/apps/score/prototype/index.html');
await pg.waitForTimeout(300);
const src = 'data:image/png;base64,' + fs.readFileSync(path.join(HERE, 'real_crop.png')).toString('base64');
const out = await pg.evaluate(async (a) => {
  const im = new Image(); im.src = a; await im.decode();
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  c.getContext('2d').drawImage(im, 0, 0);
  const img = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  const o = OMR.readScore(img);
  const I = OMR._internal;
  const raw = I.binarize(img), W = raw.W, H = raw.H;
  const bin = I.deshear(raw.bin, W, H, I.estimateShear(raw.bin, W, H));
  // 各付点2分らしき音（左手の最初の音たち）について、右側の黒の様子を走査
  const res = [];
  for (const n of o.notes.filter(n => n.q >= 1 && n.hand === 1).slice(0, 6)) {
    const S = n.space;
    const rows = [];
    for (let dy = -Math.round(S*0.8); dy <= Math.round(S*0.8); dy += 2) {
      let row = '';
      for (let dx = Math.round(S*0.6); dx <= Math.round(S*2.0); dx += 2)
        row += bin[Math.round(n.y+dy) * W + Math.round(n.x+dx)] ? '#' : '.';
      rows.push(row);
    }
    res.push({ x: Math.round(n.x), y: Math.round(n.y), q: n.q, S: +S.toFixed(1), rows });
  }
  return res;
}, src);
await b.close();
for (const r of out) {
  console.log(`\n音 @${r.x},${r.y} q=${r.q} S=${r.S}  右側 0.6S..2.0S ↓`);
  r.rows.forEach(row => console.log('  ' + row));
}

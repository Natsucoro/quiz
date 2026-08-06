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
  // readScore 内部と同じ cleaned/ii を作り直す代わりに、その場で hasDot 相当を再現
  const I = OMR._internal;
  const raw = I.binarize(img), W = raw.W, H = raw.H;
  const bin = I.deshear(raw.bin, W, H, I.estimateShear(raw.bin, W, H));
  const res = [];
  for (const n of o.notes.filter(n => n.q >= 2).slice(0, 8)) {
    const S = n.space, r = Math.max(1, Math.round(S * 0.14));
    const area = (r*2+1)*(r*2+1), m1 = r+1, m2 = r+3;
    const cands = [];
    for (let dx = Math.round(S*0.7); dx <= Math.round(S*1.7); dx += 1) {
      for (const dy of [-Math.round(S*0.62), -Math.round(S*0.5), -Math.round(S*0.38), 0]) {
        const x = Math.round(n.x+dx), y = Math.round(n.y+dy);
        let inner=0, right=0, top=0, bot=0;
        for(let yy=y-r;yy<=y+r;yy++)for(let xx=x-r;xx<=x+r;xx++) if(bin[yy*W+xx]) inner++;
        for(let yy=y-r;yy<=y+r;yy++)for(let xx=x+m1;xx<=x+m2;xx++) if(bin[yy*W+xx]) right++;
        for(let yy=y-m2;yy<=y-m1;yy++)for(let xx=x-r;xx<=x+r;xx++) if(bin[yy*W+xx]) top++;
        for(let yy=y+m1;yy<=y+m2;yy++)for(let xx=x-r;xx<=x+r;xx++) if(bin[yy*W+xx]) bot++;
        const sideA=(m2-m1+1)*(r*2+1);
        if (inner/area > 0.5) cands.push({dx:+(dx/S).toFixed(2),dy:+(dy/S).toFixed(2),
          in:+(inner/area).toFixed(2), rt:+(right/sideA).toFixed(2),
          tp:+(top/sideA).toFixed(2), bt:+(bot/sideA).toFixed(2)});
      }
    }
    res.push({x:Math.round(n.x),y:Math.round(n.y),q:n.q,best:cands.slice(0,10)});
  }
  return res;
}, src);
await b.close();
for (const r of out) console.log(`音@${r.x},${r.y} q=${r.q}:`, JSON.stringify(r.best));

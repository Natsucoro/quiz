/* どの小節で取りこぼしているかを突き止める。
   diag.mjs を先に走らせて diag.musicxml と検出結果を得てから使う…のではなく、
   ここで一気に「正解の小節ごとの音」対「検出の小節ごとの音」を出す。 */
import { chromium } from 'playwright'; import fs from 'fs'; import path from 'path';
import { execSync } from 'child_process';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const piece = process.argv[2] || 'joplin';

// 正解: 小節ごと・パートごとの音の集まり
const xml = fs.readFileSync(path.join(HERE, 'truth-src', `${piece}_truth.musicxml`), 'utf8');
const truth = {};   // "part:measure" -> [midi...]
{
  const STEP = { C:0,D:2,E:4,F:5,G:7,A:9,B:11 };
  const parts = xml.split(/<part id="/).slice(1);
  parts.forEach((ptxt, pi) => {
    const measures = ptxt.split(/<measure[^>]*number="/).slice(1);
    measures.forEach(mtxt => {
      const mno = parseInt(mtxt);
      for (const nm of mtxt.matchAll(/<note[\s\S]*?<\/note>/g)) {
        const t = nm[0];
        if (t.includes('<rest')) continue;
        const st = /<step>(\w)<\/step>/.exec(t), oc = /<octave>(-?\d+)<\/octave>/.exec(t);
        if (!st || !oc) continue;
        const al = /<alter>(-?[\d.]+)<\/alter>/.exec(t);
        const staff = /<staff>(\d)<\/staff>/.exec(t);
        const key = (staff ? staff[1] : String(pi + 1)) + ":" + mno;
        (truth[key] = truth[key] || []).push((+oc[1] + 1) * 12 + STEP[st[1]] + (al ? Math.round(+al[1]) : 0));
      }
    });
  });
}

// 検出: bench と同じ「ぴったり」で読む
const meta = JSON.parse(fs.readFileSync(path.join(HERE, `${piece}_corners.json`), 'utf8'));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
await pg.goto('file:///home/user/quiz/apps/score/prototype/index.html');
await pg.waitForTimeout(400);
await pg.setInputFiles('#pick', `/home/user/quiz/apps/score/spike/samples/${piece}_photo.jpg`);
await pg.waitForTimeout(800);
const st0 = await pg.locator('#shot').boundingBox();
for (let i = 0; i < 4; i++) {
  const fx = meta.corners[i][0] / meta.w, fy = meta.corners[i][1] / meta.h;
  const g = await pg.locator('#stage .grip').nth(i).boundingBox();
  await pg.mouse.move(g.x + g.width / 2, g.y + g.height / 2); await pg.mouse.down();
  await pg.mouse.move(st0.x + st0.width * fx, st0.y + st0.height * fy, { steps: 8 });
  await pg.mouse.up(); await pg.waitForTimeout(40);
}
await pg.locator('#btnCrop').click(); await pg.waitForTimeout(5200);
const url = await pg.locator('#pageList img').first().getAttribute('src');
const det = await pg.evaluate(async (u) => {
  const im = new Image(); im.src = u; await im.decode();
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  c.getContext('2d').drawImage(im, 0, 0);
  const o = OMR.readScore(c.getContext('2d').getImageData(0, 0, c.width, c.height));
  return o.notes.map(n => ({ m: n.midi, sys: n.system, hand: n.hand, meas: n.measure,
                             x: Math.round(n.x), y: Math.round(n.y) }));
}, url);
await b.close();

// システムごとの小節数を数えて、通しの小節番号に直す
const perSys = new Map();
for (const n of det) {
  const k = n.sys;
  perSys.set(k, Math.max(perSys.get(k) || 0, n.meas + 1));
}
const base = new Map(); let acc = 0;
for (const k of [...perSys.keys()].sort((a, b) => a - b)) { base.set(k, acc); acc += perSys.get(k); }

const mine = {};
for (const n of det) {
  const key = (n.hand + 1) + ":" + (base.get(n.sys) + n.meas + 1);
  (mine[key] = mine[key] || []).push(n.m);
}
const NAME = ["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"];
const nm = m => NAME[m % 12] + (Math.floor(m / 12) - 1);
const keys = [...new Set([...Object.keys(truth), ...Object.keys(mine)])]
  .sort((a, b) => (+a.split(":")[1]) - (+b.split(":")[1]) || a.localeCompare(b));
for (const k of keys) {
  const T = (truth[k] || []).slice().sort((a, b) => a - b);
  const M = (mine[k] || []).slice().sort((a, b) => a - b);
  const t2 = T.slice(), miss = [], extra = [];
  for (const m of M) { const i = t2.indexOf(m); if (i >= 0) t2.splice(i, 1); else extra.push(m); }
  miss.push(...t2);
  if (miss.length || extra.length)
    console.log(`${k.split(":")[0] === "1" ? "右" : "左"} 小節${k.split(":")[1]}: ` +
      (miss.length ? "欠け " + miss.map(nm).join(",") : "") +
      (extra.length ? "  余分 " + extra.map(nm).join(",") : ""));
}

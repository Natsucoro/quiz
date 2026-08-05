/* 読み取った楽譜を実際に組み直して、絵として見る。
   数字だけ見ていると「人が見て使えるか」が分からなくなるため。
   使い方: node look.mjs [曲名] [切り取り方] */
import { chromium } from 'playwright'; import fs from 'fs'; import path from 'path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const piece = process.argv[2] || 'mozart';
const vname = process.argv[3] || 'ぴったり';
const TIME = { mozart: '4/4', joplin: '2/4' };
const VARIANTS = {
  'ぴったり': [[0,0],[0,0],[0,0],[0,0]],
  '広め':     [[-.025,-.020],[.025,-.020],[.025,.020],[-.025,.020]],
  'ばらつき': [[.012,-.016],[-.018,.010],[.014,.013],[-.010,-.014]],
};
const meta = JSON.parse(fs.readFileSync(path.join(HERE, `${piece}_corners.json`), 'utf8'));
const offs = VARIANTS[vname];

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport: { width: 900, height: 1400 } });
pg.on('pageerror', e => console.log('ERR', e.message.slice(0, 140)));
await pg.goto('file:///home/user/quiz/apps/score/prototype/index.html');
await pg.waitForTimeout(400);
await pg.setInputFiles('#pick', `/home/user/quiz/apps/score/spike/samples/${piece}_photo.jpg`);
await pg.waitForTimeout(800);
const st = await pg.locator('#shot').boundingBox();
for (let i = 0; i < 4; i++) {
  const fx = meta.corners[i][0] / meta.w + offs[i][0];
  const fy = meta.corners[i][1] / meta.h + offs[i][1];
  const g = await pg.locator('#stage .grip').nth(i).boundingBox();
  await pg.mouse.move(g.x + g.width / 2, g.y + g.height / 2); await pg.mouse.down();
  await pg.mouse.move(st.x + st.width * Math.max(0, Math.min(1, fx)),
                      st.y + st.height * Math.max(0, Math.min(1, fy)), { steps: 10 });
  await pg.mouse.up(); await pg.waitForTimeout(50);
}
await pg.locator('#btnCrop').click(); await pg.waitForTimeout(5200);
const url = await pg.locator('#pageList img').first().getAttribute('src');

const svg = await pg.evaluate(async (a) => {
  const im = new Image(); im.src = a.u; await im.decode();
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  c.getContext('2d').drawImage(im, 0, 0);
  const o = OMR.readScore(c.getContext('2d').getImageData(0, 0, c.width, c.height));
  const xml = ScoreBuild.toMusicXML(o, { time: a.time, key: o.fifths || 0, title: a.piece });
  const tk = new verovio.toolkit();
  tk.setOptions({ pageWidth: 2100, pageHeight: 2970, scale: 40, adjustPageHeight: true,
                  footer: 'none', header: 'none', svgRemoveXlink: true, transpose: 'P1' });
  if (!tk.loadData(xml)) return null;
  return tk.renderToSVG(1);
}, { u: url, time: TIME[piece] || '4/4', piece });

if (!svg) { console.log('組み直せませんでした'); await b.close(); process.exit(1); }
const page = await b.newPage({ viewport: { width: 1000, height: 1400 } });
const fixed = svg.replace(/^<svg width="(\d+)px" height="(\d+)px"/,
  (m, w, h) => `<svg viewBox="0 0 ${w} ${h}" width="1000"`);
await page.setContent(`<body style="margin:0;background:#fff">${fixed}</body>`);
await page.screenshot({ path: path.join(HERE, 'look_out.png'), fullPage: true });
await b.close();
console.log('look_out.png');

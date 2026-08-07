/* なつみが実際に使いたい楽譜で、通しで何がどう読めているかを見る。
   使い方: node real.mjs [ファイル名] [拍子] */
import { chromium } from 'playwright'; import fs from 'fs'; import path from 'path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const file = process.argv[2] || 'itsumo_p1.png';
const time = process.argv[3] || '3/4';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
pg.on('pageerror', e => console.log('ERR', e.message.slice(0, 160)));
await pg.goto('file:///home/user/quiz/apps/score/prototype/index.html');
await pg.waitForTimeout(400);
if (process.env.C) await pg.evaluate(v=>{document.querySelector('#thr').value=v;}, process.env.C);
await pg.setInputFiles('#pick', path.join(HERE, 'samples', file));
await pg.waitForTimeout(1000);
console.log('四隅の自動判定:', await pg.evaluate(()=>document.querySelector('#autoNote').textContent));
console.log('置いた四隅:', await pg.evaluate(()=>JSON.stringify(corners.map(p=>p.map(Math.round)))));
await pg.locator('#btnCrop').click(); await pg.waitForTimeout(5500);
const url = await pg.locator('#pageList img').first().getAttribute('src');
if (!url) { console.log('取り込めませんでした'); await b.close(); process.exit(1); }
fs.writeFileSync(path.join(HERE, 'real_crop.png'), Buffer.from(url.split(',')[1], 'base64'));

const out = await pg.evaluate(async (a) => {
  const im = new Image(); im.src = a.u; await im.decode();
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  c.getContext('2d').drawImage(im, 0, 0);
  const img = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  const o = OMR.readScore(img);
  // 拾ったものを重ね描き
  const g = c.getContext('2d');
  g.lineWidth = 2; g.font = '12px sans-serif';
  for (const st of o.staves) {
    g.strokeStyle = 'rgba(0,80,255,.5)';
    g.strokeRect(st.xStart, st.top, st.xEnd - st.xStart, st.bottom - st.top);
    g.fillStyle = '#08f'; g.fillText(st.clef + (st.hand ? '下' : '上'), st.xStart - 26, (st.top + st.bottom) / 2);
  }
  for (const n of o.notes) {
    g.strokeStyle = n.hollow ? '#0a0' : '#e00';
    g.beginPath(); g.ellipse(n.x, n.y, n.space * .62, n.space * .44, 0, 0, 7); g.stroke();
    g.fillStyle = '#00c'; g.fillText(String(n.q), n.x - 7, n.y - n.space * .8);
  }
  for (const r of (o.rests || [])) {
    const st = o.staves[r.staff];
    g.strokeStyle = '#f80'; g.lineWidth = 2.5;
    g.strokeRect(r.x - st.space, st.top, st.space * 2, st.bottom - st.top);
  }
  const xml = o.notes.length ? ScoreBuild.toMusicXML(o, { time: a.time, key: o.fifths || 0 }) : null;
  let svg = null;
  if (xml) {
    const tk = new verovio.toolkit();
    tk.setOptions({ pageWidth: 2100, pageHeight: 2970, scale: 40, adjustPageHeight: true,
                    footer: 'none', header: 'none', svgRemoveXlink: true, transpose: 'P1' });
    if (tk.loadData(xml)) svg = tk.renderToSVG(1);
  }
  return { over: c.toDataURL('image/png'), svg, xml,
           staves: o.staves.map(s => ({ y: Math.round(s.top), sp:+s.space.toFixed(1), clef: s.clef, sys: s.system, hand: s.hand, xm: Math.round(s.xMusic), x0: s.xStart })),
           keyDetail: o.keyDetail,
           bars: (o.bars || []).map(x => x.length), rests: (o.rests || []).length,
           fifths: o.fifths, n: o.notes.length, hollow: o.notes.filter(n=>n.hollow).length,
           beamed: o.notes.filter(n=>n.span).length,
           lh: o.notes.filter(n=>o.staves[n.staff].hand===1).map(n=>({q:n.q,b:n.beams,sp:!!n.span})),
           q: (() => { const h = {}; o.notes.forEach(n => h[n.q] = (h[n.q] || 0) + 1); return h; })(),
           allNotes: o.notes.map(n=>({m:n.midi,q:n.q,st:n.staff,x:Math.round(n.x),y:Math.round(n.y),b:n.beams,d:n.dot,h:n.hollow,a:n.acc,ao:n.accOnly,fu:n.accFused,sp2:n.split})) };
}, { u: url, time });

fs.writeFileSync(path.join(HERE, 'real_over.png'), Buffer.from(out.over.split(',')[1], 'base64'));
if (out.xml) fs.writeFileSync(path.join(HERE, 'real.musicxml'), out.xml);
fs.writeFileSync(path.join(HERE, 'real_notes.json'), JSON.stringify(out.allNotes));
console.log('白抜きと数えた符頭:', out.hollow, ' 梁があると判定:', out.beamed);
{const h={};out.lh.forEach(n=>{const k=`q${n.q}/梁${n.b}/span${n.sp?'有':'無'}`;h[k]=(h[k]||0)+1});
 console.log('左手の内訳:', JSON.stringify(h));}
console.log(`段 ${out.staves.length}  音符 ${out.n}  休符 ${out.rests}  調号 ${out.fifths}`);
console.log('段:', out.staves.map(s => `y${s.y}/線間${s.sp}/${s.clef}/系${s.sys}${s.hand?'下':'上'}/音符は${s.xm}から(段の左端${s.x0})`).join('\n    '));
console.log('調号の手がかり:', JSON.stringify(out.keyDetail));
console.log('小節線の数:', out.bars.join(','));
console.log('音価の内訳:', JSON.stringify(out.q));
if (out.svg) {
  const p2 = await b.newPage({ viewport: { width: 1000, height: 1400 } });
  const fixed = out.svg.replace(/^<svg width="(\d+)px" height="(\d+)px"/, (m, w, h) => `<svg viewBox="0 0 ${w} ${h}" width="1000"`);
  await p2.setContent(`<body style="margin:0;background:#fff">${fixed}</body>`);
  await p2.screenshot({ path: path.join(HERE, 'real_engraved.png'), fullPage: true });
}
await b.close();
console.log('real_crop.png / real_over.png / real_engraved.png');

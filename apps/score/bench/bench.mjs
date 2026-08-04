/* 改善の効果を毎回同じ物差しで測る。
   紙の真の四隅を基準に、指の置き方のばらつきを3通り再現する。楽譜は必ず全部入る。 */
import { chromium } from 'playwright'; import fs from 'fs'; import path from 'path';
// どこから実行しても同じものを測れるように、正解データはこのファイルの隣から読む
const HERE = path.dirname(new URL(import.meta.url).pathname);
const load = f => JSON.parse(fs.readFileSync(path.join(HERE, f), 'utf8'));
const PIECES = ['mozart', 'joplin'];
// [四隅ごとの ずらし量(紙の幅に対する比)]  ぴったり / 外側に広め / 指がばらついた
const VARIANTS = {
  'ぴったり': [[0,0],[0,0],[0,0],[0,0]],
  '広め':     [[-.025,-.020],[.025,-.020],[.025,.020],[-.025,.020]],
  'ばらつき': [[.012,-.016],[-.018,.010],[.014,.013],[-.010,-.014]],
};
const cnt=a=>{const m=new Map();a.forEach(v=>m.set(v,(m.get(v)||0)+1));return m};
const f1=(A,B)=>{const T=cnt(A),P=cnt(B);let it=0;for(const[k,v]of T)it+=Math.min(v,P.get(k)||0);
  const r=it/Math.max(1,A.length),p=it/Math.max(1,B.length);return {r,p,f:r+p?2*r*p/(r+p):0};};
const pad=(s,n)=>String(s).padStart(n);

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const rows=[];
for (const piece of PIECES) {
  const meta = load(`${piece}_corners.json`);
  const truthP = load(`${piece}_truth.json`);
  const truthPD = load(`${piece}_truthpd.json`);
  for (const [vname, offs] of Object.entries(VARIANTS)) {
    const pg = await b.newPage({ viewport:{width:390,height:844} });
    const errs=[]; pg.on('pageerror',e=>errs.push(e.message.slice(0,90)));
    await pg.goto('file:///home/user/quiz/apps/score/prototype/index.html');
    // 二値化の強さを試すとき用。既定はページの初期値のまま
    if (process.env.C) await pg.evaluate(v=>{ document.querySelector('#thr').value = v; }, process.env.C);
    await pg.waitForTimeout(400);
    await pg.setInputFiles('#pick', `/home/user/quiz/apps/score/spike/samples/${piece}_photo.jpg`);
    await pg.waitForTimeout(800);
    const st = await pg.locator('#shot').boundingBox();
    for (let i=0;i<4;i++){
      const fx = meta.corners[i][0]/meta.w + offs[i][0];
      const fy = meta.corners[i][1]/meta.h + offs[i][1];
      const g = await pg.locator('#stage .grip').nth(i).boundingBox();
      await pg.mouse.move(g.x+g.width/2, g.y+g.height/2); await pg.mouse.down();
      await pg.mouse.move(st.x+st.width*Math.max(0,Math.min(1,fx)),
                          st.y+st.height*Math.max(0,Math.min(1,fy)), {steps:10});
      await pg.mouse.up(); await pg.waitForTimeout(50);
    }
    await pg.locator('#btnCrop').click(); await pg.waitForTimeout(5200);
    const url = await pg.locator('#pageList img').first().getAttribute('src');
    const r = await pg.evaluate(async (u)=>{
      const im=new Image(); im.src=u; await im.decode();
      const c=document.createElement('canvas'); c.width=im.width;c.height=im.height;
      c.getContext('2d').drawImage(im,0,0);
      const t0=performance.now();
      const o=OMR.readScore(c.getContext('2d').getImageData(0,0,c.width,c.height));
      return { ms:Math.round(performance.now()-t0), staves:o.staves.length,
               shear:+(o.shear||0).toFixed(4),
               notes:o.notes.map(n=>({m:n.midi,q:n.q})) };
    }, url);
    const P = f1(truthP, r.notes.map(n=>n.m));
    const PD = f1(truthPD, r.notes.map(n=>n.m+'/'+n.q));
    rows.push({piece, vname, ...r, P, PD, errs:errs.length});
    await pg.close();
  }
}
await b.close();
console.log('曲       切り取り   五線 音符 |  音高:再現 適合  F1  | 音高+音価:再現 適合  F1 | 傾き   時間');
for (const r of rows) console.log(
  `${r.piece.padEnd(8)} ${r.vname.padEnd(9)} ${pad(r.staves,2)} ${pad(r.notes.length,4)} | ` +
  `${pad((r.P.r*100).toFixed(1),6)}%${pad((r.P.p*100).toFixed(1),6)}%${pad((r.P.f*100).toFixed(1),6)}% | ` +
  `${pad((r.PD.r*100).toFixed(1),9)}%${pad((r.PD.p*100).toFixed(1),6)}%${pad((r.PD.f*100).toFixed(1),6)}% |` +
  `${pad((r.shear*1000).toFixed(1),6)}‰${pad(r.ms,6)}ms`);
const avg = k => (rows.reduce((a,r)=>a+r[k].f,0)/rows.length*100).toFixed(1);
console.log(`\n★ 平均  音高F1 ${avg('P')}%   音高+音価F1 ${avg('PD')}%`);

/* 鳴り出しの時刻が「どの小節で」ずれるかを見る。
   正解と検出それぞれの midi@時刻 を小節ごとに束ね、小節単位の一致率を出す。
   使い方: node onsetdiff.mjs [曲名] [切り取り方] */
import { chromium } from 'playwright'; import fs from 'fs'; import path from 'path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const piece = process.argv[2] || 'mozart';
const vname = process.argv[3] || 'ぴったり';
const TIMESIG = { mozart: '4/4', joplin: '2/4' };
const VARIANTS = {
  'ぴったり': [[0,0],[0,0],[0,0],[0,0]],
  '広め':     [[-.025,-.020],[.025,-.020],[.025,.020],[-.025,.020]],
  'ばらつき': [[.012,-.016],[-.018,.010],[.014,.013],[-.010,-.014]],
};
const meta = JSON.parse(fs.readFileSync(path.join(HERE, `${piece}_corners.json`), 'utf8'));
const truthT = JSON.parse(fs.readFileSync(path.join(HERE, `${piece}_truthtime.json`), 'utf8'));
const offs = VARIANTS[vname];
const [beats, beatType] = TIMESIG[piece].split('/').map(Number);
const MQ = beats * 4 / beatType;

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport:{width:390,height:844} });
await pg.goto('file:///home/user/quiz/apps/score/prototype/index.html');
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
const r = await pg.evaluate(async (a)=>{
  const im=new Image(); im.src=a.u; await im.decode();
  const c=document.createElement('canvas'); c.width=im.width;c.height=im.height;
  c.getContext('2d').drawImage(im,0,0);
  const o=OMR.readScore(c.getContext('2d').getImageData(0,0,c.width,c.height));
  const xml = o.notes.length ? ScoreBuild.toMusicXML(o,{time:a.time,key:o.fifths||0}) : null;
  const times=[];   // {midi, t, part}
  if (xml) {
    const doc = new DOMParser().parseFromString(xml,'application/xml');
    const STEP={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
    let pi=0;
    for (const part of doc.querySelectorAll('part')) {
      let div=1, t=0;
      for (const m of part.querySelectorAll('measure')) {
        const dv=m.querySelector('divisions'); if(dv) div=+dv.textContent;
        let mt=0, prev=0, mmax=0;
        for (const el of m.children) {
          if (el.tagName==='backup'){ mt-=+el.querySelector('duration').textContent/div; prev=0; continue; }
          if (el.tagName==='forward'){ mt+=+el.querySelector('duration').textContent/div; continue; }
          if (el.tagName!=='note') continue;
          const d=el.querySelector('duration');
          const dur=d?+d.textContent/div:0;
          const chord=!!el.querySelector('chord');
          const at=chord?mt-prev:mt;
          const p=el.querySelector('pitch');
          if (p) {
            const midi=(+p.querySelector('octave').textContent+1)*12
              + STEP[p.querySelector('step').textContent]
              + (+(p.querySelector('alter')?.textContent||0));
            times.push({midi, t: Math.round((t+at)*4)/4, part: pi});
          }
          if (!chord){ prev=dur; mt+=dur; }
          if (mt>mmax) mmax=mt;
        }
        t+=mmax;
      }
      pi++;
    }
  }
  return { times, nBars:(o.bars||[]).map(bb=>bb.length), nStaves:o.staves.length };
}, { u:url, time: TIMESIG[piece] });
await b.close();

// 正解: "midi@t" → {midi,t}
const truth = truthT.map(s=>{const [m,t]=s.split('@'); return {midi:+m, t:+t};});
const nM = Math.ceil(Math.max(...truth.map(x=>x.t+0.01))/MQ);
const cnt=a=>{const m=new Map();a.forEach(v=>m.set(v,(m.get(v)||0)+1));return m};
console.log(`${piece}/${vname}  小節=${MQ}拍  正解${truth.length}音  検出${r.times.length}音  正解小節数~${nM}  検出小節線 ${r.nBars.join(',')}`);
console.log('小節 | 正解音数 検出音数 一致 | 正解の中身 → 検出の中身(不一致のみ)');
let totHit=0;
for (let m=0;m<Math.max(nM, Math.ceil(Math.max(0,...r.times.map(x=>x.t+0.01))/MQ)); m++) {
  const T = truth.filter(x=>x.t>=m*MQ-1e-6 && x.t<(m+1)*MQ-1e-6).map(x=>x.midi+'@'+(x.t-m*MQ).toFixed(2));
  const D = r.times.filter(x=>x.t>=m*MQ-1e-6 && x.t<(m+1)*MQ-1e-6).map(x=>x.midi+'@'+(x.t-m*MQ).toFixed(2));
  const TC=cnt(T), DC=cnt(D); let hit=0;
  for (const [k,v] of TC) hit+=Math.min(v, DC.get(k)||0);
  totHit+=hit;
  const flag = hit===T.length && T.length===D.length ? '✓' : ' ';
  let detail='';
  if (flag!=='✓') {
    const miss=[...TC].filter(([k,v])=>(DC.get(k)||0)<v).map(([k,v])=>k+(v-(DC.get(k)||0)>1?'x'+(v-(DC.get(k)||0)):''));
    const extra=[...DC].filter(([k,v])=>(TC.get(k)||0)<v).map(([k,v])=>k+(v-(TC.get(k)||0)>1?'x'+(v-(TC.get(k)||0)):''));
    detail = `欠:${miss.join(' ')||'-'} 余:${extra.join(' ')||'-'}`;
  }
  console.log(`${String(m+1).padStart(3)} ${flag} | ${String(T.length).padStart(4)} ${String(D.length).padStart(6)} ${String(hit).padStart(4)} | ${detail.slice(0,(process.env.FULL?9999:150))}`);
}
console.log(`一致合計 ${totHit}/${truth.length} (再現率 ${(totHit/truth.length*100).toFixed(1)}%)`);

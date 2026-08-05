/* 中で何が起きているかを覗く道具。数字を直接見てから直す。
   使い方: node diag.mjs [曲名] [切り取り方] */
import { chromium } from 'playwright'; import fs from 'fs'; import path from 'path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const piece = process.argv[2] || 'joplin';
const vname = process.argv[3] || 'ぴったり';
const VARIANTS = {
  'ぴったり': [[0,0],[0,0],[0,0],[0,0]],
  '広め':     [[-.025,-.020],[.025,-.020],[.025,.020],[-.025,.020]],
  'ばらつき': [[.012,-.016],[-.018,.010],[.014,.013],[-.010,-.014]],
};
const meta = JSON.parse(fs.readFileSync(path.join(HERE, `${piece}_corners.json`), 'utf8'));
const offs = VARIANTS[vname];

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport:{width:390,height:844} });
pg.on('pageerror', e => console.log('ERR', e.message.slice(0,120)));
await pg.goto('file:///home/user/quiz/apps/score/prototype/index.html');
await pg.evaluate(t=>{window.__TIME=t}, ({mozart:'4/4',joplin:'2/4'})[process.argv[2]||'joplin']||'4/4');
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

const out = await pg.evaluate(async (u) => {
  const im=new Image(); im.src=u; await im.decode();
  const c=document.createElement('canvas'); c.width=im.width;c.height=im.height;
  c.getContext('2d').drawImage(im,0,0);
  const img = c.getContext('2d').getImageData(0,0,c.width,c.height);
  const I = OMR._internal;
  const raw = I.binarize(img), W = raw.W, H = raw.H;
  const shear = I.estimateShear(raw.bin, W, H);
  const bin = I.deshear(raw.bin, W, H, shear);
  const rep = {};
  for (const k of [1, 0.30]) {
    const lines = I.findStaffLines(bin, W, H, k);
    const staves = I.groupStaves(lines, k === 1 ? undefined : rep['1'].S);
    rep[String(k)] = {
      nLines: lines.length,
      lines: lines.map(l => ({ y: +l.y.toFixed(1), sp: l.span, th: l.thickness })),
      S: staves.length ? staves.reduce((a,s)=>a+s.space,0)/staves.length : 0,
      staves: staves.map(s => ({ top:+s.top.toFixed(1), bot:+s.bottom.toFixed(1),
                                 sp:+s.space.toFixed(2), str:s.strength })),
    };
  }
  const full = OMR.readScore(img);
  const xmlOut = full.notes.length ? ScoreBuild.toMusicXML(full,{time:window.__TIME||'4/4',key:full.fifths||0}) : '';
  // 二値化した結果をそのまま画像として書き出す（何が見えていないかを目で確かめる）
  const oc=document.createElement('canvas'); oc.width=W; oc.height=H;
  const od=oc.getContext('2d').createImageData(W,H);
  for(let i=0;i<W*H;i++){const v=bin[i]?0:255; od.data[i*4]=od.data[i*4+1]=od.data[i*4+2]=v; od.data[i*4+3]=255;}
  const g2=oc.getContext('2d'); g2.putImageData(od,0,0);
  // 拾った音符に印を付ける。何を余計に拾っているかを目で確かめる
  g2.lineWidth=2; g2.font='11px sans-serif';
  for(const n of full.notes){
    g2.strokeStyle = n.hollow ? '#0a0' : '#e00';
    const S=n.space; g2.beginPath(); g2.ellipse(n.x,n.y,S*0.62,S*0.44,0,0,7); g2.stroke();
    g2.fillStyle='#00c'; g2.fillText(String(n.q), n.x-6, n.y-S*0.7);
  }
  return { binPng: oc.toDataURL('image/png'), W, H, shear, rep,
           final: full.staves.map(s => ({ top:+s.top.toFixed(1), bot:+s.bottom.toFixed(1),
                     sp:+s.space.toFixed(2), sys:s.system, hand:s.hand,
                     x0:s.xStart, x1:s.xEnd, xm:Math.round(s.xMusic), str:s.strength, clef:s.clef })),
           clefDetail: full.clefDetail.map(f=>({b:+f.below.toFixed(3),a:+f.above.toFixed(3),l:+f.lower.toFixed(3)})),
           xml: xmlOut,
           bars: (full.bars||[]).map(b=>b.map(Math.round)),
           rests: (full.rests||[]).map(r=>({x:Math.round(r.x),st:r.staff,q:r.q,m:r.measure})),
           fifths: full.fifths, nNotes: full.notes.length,
           notes: full.notes.map(n=>({m:n.midi,q:n.q,st:n.staff,x:Math.round(n.x),y:Math.round(n.y),b:n.beams,d:n.dot,h:n.hollow,sd:n.stemDir})) };
}, url);
await b.close();

fs.writeFileSync(path.join(HERE,'diag.musicxml'), out.xml||''); delete out.xml;
fs.writeFileSync(path.join(HERE,'diag_bin.png'), Buffer.from(out.binPng.split(',')[1],'base64'));
fs.writeFileSync(path.join(HERE,'diag_crop.png'), Buffer.from(url.split(',')[1],'base64'));
delete out.binPng;
console.log(`${piece} / ${vname}  ${out.W}x${out.H}  傾き ${(out.shear*1000).toFixed(1)}‰`);
for (const k of Object.keys(out.rep)) {
  const r = out.rep[k];
  console.log(`\n[感度 ${k}] 線 ${r.nLines}本 → 段 ${r.staves.length} (線間 ${r.S.toFixed(2)})`);
  console.log('  段: ' + r.staves.map(s=>`${s.top}-${s.bot}(${s.sp},力${s.str})`).join(' '));
  console.log('  線: ' + r.lines.map(l=>`${l.y}:${l.sp}`).join(' '));
}
console.log(`\n最終 ${out.final.length}段  調号 ${out.fifths}  音符 ${out.nNotes}`);
for (const s of out.final) console.log(`  y ${s.top}-${s.bot} 線間${s.sp} 系${s.sys} 手${s.hand} 記号${s.clef} x ${s.x0}..(音符は${s.xm}から)..${s.x1}`);

console.log('休符: ' + (out.rests.length ? out.rests.map(r=>`段${r.st}@${r.x}(${r.q})`).join(' ') : 'なし'));
console.log('小節線: ' + out.bars.map((b,i)=>`段${i}[${b.join(',')}]`).join(' '));
console.log('記号の手がかり(下/上/五線下寄り): ' + out.clefDetail.map(f=>`${f.b}/${f.a}/${f.l}`).join('  '));
// 音価の内訳と、正解とのつき合わせ
const hist = m => { const h={}; for(const v of m) h[v]=(h[v]||0)+1;
  return Object.entries(h).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}:${v}`).join(' '); };
const truthP = JSON.parse(fs.readFileSync(path.join(HERE,`${piece}_truth.json`),'utf8'));
const truthPD = JSON.parse(fs.readFileSync(path.join(HERE,`${piece}_truthpd.json`),'utf8'));
console.log('\n検出の音価: ' + hist(out.notes.map(n=>n.q)));
console.log('正解の音価: ' + hist(truthPD.map(t=>t.split('/')[1])));
// 音高が合っている音のうち、音価がどう外れたか
const tp = {}; for(const t of truthPD){const[m,q]=t.split('/'); (tp[m]=tp[m]||[]).push(+q);}
const conf = {};
for (const n of out.notes) { const list = tp[String(n.m)]; if(!list||!list.length) continue;
  let bi=0; for(let i=1;i<list.length;i++) if(Math.abs(list[i]-n.q)<Math.abs(list[bi]-n.q)) bi=i;
  const k = `正${list[bi]}→検${n.q}`; conf[k]=(conf[k]||0)+1; list.splice(bi,1); }
console.log('音価の食い違い: ' + Object.entries(conf).sort((a,b)=>b[1]-a[1]).slice(0,14).map(([k,v])=>`${k}(${v})`).join(' '));
const missing = Object.entries(tp).filter(([m,l])=>l.length).map(([m,l])=>[+m,l.length]);
console.log('取りこぼした音高: ' + missing.map(([m,c])=>`${m}x${c}`).join(' '));
// 余計に拾った音高（正解に無い、または多すぎる）
{
  const need = {}; for (const t of truthP) need[t]=(need[t]||0)+1;
  const extra = {};
  for (const n of out.notes) { if (need[n.m]) need[n.m]--; else extra[n.m]=(extra[n.m]||0)+1; }
  console.log('余計に拾った音高: ' + Object.entries(extra).sort((a,b)=>b[1]-a[1]).map(([m,c])=>`${m}x${c}`).join(' '));
}

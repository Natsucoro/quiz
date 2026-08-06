/* 「四隅の初期位置」が紙の上に来るかを確かめる。
   スマホの画面を撮った写真（上下が黒い帯）を作って試す。 */
import { chromium } from 'playwright'; import fs from 'fs'; import path from 'path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport:{width:390,height:844} });
pg.on('pageerror', e => console.log('ERR', e.message.slice(0,140)));
await pg.goto('file:///home/user/quiz/apps/score/prototype/index.html');
await pg.waitForTimeout(400);

// 元の楽譜写真の上下に黒帯を足して「スマホ画面を撮った写真」を作る
const shot = fs.readFileSync('/home/user/quiz/apps/score/spike/samples/mozart_photo.jpg');
const made = await pg.evaluate(async (b64)=>{
  const im=new Image(); im.src='data:image/jpeg;base64,'+b64; await im.decode();
  // 縦長のスマホ画面に、紙を中ほどに置く
  const W=1080, H=2400;
  const c=document.createElement('canvas'); c.width=W; c.height=H;
  const g=c.getContext('2d');
  g.fillStyle='#0b0b0b'; g.fillRect(0,0,W,H);
  const pw=Math.round(W*0.88), ph=Math.round(pw*im.height/im.width);
  g.drawImage(im, Math.round((W-pw)/2), Math.round(H*0.16), pw, ph);
  return { url:c.toDataURL('image/jpeg',0.9), paper:[Math.round((W-pw)/2), Math.round(H*0.16), pw, ph], W, H };
}, shot.toString('base64'));
fs.writeFileSync(path.join(HERE,'croptest_in.jpg'), Buffer.from(made.url.split(',')[1],'base64'));
await pg.setInputFiles('#pick', path.join(HERE,'croptest_in.jpg'));
await pg.waitForTimeout(900);

const r = await pg.evaluate(()=>({
  corners: corners.map(p=>p.map(Math.round)),
  note: document.querySelector('#autoNote').textContent,
  shotRect: (()=>{const b=document.querySelector('#shot').getBoundingClientRect();
    return {w:Math.round(b.width), h:Math.round(b.height), top:Math.round(b.top), bottom:Math.round(b.bottom)};})(),
  grips: [...document.querySelectorAll('#stage .grip')].map(g=>{const b=g.getBoundingClientRect();
    return {x:Math.round(b.x+b.width/2), y:Math.round(b.y+b.height/2)};}),
  viewportH: window.innerHeight,
}));
const [px,py,pw,ph] = made.paper;
console.log('紙の本当の場所:', `x ${px}..${px+pw}  y ${py}..${py+ph}`);
console.log('自動で置いた四隅:', JSON.stringify(r.corners));
console.log('案内文:', r.note);
console.log('写真の表示:', JSON.stringify(r.shotRect), '画面の高さ', r.viewportH);
console.log('丸の画面上の位置:', JSON.stringify(r.grips));
const inView = r.grips.every(g => g.y > 0 && g.y < r.viewportH);
console.log('4つとも画面の中に見えている:', inView ? 'はい' : 'いいえ');
const err = r.corners.map(([x,y],i)=>{
  const t=[[px,py],[px+pw,py],[px+pw,py+ph],[px,py+ph]][i];
  return Math.round(Math.hypot(x-t[0], y-t[1]));
});
console.log('本当の角とのずれ(px):', err.join(' '), ' ※紙の幅', pw);
await pg.screenshot({ path: path.join(HERE,'croptest.png') });
await b.close();

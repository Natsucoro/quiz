/* ふつうの「紙を撮った写真」でも、四隅の初期位置が紙の上に来るか */
import { chromium } from 'playwright'; import fs from 'fs'; import path from 'path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
for (const piece of ['mozart','joplin']) {
  const pg = await b.newPage({ viewport:{width:390,height:844} });
  pg.on('pageerror', e => console.log('ERR', e.message.slice(0,140)));
  await pg.goto('file:///home/user/quiz/apps/score/prototype/index.html');
  await pg.waitForTimeout(300);
  await pg.setInputFiles('#pick', `/home/user/quiz/apps/score/spike/samples/${piece}_photo.jpg`);
  await pg.waitForTimeout(900);
  const r = await pg.evaluate(()=>({
    corners: corners.map(p=>p.map(Math.round)),
    note: document.querySelector('#autoNote').textContent.slice(0,12),
    grips: [...document.querySelectorAll('#stage .grip')].map(g=>{const b=g.getBoundingClientRect();
      return Math.round(b.y+b.height/2);}),
    vh: window.innerHeight, nat: [srcImg.naturalWidth, srcImg.naturalHeight],
  }));
  const truth = JSON.parse(fs.readFileSync(path.join(HERE,`${piece}_corners.json`),'utf8'));
  // 正解の四隅は別の縮尺で記録してあるので、画像の幅・高さに対する割合で比べる
  const nat = r.nat;
  const err = r.corners.map((c,i)=>{
    const tx = truth.corners[i][0]/truth.w*nat[0], ty = truth.corners[i][1]/truth.h*nat[1];
    return ((Math.hypot(c[0]-tx, c[1]-ty)/nat[0])*100).toFixed(1);
  });
  console.log(`${piece}: ${r.note} 本当の角とのずれ ${err.join('% ')}%（写真の幅に対して）`);
  console.log(`   丸の画面上のy ${r.grips.join(' ')}（画面の高さ ${r.vh}）`);
  await pg.close();
}
await b.close();

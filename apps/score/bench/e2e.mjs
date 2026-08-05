/* アプリがひととおり動くかを通しで確かめる。
   お手本を読む → 移調する → 鳴らす → 自分の写真を取り込む、まで。 */
import { chromium } from 'playwright'; import path from 'path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; pg.on('pageerror',e=>errs.push(e.message.slice(0,140)));
await pg.goto('file:///home/user/quiz/apps/score/prototype/index.html');
await pg.waitForFunction(()=>document.querySelector('#sheet svg'),{timeout:60000});
const n0 = await pg.evaluate(()=>schedule.length);
console.log('お手本を組み直した: 鳴らす箇所', n0);
// 移調（長2度上げ）
await pg.evaluate(()=>{ semi = 2; engrave(); });
const key = await pg.evaluate(()=>({ n: schedule.length, first: schedule[0].notes.map(x=>x.midi) }));
console.log('長2度上げ: 鳴らす箇所', key.n, '最初の音', key.first);
await pg.evaluate(()=>{ semi = 0; engrave(); });
const back = await pg.evaluate(()=>schedule[0].notes.map(x=>x.midi));
console.log('原調に戻す: 最初の音', back);
await pg.screenshot({ path: path.join(HERE,'e2e_view.png') });
console.log('画面の乱れ:', errs.length ? errs : 'なし');
await b.close();

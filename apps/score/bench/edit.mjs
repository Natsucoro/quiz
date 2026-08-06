/* 「取り込む→読み取る→直す」が通しで動くかを確かめる */
import { chromium } from 'playwright'; import path from 'path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; pg.on('pageerror',e=>errs.push(e.message.slice(0,160)));
await pg.goto('file:///home/user/quiz/apps/score/prototype/index.html');
await pg.waitForTimeout(500);
await pg.setInputFiles('#pick', path.join(HERE,'samples','itsumo_p1.png'));
await pg.waitForTimeout(900);
await pg.locator('#btnCrop').click(); await pg.waitForTimeout(5500);
await pg.locator('#title').fill('いつも何度でも');
await pg.locator('#btnRead').click();
await pg.waitForTimeout(9000);
console.log('いまのタブ:', await pg.evaluate(()=>[...document.querySelectorAll('.tab')].find(t=>t.getAttribute('aria-selected')==='true').textContent.trim()));
console.log('読み取りの案内:', (await pg.locator('#mineInfo').textContent()).slice(0,70));
const n0 = await pg.evaluate(()=>document.querySelectorAll('#sheet g.note').length);
console.log('画面の音符:', n0);
await pg.screenshot({ path: path.join(HERE,'edit1.png') });

// 3つめの音符をタップして、1つ上げて、8分にしてみる
const note = pg.locator('#sheet g.note').nth(2);
const before = await pg.evaluate(()=>{
  const g=document.querySelectorAll('#sheet g.note')[2];
  return svgToNote.get(g.id) ? svgToNote.get(g.id).name+'/'+svgToNote.get(g.id).q : null;});
await note.click({force:true}); await pg.waitForTimeout(600);
console.log('選んだ音符:', await pg.locator('#fxWhat').textContent(), ' 元は', before);
await pg.screenshot({ path: path.join(HERE,'edit2.png') });
await pg.locator('#fxUp').click(); await pg.waitForTimeout(900);
console.log('1つ上げた後:', await pg.locator('#fxWhat').textContent());
await pg.locator('#fixer .fx-len .btn[data-len="0.5"]').click(); await pg.waitForTimeout(900);
console.log('8分にした後:', await pg.locator('#fxWhat').textContent());
await pg.locator('#fxDot').click(); await pg.waitForTimeout(900);
console.log('付点にした後:', await pg.locator('#fxWhat').textContent());
await pg.screenshot({ path: path.join(HERE,'edit3.png') });
await pg.locator('#fxDel').click(); await pg.waitForTimeout(900);
const n1 = await pg.evaluate(()=>document.querySelectorAll('#sheet g.note').length);
console.log('消した後の音符:', n1, '（', n0, 'から）');
console.log('画面の乱れ:', errs.length?errs:'なし');
await b.close();

/* 「四隅を合わせる」画面が、ふつうの写真でも1画面に収まるか目で確かめる */
import { chromium } from 'playwright'; import path from 'path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport:{width:390,height:844} });
await pg.goto('file:///home/user/quiz/apps/score/prototype/index.html');
await pg.waitForTimeout(300);
await pg.setInputFiles('#pick', '/home/user/quiz/apps/score/spike/samples/mozart_photo.jpg');
await pg.waitForTimeout(900);
await pg.screenshot({ path: path.join(HERE,'shotui.png') });
await b.close();

/* 二値化画像の一部を拡大して切り出す。目で確かめるための道具。
   使い方: node crop.mjs 画像 x y w h [倍率] */
import { chromium } from 'playwright'; import fs from 'fs'; import path from 'path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const [file, x, y, w, h, z = '3'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage();
const src = 'data:image/png;base64,' + fs.readFileSync(path.join(HERE, file)).toString('base64');
const out = await pg.evaluate(async (a) => {
  const im = new Image(); im.src = a.src; await im.decode();
  const c = document.createElement('canvas');
  c.width = a.w * a.z; c.height = a.h * a.z;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(im, a.x, a.y, a.w, a.h, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}, { src, x: +x, y: +y, w: +w, h: +h, z: +z });
await b.close();
fs.writeFileSync(path.join(HERE, 'crop_out.png'), Buffer.from(out.split(',')[1], 'base64'));
console.log('crop_out.png');

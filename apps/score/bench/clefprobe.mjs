import { chromium } from 'playwright'; import fs from 'fs'; import path from 'path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const pg = await b.newPage();
await pg.goto('file:///home/user/quiz/apps/score/prototype/index.html');
await pg.waitForTimeout(300);
const src = 'data:image/png;base64,' + fs.readFileSync(path.join(HERE,'diag_bin.png')).toString('base64');
const out = await pg.evaluate(async (a)=>{
  const im=new Image(); im.src=a; await im.decode();
  const c=document.createElement('canvas'); c.width=im.width; c.height=im.height;
  c.getContext('2d').drawImage(im,0,0);
  const d=c.getContext('2d').getImageData(0,0,c.width,c.height);
  const W=c.width;
  const bin=(x,y)=>d.data[(y*W+x)*4]<128?1:0;
  // 段3: y 696-748, S=13。帯 660-790 で列ごとの最長連なりを測る
  const rows=[];
  for(let x=980;x<=1120;x+=2){
    let best=0,run=0,gap=0;
    for(let y=660;y<=790;y++){
      if(bin(x,y)){run+=gap+1;gap=0;if(run>best)best=run;}
      else if(run&&++gap>2){run=0;gap=0;}
    }
    rows.push(x+':'+best);
  }
  return rows.join(' ');
}, src);
await b.close();
console.log(out);

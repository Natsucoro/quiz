import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport:{width:390,height:844} });
pg.on('pageerror',e=>console.log('ERR',e.message.slice(0,160)));
await pg.goto('file:///home/user/quiz/apps/score/prototype/index.html');
await pg.waitForFunction(()=>document.querySelector('#sheet svg'),{timeout:60000});
const r = await pg.evaluate(async ()=>{
  const res = {};
  for (const [name, midis] of [['単音 ド4',[60]], ['低音 ド2',[36]], ['和音 ドミソ',[60,64,67]],
                               ['10音同時',[48,52,55,60,64,67,72,76,79,84]]]) {
    const off = new OfflineAudioContext(1, 44100*3, 44100);
    const saveAc = ac, saveMaster = master, saveNoise = noiseBuf, saveSrc = sources;
    ac = off; master = null; noiseBuf = null; sources = [];
    initAudio();
    midis.forEach(m => pluck(m, 0.05, 0.6));
    const buf = await off.startRendering();
    ac = saveAc; master = saveMaster; noiseBuf = saveNoise; sources = saveSrc;
    const d = buf.getChannelData(0);
    let peak = 0, clip = 0;
    for (let i=0;i<d.length;i++){ const v=Math.abs(d[i]); if(v>peak)peak=v; if(v>=0.999)clip++; }
    const rms = t => { const a=Math.floor(t*44100), b=Math.min(d.length,a+4410); let s=0;
      for(let i=a;i<b;i++)s+=d[i]*d[i]; return Math.sqrt(s/(b-a)); };
    res[name] = { peak:+peak.toFixed(3), clip,
      '0.1秒':+rms(0.1).toFixed(4), '0.5秒':+rms(0.5).toFixed(4),
      '1.0秒':+rms(1.0).toFixed(4), '2.0秒':+rms(2.0).toFixed(4) };
  }
  return res;
});
for (const [k,v] of Object.entries(r))
  console.log(`${k.padEnd(11)} 最大${String(v.peak).padStart(5)} 歪み${v.clip}箇所  音量の推移 0.1秒:${v['0.1秒']} → 0.5秒:${v['0.5秒']} → 1.0秒:${v['1.0秒']} → 2.0秒:${v['2.0秒']}`);
await b.close();

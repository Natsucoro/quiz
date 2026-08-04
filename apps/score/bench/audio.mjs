/* 音を数値で確かめる。耳だけだと分からなくなるので必ずここを通す。
   見るのは3つ。
     ・歪み   和音が重なったとき 1.0 を超えていないか（超えると割れる）
     ・減衰   低音ほど長く、高音ほど短く消えているか（ピアノの性質）
     ・長さ   全音符と16分音符が、ちゃんと違う長さで鳴っているか */
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
pg.on('pageerror', e => console.log('ERR', e.message.slice(0, 160)));
await pg.goto('file:///home/user/quiz/apps/score/prototype/index.html');
await pg.waitForFunction(() => document.querySelector('#sheet svg'), { timeout: 60000 });

const r = await pg.evaluate(async () => {
  const res = { tone: {}, sched: null, piece: null };
  const render = async (seconds, fn) => {
    const off = new OfflineAudioContext(1, 44100 * seconds, 44100);
    const save = [ac, master, noiseBuf, sources];
    ac = off; master = null; noiseBuf = null; sources = [];
    initAudio();
    fn();
    const buf = await off.startRendering();
    ac = save[0]; master = save[1]; noiseBuf = save[2]; sources = save[3];
    const d = buf.getChannelData(0);
    let peak = 0, clip = 0;
    for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; if (v >= 0.999) clip++; }
    const rms = t => {
      const a = Math.floor(t * 44100), z = Math.min(d.length, a + 4410);
      let s = 0; for (let i = a; i < z; i++) s += d[i] * d[i];
      return Math.sqrt(s / Math.max(1, z - a));
    };
    return { peak: +peak.toFixed(3), clip, rms };
  };

  for (const [name, midis] of [['単音 ド4', [60]], ['低音 ド2', [36]], ['和音 ドミソ', [60, 64, 67]],
                               ['10音同時', [48, 52, 55, 60, 64, 67, 72, 76, 79, 84]]]) {
    const o = await render(3, () => midis.forEach(m => pluck(m, 0.05, 0.6)));
    res.tone[name] = { peak: o.peak, clip: o.clip, t: [0.1, 0.5, 1.0, 2.0].map(t => +o.rms(t).toFixed(4)) };
  }

  // 長さの違いが音に出ているか。16分・4分・全音符を並べて鳴らし、消えるまでを測る
  const lens = {};
  for (const [name, dur] of [['16分', 0.125], ['4分', 0.5], ['全', 2.0]]) {
    const o = await render(5, () => pluck(60, 0.05, dur));
    let end = 0;
    for (let t = 0; t < 4.5; t += 0.05) if (o.rms(t) > 0.004) end = t;
    lens[name] = +(end + 0.05).toFixed(2);
  }
  res.lens = lens;

  // 速い連なりで音が団子にならないか。同じ強さで16音並べ、後半で音量が
  // 積み上がっていたら、前の音が消えきる前に次が来て濁っているということ
  {
    const o = await render(5, () => {
      for (let i = 0; i < 16; i++) pluck(60 + (i % 8), 0.05 + i * 0.113, 0.113);
    });
    res.run = { peak: o.peak, clip: o.clip,
                head: +o.rms(0.2).toFixed(4), tail: +o.rms(1.6).toFixed(4) };
  }

  // お手本の楽譜を実際に鳴らしたときの姿
  const durs = schedule.flatMap(e => e.notes.map(n => Math.round(n.dur)));
  const h = {}; durs.forEach(d => h[d] = (h[d] || 0) + 1);
  res.sched = { events: schedule.length, notes: durs.length,
                dur: Object.entries(h).sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}ms×${v}`).join(' ') };
  // 冒頭6秒ぶんを実際に組み立てて、割れていないか見る
  const p = await render(6, () => schedule.filter(e => e.t < 5000)
    .forEach(e => e.notes.forEach(n => pluck(n.midi, 0.05 + e.t / 1000, n.dur / 1000))));
  res.piece = { peak: p.peak, clip: p.clip };
  return res;
});
await b.close();

for (const [k, v] of Object.entries(r.tone))
  console.log(`${k.padEnd(11)} 最大${String(v.peak).padStart(5)} 歪み${v.clip}箇所  音量の推移 ` +
    `0.1秒:${v.t[0]} → 0.5秒:${v.t[1]} → 1.0秒:${v.t[2]} → 2.0秒:${v.t[3]}`);
console.log(`\n鳴る長さ  ` + Object.entries(r.lens).map(([k, v]) => `${k}音符:${v}秒`).join('  '));
console.log(`速い連なり 最大${r.run.peak} 歪み${r.run.clip}箇所  音量 前半${r.run.head} → 後半${r.run.tail}` +
  `（積み上がり ${(r.run.tail / Math.max(1e-6, r.run.head)).toFixed(2)}倍）`);
console.log(`お手本    ${r.sched.events}箇所 ${r.sched.notes}音   最大${r.piece.peak} 歪み${r.piece.clip}箇所`);
console.log(`  長さの内訳: ${r.sched.dur}`);

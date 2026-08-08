/* よその楽譜認識エンジン(サーバーのAudiveris等)が出した MusicXML を、
 * このアプリの「きれいな楽譜データ」に組み直す。
 *
 * そのまま使えない理由は2つ:
 *  ・小節の長さが拍子とずれていることがあり、ずれは後ろの小節へ雪だるま式に
 *    たまる(実測: 素通しだと鳴り出しの一致が7%、組み直すと93%)
 *  ・声部(voice)や backup が入り組んでいて、アプリの編集・移調・再生の
 *    前提(手ごとに1列)と合わない
 *
 * やること: 声部をほどいて「段ごとの音の列」に平らにする → 小節を
 * きっかり拍子の長さに合わせる(足りない所は休符、あふれた音は詰める)
 * → アプリ標準の2パート(右手/左手) MusicXML に組み直す。
 */
(function (global) {
  "use strict";

  const DIV = 24;                       // 4分音符を24分割(アプリ標準)
  const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const LETTER = ["C", "D", "E", "F", "G", "A", "B"];
  const SEMI = [0, 2, 4, 5, 7, 9, 11];

  /** @param {string[]} xmlStrings 楽章ごとのMusicXML
   *  @param {string} fallbackTime 拍子が読めなかったときに使う "3/4" など
   *  @returns {{xml:string, nNotes:number, sanity:number, time:string, fifths:number}|null}
   */
  function importMusicXML(xmlStrings, fallbackTime, title) {
    const measures = [];               // [{s1:[ev], s2:[ev]}] ev={at,q,midi,step,alter,oct,rest}
    let fifths = 0, beats = 0, beatType = 4;

    for (const xs of xmlStrings) {
      const doc = new DOMParser().parseFromString(xs, "application/xml");
      if (doc.querySelector("parsererror")) continue;
      for (const part of doc.querySelectorAll("part")) {
        let div = 1;
        for (const meas of part.querySelectorAll("measure")) {
          const dv = meas.querySelector("divisions");
          if (dv) div = +dv.textContent || 1;
          const ky = meas.querySelector("key > fifths");
          if (ky) fifths = +ky.textContent || 0;
          const bt = meas.querySelector("time > beats");
          const bty = meas.querySelector("time > beat-type");
          if (bt && bty) { beats = +bt.textContent; beatType = +bty.textContent; }
          const bucket = { s1: [], s2: [] };
          let pos = 0, prev = 0, prevAt = 0;
          for (const el of meas.children) {
            if (el.tagName === "backup") {
              pos -= +(el.querySelector("duration") || {}).textContent / div || 0; prev = 0; continue;
            }
            if (el.tagName === "forward") {
              pos += +(el.querySelector("duration") || {}).textContent / div || 0; continue;
            }
            if (el.tagName !== "note") continue;
            if (el.querySelector("grace")) continue;      // 装飾音は落とす
            const durEl = el.querySelector("duration");
            const q = durEl ? +durEl.textContent / div : 0;
            const isChord = !!el.querySelector("chord");
            const at = isChord ? prevAt : pos;
            const staffEl = el.querySelector("staff");
            const s = staffEl && staffEl.textContent === "2" ? "s2" : "s1";
            const p = el.querySelector("pitch");
            if (p) {
              const step = p.querySelector("step").textContent;
              const oct = +p.querySelector("octave").textContent;
              const altEl = p.querySelector("alter");
              const alter = altEl ? Math.round(+altEl.textContent) : 0;
              const midi = (oct + 1) * 12 + STEP[step] + alter;
              // タイの後半は新しい鳴り出しではないので落とす(前の音が伸びる扱い)
              const tied = Array.from(el.querySelectorAll("tie"))
                .some(t => t.getAttribute("type") === "stop");
              const started = Array.from(el.querySelectorAll("tie"))
                .some(t => t.getAttribute("type") === "start");
              if (!(tied && !started)) {
                bucket[s].push({ at, q, midi, step, alter, oct });
              }
            }
            if (!isChord) { prevAt = pos; prev = q; pos += q; }
          }
          measures.push(bucket);
        }
        break;                          // ピアノ譜は最初のパートだけ(2段ぶん入っている)
      }
    }
    if (!measures.length) return null;
    if (!beats) {
      const [b, t] = (fallbackTime || "4/4").split("/").map(Number);
      beats = b; beatType = t;
    }
    const measureQ = beats * 4 / beatType;
    const target = Math.round(measureQ * DIV);

    // 小節の中身が拍子とどれくらい合っているか(エンジン選びの手がかり)
    let okCount = 0;
    for (const m of measures) {
      const span = Math.max(
        ...["s1", "s2"].map(s => m[s].reduce((a, e) => Math.max(a, e.at + e.q), 0)), 0);
      if (span > 0 && Math.abs(span - measureQ) <= measureQ * 0.15) okCount++;
    }
    const sanity = measures.length ? okCount / measures.length : 0;

    // ── 段ごとの列に平らにして、小節をきっかり拍子に合わせる ──
    // 浄書エンジン(Verovio)は duration と type が食い違うと type を信じるので、
    // 長さは必ず「標準の音価(付点含む)の組み合わせ」に分解して書き出す。
    // これを守らないと、書いた長さと鳴る長さがずれてリズムが崩れる
    const STD = [
      [96, "whole", false], [72, "half", true], [48, "half", false],
      [36, "quarter", true], [24, "quarter", false], [18, "eighth", true],
      [12, "eighth", false], [9, "16th", true], [6, "16th", false], [3, "32nd", false],
    ];
    const decompose = d => {           // 24分割の長さ → 標準音価の列
      const out = [];
      let r = Math.max(3, Math.round(d / 3) * 3);   // 32分刻みに吸着
      while (r > 0) {
        const s = STD.find(x => x[0] <= r) || STD[STD.length - 1];
        out.push(s); r -= s[0];
      }
      return out;
    };
    const esc = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

    let nNotes = 0;
    const buildMeasure = evs => {
      // 同じ位置の音は和音にまとめる(位置は32分刻みで吸着)
      const groups = new Map();
      for (const e of evs) {
        const key = Math.round(e.at * 8) / 8;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(e);
      }
      const cols = Array.from(groups.entries()).sort((a, b) => a[0] - b[0])
        .map(([at, list]) => ({
          at: Math.round(at * DIV),
          q: Math.round(Math.max(...list.map(e => e.q)) * DIV),
          notes: list.filter((e, i, arr) =>
            arr.findIndex(o => o.midi === e.midi) === i),   // 声部重複の同音を1つに
        }));
      // 位置どおりに置き、すき間は休符で埋め、あふれは詰める。
      // 位置と長さは32分刻みに吸着させる(吸着しないと標準音価に分解できない)
      let xml = "", t = 0;
      for (const c of cols) {
        let at = Math.round(Math.max(t, Math.min(c.at, target)) / 3) * 3;
        if (at > t) { xml += rest(at - t); t = at; }
        let d = Math.round(Math.min(c.q, target - t) / 3) * 3;
        if (d <= 0) continue;
        // 音符本体は先頭の標準音価ひとつ、残りは休符にする
        // (タイで繋ぐより単純で、鳴り出しの時刻は正確に保たれる)
        const partsD = decompose(d);
        const [nd, ty, dot] = partsD[0];
        c.notes.forEach((n, i) => {
          xml += `<note>${i > 0 ? "<chord/>" : ""}<pitch><step>${n.step}</step>` +
            (n.alter ? `<alter>${n.alter}</alter>` : "") +
            `<octave>${n.oct}</octave></pitch>` +
            `<duration>${nd}</duration><type>${ty}</type>${dot ? "<dot/>" : ""}</note>`;
          nNotes++;
        });
        t += nd;
        for (const [rd] of partsD.slice(1)) { xml += rest(rd); t += rd; }
      }
      if (t < target) xml += rest(target - t);
      return xml;
    };
    const rest = d => decompose(d).map(([rd, ty, dot]) =>
      `<note><rest/><duration>${rd}</duration><type>${ty}</type>${dot ? "<dot/>" : ""}</note>`).join("");

    let xml = `<?xml version="1.0" encoding="UTF-8"?>` +
      `<score-partwise version="3.1"><part-list>` +
      `<part-group number="1" type="start"><group-symbol>brace</group-symbol></part-group>` +
      `<score-part id="P1"><part-name print-object="no">右手</part-name></score-part>` +
      `<score-part id="P2"><part-name print-object="no">左手</part-name></score-part>` +
      `<part-group number="1" type="stop"/></part-list>` +
      (title ? `<work><work-title>${esc(title)}</work-title></work>` : "");
    for (let hand = 0; hand < 2; hand++) {
      xml += `<part id="P${hand + 1}">`;
      measures.forEach((m, mi) => {
        xml += `<measure number="${mi + 1}">`;
        if (mi === 0) {
          xml += `<attributes><divisions>${DIV}</divisions>` +
            `<key><fifths>${fifths}</fifths></key>` +
            `<time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time>` +
            (hand ? `<clef><sign>F</sign><line>4</line></clef>`
                  : `<clef><sign>G</sign><line>2</line></clef>`) +
            `</attributes>`;
        }
        xml += buildMeasure(m[hand ? "s2" : "s1"]);
        xml += `</measure>`;
      });
      xml += `</part>`;
    }
    xml += `</score-partwise>`;
    return { xml, nNotes, sanity, time: `${beats}/${beatType}`, fifths };
  }

  global.ImportXML = { importMusicXML };
})(typeof window !== "undefined" ? window : globalThis);

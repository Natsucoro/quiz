/* 読み取り結果を MusicXML に組み立てる。
 *
 * ここを通すと、写真は「画像」ではなく「楽譜データ」になる。
 * データになれば、浄書し直す・移調する・音符を直す・きれいに印刷する、が全部できる。
 *
 * 段の並びは 上・下・上・下… なので、上だけを右手、下だけを左手として
 * 2つのパートに束ね直す。小節は小節線で切り、同じ位置に重なる音符は和音にする。
 */
(function (global) {
  "use strict";

  const DIVISIONS = 24;           // 4分音符を24分割。16分も3連符も表せる
  const LETTER = ["C", "D", "E", "F", "G", "A", "B"];
  const TYPES = [
    [4, "whole"], [3, "half"], [2, "half"], [1.5, "quarter"], [1, "quarter"],
    [0.75, "eighth"], [0.5, "eighth"], [0.375, "16th"], [0.25, "16th"],
    [0.1875, "32nd"], [0.125, "32nd"],
  ];
  const typeOf = q => {
    let best = TYPES[0];
    for (const t of TYPES) if (Math.abs(t[0] - q) < Math.abs(best[0] - q)) best = t;
    return best[1];
  };
  const esc = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

  /** 同じ位置に重なる音符を和音としてまとめる */
  function toChords(notes, S) {
    const sorted = notes.slice().sort((a, b) => a.x - b.x || a.midi - b.midi);
    const out = [];
    for (const n of sorted) {
      const last = out[out.length - 1];
      if (last && Math.abs(n.x - last.x) <= S * 0.6) {
        if (!last.notes.some(m => m.dia === n.dia)) last.notes.push(n);
      } else out.push({ x: n.x, notes: [n] });
    }
    // 和音の長さは、構成音のうち最も多く現れた値にする
    for (const c of out) {
      const tally = new Map();
      for (const n of c.notes) tally.set(n.q, (tally.get(n.q) || 0) + 1);
      let win = c.notes[0].q, cnt = 0;
      for (const [k, v] of tally) if (v > cnt) { win = k; cnt = v; }
      c.q = win;
      c.dot = c.notes.some(n => n.dot);
    }
    return out;
  }

  /**
   * @param {object} omr  OMR.readScore の結果
   * @param {{time?: string, key?: number, title?: string}} opts
   *        time 例 "4/4"（省略時は拍子を書かない）、key は調号の♯の数（♭は負）
   */
  function toMusicXML(omr, opts) {
    opts = opts || {};
    const staves = omr.staves || [];
    if (!staves.length) return null;
    const nSystems = Math.max.apply(null, staves.map(s => s.system || 0)) + 1;

    // 段を「右手（上）」「左手（下）」の2つのパートに束ね直す。
    // どの段がどちらの手かは、段番号ではなく OMR が求めたシステム内の位置で決める。
    const parts = [[], []];         // parts[hand] = 小節の配列
    for (let sys = 0; sys < nSystems; sys++) {
      const before = [parts[0].length, parts[1].length];
      let added = 0;
      for (let hand = 0; hand < 2; hand++) {
        const si = staves.findIndex(s => (s.system || 0) === sys && (s.hand || 0) === hand);
        if (si < 0) continue;
        const S = staves[si].space;
        const mine = (omr.notes || []).filter(n => n.staff === si);
        const nBars = ((omr.bars && omr.bars[si]) || []).length;
        for (let m = 0; m <= nBars; m++) {
          parts[hand].push(toChords(mine.filter(n => n.measure === m), S));
        }
        added = Math.max(added, nBars + 1);
      }
      // 片手ぶんしか無いシステムでも、小節数がそろうように空小節で埋める
      for (let hand = 0; hand < 2; hand++) {
        while (parts[hand].length < before[hand] + added) parts[hand].push([]);
      }
    }
    // 末尾にできた空の小節は落とす
    for (const pt of parts) while (pt.length && !pt[pt.length - 1].length) pt.pop();
    // 小節数を両手でそろえる
    const nMeasures = Math.max(parts[0].length, parts[1].length);
    for (const p of parts) while (p.length < nMeasures) p.push([]);

    const [beats, beatType] = (opts.time || "4/4").split("/").map(Number);
    const measureQ = opts.time ? beats * (4 / beatType) : 0;

    // 半音の上げ下げは、調号まかせにせず1音ずつ書き出す。
    // 調号だけに頼ると、曲の途中の臨時記号を後から足せないし、
    // 読み取った音の高さと楽譜データの音の高さがずれても気づけない。
    const SEMI = [0, 2, 4, 5, 7, 9, 11];
    const noteXML = (n, isChord, q, dot) => {
      const type = typeOf(q);
      const dur = Math.max(1, Math.round(q * DIVISIONS));
      const oct = Math.floor(n.dia / 7), le = ((n.dia % 7) + 7) % 7;
      let alter = 0;
      if (typeof n.midi === "number") {
        alter = Math.max(-2, Math.min(2, n.midi - ((oct + 1) * 12 + SEMI[le])));
      }
      return `<note>${isChord ? "<chord/>" : ""}` +
        `<pitch><step>${LETTER[le]}</step>` +
        (alter ? `<alter>${alter}</alter>` : "") +
        `<octave>${oct}</octave></pitch>` +
        `<duration>${dur}</duration><type>${type}</type>${dot ? "<dot/>" : ""}</note>`;
    };
    const restXML = q => {
      const dur = Math.max(1, Math.round(q * DIVISIONS));
      return `<note><rest/><duration>${dur}</duration><type>${typeOf(q)}</type></note>`;
    };

    let xml = `<?xml version="1.0" encoding="UTF-8"?>` +
      `<score-partwise version="3.1"><part-list>` +
      `<part-group number="1" type="start"><group-symbol>brace</group-symbol></part-group>` +
      `<score-part id="P1"><part-name print-object="no">右手</part-name></score-part>` +
      `<score-part id="P2"><part-name print-object="no">左手</part-name></score-part>` +
      `<part-group number="1" type="stop"/></part-list>`;
    if (opts.title) xml += `<work><work-title>${esc(opts.title)}</work-title></work>`;

    for (let hand = 0; hand < 2; hand++) {
      xml += `<part id="P${hand + 1}">`;
      for (let m = 0; m < nMeasures; m++) {
        xml += `<measure number="${m + 1}">`;
        if (m === 0) {
          xml += `<attributes><divisions>${DIVISIONS}</divisions>` +
            `<key><fifths>${opts.key || 0}</fifths></key>` +
            (opts.time ? `<time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time>` : "") +
            (hand === 0 ? `<clef><sign>G</sign><line>2</line></clef>`
                        : `<clef><sign>F</sign><line>4</line></clef>`) +
            `</attributes>`;
        }
        const chords = parts[hand][m] || [];
        let filled = 0;
        for (const c of chords) {
          c.notes.forEach((n, i) => { xml += noteXML(n, i > 0, c.q, c.dot); });
          filled += c.q;
        }
        // 拍子が指定されていれば、足りない/余る分を休符で辻褄合わせする
        if (measureQ) {
          if (!chords.length) xml += restXML(measureQ);
          else if (filled < measureQ - 1e-6) xml += restXML(measureQ - filled);
        } else if (!chords.length) {
          xml += restXML(1);
        }
        xml += `</measure>`;
      }
      xml += `</part>`;
    }
    return xml + `</score-partwise>`;
  }

  global.ScoreBuild = { toMusicXML, DIVISIONS };
})(typeof window !== "undefined" ? window : globalThis);

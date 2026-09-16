/* Four-symbol / triple-binary codec. Pure functions. No DOM. No app state. */
(function (root) {
  "use strict";

  const SQ0 = "sq0";
  const SQ1 = "sq1";
  const BAR0 = "bar0";
  const BAR1 = "bar1";
  const SPACE_BITS = [0, 0, 1, 0, 0, 0, 0, 0];

  const FOLD = {
    0x2018: "'",
    0x2019: "'",
    0x201c: '"',
    0x201d: '"',
    0x2013: "-",
    0x2014: "-",
    0x2015: "-",
    0x2026: "...",
    0x2002: " ",
  };

  function bit01(v) {
    return v ? 1 : 0;
  }

  function asBits(src) {
    if (src == null) return [];
    if (Array.isArray(src)) {
      const out = [];
      for (let i = 0; i < src.length; i++) out.push(bit01(src[i]));
      return out;
    }
    const s = String(src);
    const out = [];
    for (let i = 0; i < s.length; i++) {
      const ch = s.charCodeAt(i);
      if (ch === 48) out.push(0);
      else if (ch === 49) out.push(1);
    }
    return out;
  }

  function bitsJoin(bits) {
    let s = "";
    for (let i = 0; i < bits.length; i++) s += bits[i] ? "1" : "0";
    return s;
  }

  function packGlyph(c1, extra) {
    if (!bit01(c1)) return bit01(extra) ? SQ1 : SQ0;
    return bit01(extra) ? BAR1 : BAR0;
  }

  function unpackGlyph(g) {
    if (g === SQ0) return { c1: 0, c2: 0, c3: null };
    if (g === SQ1) return { c1: 0, c2: 1, c3: null };
    if (g === BAR0) return { c1: 1, c2: null, c3: 0 };
    if (g === BAR1) return { c1: 1, c2: null, c3: 1 };
    return { c1: 0, c2: 0, c3: null };
  }

  function count01(bits) {
    let z = 0;
    let o = 0;
    for (let i = 0; i < bits.length; i++) {
      if (bits[i]) o += 1;
      else z += 1;
    }
    return { zeros: z, ones: o };
  }

  function merge(c1Bits, c2Bits, c3Bits) {
    const c1 = asBits(c1Bits);
    const c2 = asBits(c2Bits);
    const c3 = asBits(c3Bits);
    let padBytes = 0;
    while (true) {
      const n = count01(c1);
      if (n.zeros >= c2.length && n.ones >= c3.length) break;
      for (let i = 0; i < 8; i++) c1.push(SPACE_BITS[i]);
      padBytes += 1;
    }
    const glyphs = [];
    let i2 = 0;
    let i3 = 0;
    for (let i = 0; i < c1.length; i++) {
      if (c1[i]) {
        const extra = i3 < c3.length ? c3[i3] : 0;
        i3 += 1;
        glyphs.push(packGlyph(1, extra));
      } else {
        const extra = i2 < c2.length ? c2[i2] : 0;
        i2 += 1;
        glyphs.push(packGlyph(0, extra));
      }
    }
    return { glyphs: glyphs, padBytes: padBytes };
  }

  function split(glyphs) {
    const list = glyphs || [];
    const c1 = [];
    const c2 = [];
    const c3 = [];
    for (let i = 0; i < list.length; i++) {
      const u = unpackGlyph(list[i]);
      c1.push(u.c1);
      if (u.c1 === 0) c2.push(u.c2);
      else c3.push(u.c3);
    }
    return { c1: c1, c2: c2, c3: c3 };
  }

  function asciiToBits(str) {
    const s = str == null ? "" : String(str);
    const bits = [];
    for (let i = 0; i < s.length; i++) {
      const cp = s.codePointAt(i);
      if (cp > 0xffff) i += 1;
      let chunk = "";
      if (FOLD[cp] != null) chunk = FOLD[cp];
      else if (cp > 255) chunk = "?";
      else chunk = String.fromCharCode(cp);
      for (let j = 0; j < chunk.length; j++) {
        const b = chunk.charCodeAt(j) & 0xff;
        for (let k = 7; k >= 0; k--) bits.push((b >> k) & 1);
      }
    }
    return bits;
  }

  function bitsToAscii(bits) {
    const b = asBits(bits);
    const n = b.length - (b.length % 8);
    let out = "";
    for (let i = 0; i < n; i += 8) {
      let v = 0;
      for (let k = 0; k < 8; k++) v = (v << 1) | b[i + k];
      out += String.fromCharCode(v);
    }
    return out;
  }

  function remainderBits(bits) {
    const b = asBits(bits);
    return b.slice(b.length - (b.length % 8));
  }

  function encodeTextpic(text, bitsA, bitsB) {
    return merge(asciiToBits(text), bitsA, bitsB);
  }

  function decodeTextpic(glyphs, wA, hA, wB, hB) {
    const s = split(glyphs);
    const nA = Math.max(0, (wA | 0) * (hA | 0));
    const nB = Math.max(0, (wB | 0) * (hB | 0));
    return {
      text: bitsToAscii(s.c1),
      a: s.c2.slice(0, nA),
      b: s.c3.slice(0, nB),
      c1: s.c1,
      c2: s.c2,
      c3: s.c3,
    };
  }

  function fieldGlyph(post, mapId, helpers) {
    post = post || {};
    helpers = helpers || {};
    const id = mapId || "spoke-hops";
    let c1 = 0;
    let extra = 0;
    if (id === "ampm-lock") {
      c1 = (post.hh | 0) >= 12 ? 1 : 0;
      const lock = helpers.firstLock ? helpers.firstLock(post.q) : 421;
      extra = lock === 1222 ? 1 : 0;
    } else if (id === "even-q") {
      c1 = (post.q | 0) % 2 ? 1 : 0;
      extra = (helpers.inDegree ? helpers.inDegree(post.q) : 0) > 0 ? 1 : 0;
    } else if (id === "timehash") {
      const n = (post.hh | 0) * 100 + (post.mm | 0);
      const n12 = (((post.hh | 0) + 12) % 24) * 100 + (post.mm | 0);
      c1 = helpers.hasQ && helpers.hasQ(n) ? 1 : 0;
      extra = helpers.hasQ && helpers.hasQ(n12) ? 1 : 0;
    } else {
      c1 = (post.spoke | 0) >= 30 ? 1 : 0;
      extra = (post.hops | 0) >= 4 ? 1 : 0;
    }
    return packGlyph(c1, extra);
  }

  function fieldCensus(posts, mapId, helpers) {
    const counts = { sq0: 0, sq1: 0, bar0: 0, bar1: 0 };
    const list = posts || [];
    for (let i = 0; i < list.length; i++) {
      const g = fieldGlyph(list[i], mapId, helpers);
      if (counts[g] != null) counts[g] += 1;
    }
    return counts;
  }

  const PITCH4 = {
    sq0: 432,
    sq1: 432 * Math.pow(2, 0.25),
    bar0: 432 * Math.pow(2, 0.5),
    bar1: 432 * Math.pow(2, 0.75),
  };

  function glyphFreq(g, voice) {
    if (voice === "silent") return 0;
    if (voice === "shape-oct") return g === BAR0 || g === BAR1 ? 864 : 432;
    return PITCH4[g] || 432;
  }

  function glyphAmp(g, voice) {
    if (voice === "silent") return 0;
    if (voice === "shape-oct") return g === SQ1 || g === BAR1 ? 0.45 : 1;
    return 1;
  }

  root.Quads = {
    SQ0: SQ0,
    SQ1: SQ1,
    BAR0: BAR0,
    BAR1: BAR1,
    PITCH4: PITCH4,
    packGlyph: packGlyph,
    unpackGlyph: unpackGlyph,
    merge: merge,
    split: split,
    asciiToBits: asciiToBits,
    bitsToAscii: bitsToAscii,
    remainderBits: remainderBits,
    encodeTextpic: encodeTextpic,
    decodeTextpic: decodeTextpic,
    fieldGlyph: fieldGlyph,
    fieldCensus: fieldCensus,
    glyphFreq: glyphFreq,
    glyphAmp: glyphAmp,
    asBits: asBits,
    bitsJoin: bitsJoin,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);

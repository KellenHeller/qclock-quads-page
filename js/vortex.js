/* 9-symbol digit codec. Pure functions. No DOM.
   Own digital-root helper — do not patch quads.js. */
(function (root) {
  "use strict";

  const DOUBLING = [1, 2, 4, 8, 7, 5];
  const FLUX = [3, 6];
  const POLAR = { 0: 9, 1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1, 9: 0 };
  const LAYOUT = { top: 9, clockwise: [1, 2, 3, 4, 5, 6, 7, 8], center: 0 };

  const SOLID = ["d0", "sq0", "ch2", "tr3", "bar0", "bar5", "tr6", "ch7", "sq8", "ax9"];
  const HOLLOW = ["d0h", "sq1", "ch2h", "tr3h", "bar1", "bar5h", "tr6h", "ch7h", "sq8h", "ax9h"];
  const GLYPH_DIGIT = {};
  const GLYPH_EXTRA = {};
  for (let d = 0; d <= 9; d++) {
    GLYPH_DIGIT[SOLID[d]] = d;
    GLYPH_DIGIT[HOLLOW[d]] = d;
    GLYPH_EXTRA[SOLID[d]] = 0;
    GLYPH_EXTRA[HOLLOW[d]] = 1;
  }

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

  function dr(n) {
    n = Math.trunc(Number(n) || 0);
    if (n < 0) n = -n;
    if (n === 0) return 0;
    const r = n % 9;
    return r === 0 ? 9 : r;
  }

  function drAxis(n) {
    const d = dr(n);
    return d === 0 ? 9 : d;
  }

  function family(d) {
    const n = d | 0;
    if (n === 1 || n === 4 || n === 7) return "147";
    if (n === 2 || n === 5 || n === 8) return "258";
    if (n === 3 || n === 6 || n === 9) return "369";
    return "hole";
  }

  function orbit(d) {
    const n = d | 0;
    if (n === 0) return "hole";
    if (n === 9) return "axis";
    if (n === 3 || n === 6) return "flux";
    if (n === 1 || n === 2 || n === 4 || n === 8 || n === 7 || n === 5) return "doubling";
    return "hole";
  }

  function polar(d) {
    const n = d | 0;
    return POLAR[n] == null ? 0 : POLAR[n];
  }

  function packDigit(d, extra) {
    const n = ((d | 0) % 10 + 10) % 10;
    return bit01(extra) ? HOLLOW[n] : SOLID[n];
  }

  function unpackGlyph(g) {
    const name = String(g || "");
    if (GLYPH_DIGIT[name] == null) return { d: 0, extra: 0, even: true };
    const digit = GLYPH_DIGIT[name];
    return { d: digit, extra: GLYPH_EXTRA[name], even: digit % 2 === 0 };
  }

  function mergeDigits(c1, c2Bits, c3Bits) {
    const digits = [];
    const src = c1 || [];
    for (let i = 0; i < src.length; i++) {
      const n = src[i] | 0;
      digits.push(((n % 10) + 10) % 10);
    }
    const c2 = asBits(c2Bits);
    const c3 = asBits(c3Bits);
    function counts() {
      let even = 0;
      let odd = 0;
      for (let i = 0; i < digits.length; i++) {
        if (digits[i] % 2 === 0) even += 1;
        else odd += 1;
      }
      return { even: even, odd: odd };
    }
    let guard = 0;
    while (guard < 4096) {
      const n = counts();
      if (n.even >= c2.length && n.odd >= c3.length) break;
      if (n.odd < c3.length) digits.push(9);
      else digits.push(0);
      guard += 1;
    }
    const glyphs = [];
    let i2 = 0;
    let i3 = 0;
    for (let i = 0; i < digits.length; i++) {
      const digit = digits[i];
      let extra = 0;
      if (digit % 2 === 0) {
        extra = i2 < c2.length ? c2[i2] : 0;
        i2 += 1;
      } else {
        extra = i3 < c3.length ? c3[i3] : 0;
        i3 += 1;
      }
      glyphs.push(packDigit(digit, extra));
    }
    return { glyphs: glyphs, digits: digits, padHoles: digits.length - src.length };
  }

  function foldChunk(cp) {
    if (FOLD[cp] != null) return FOLD[cp];
    if (cp > 255) return "?";
    return String.fromCharCode(cp);
  }

  function asciiBytes(str) {
    const s = str == null ? "" : String(str);
    const out = [];
    for (let i = 0; i < s.length; i++) {
      const cp = s.codePointAt(i);
      if (cp > 0xffff) i += 1;
      const chunk = foldChunk(cp);
      for (let j = 0; j < chunk.length; j++) out.push(chunk.charCodeAt(j) & 0xff);
    }
    return out;
  }

  function asciiToDigits(str) {
    const bytes = asciiBytes(str);
    const digits = [];
    for (let i = 0; i < bytes.length; i++) {
      const v = bytes[i];
      digits.push(Math.floor(v / 100) % 10);
      digits.push(Math.floor(v / 10) % 10);
      digits.push(v % 10);
    }
    return digits;
  }

  function digitsToAscii(digits) {
    const d = digits || [];
    const n = d.length - (d.length % 3);
    let out = "";
    for (let i = 0; i < n; i += 3) {
      const v = (d[i] | 0) * 100 + (d[i + 1] | 0) * 10 + (d[i + 2] | 0);
      out += String.fromCharCode(v & 0xff);
    }
    return out;
  }

  function byteRoots(str) {
    const bytes = asciiBytes(str);
    const out = [];
    for (let i = 0; i < bytes.length; i++) out.push(dr(bytes[i]));
    return out;
  }

  function pad2(n) {
    return String(n | 0).padStart(2, "0");
  }

  function digitsOfInt(n) {
    const s = String(Math.abs(n | 0));
    const out = [];
    for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i) - 48);
    return out;
  }

  function dateKeyString(iso) {
    const s = String(iso || "");
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return "";
    return String(Number(m[2])) + m[3];
  }

  function dateKeyDigits(iso) {
    const s = dateKeyString(iso);
    const out = [];
    for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i) - 48);
    return out;
  }

  function qDigitTape(post) {
    post = post || {};
    const q = digitsOfInt(post.q);
    const date = dateKeyDigits(post.date);
    const time = (pad2(post.hh) + pad2(post.mm) + pad2(post.ss)).split("");
    const out = q.concat(date);
    for (let i = 0; i < time.length; i++) out.push(time[i].charCodeAt(0) - 48);
    return out;
  }

  function familyChip(post) {
    return dr((post && post.q) || 0);
  }

  function allDigitsDoubling(n) {
    const s = String(Math.abs(n | 0));
    for (let i = 0; i < s.length; i++) {
      const d = s.charCodeAt(i) - 48;
      if (DOUBLING.indexOf(d) < 0) return false;
    }
    return s.length > 0;
  }

  function census(posts) {
    const list = posts || [];
    const roots = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
    const fam = { "147": 0, "258": 0, "369": 0 };
    const orb = { doubling: 0, flux: 0, axis: 0, hole: 0 };
    let doublingDigits = 0;
    for (let i = 0; i < list.length; i++) {
      const d = dr(list[i].q);
      if (roots[d] != null) roots[d] += 1;
      const f = family(d);
      if (fam[f] != null) fam[f] += 1;
      const o = orbit(d);
      if (orb[o] != null) orb[o] += 1;
      if (allDigitsDoubling(list[i].q)) doublingDigits += 1;
    }
    return {
      n: list.length,
      roots: roots,
      family: fam,
      orbit: orb,
      allDigitsDoubling: doublingDigits,
    };
  }

  function rimAngle(d) {
    if ((d | 0) === 9) return -Math.PI / 2;
    const i = LAYOUT.clockwise.indexOf(d | 0);
    if (i < 0) return 0;
    return -Math.PI / 2 + ((i + 1) * 2 * Math.PI) / 9;
  }

  root.Vortex = {
    DOUBLING: DOUBLING,
    FLUX: FLUX,
    POLAR: POLAR,
    LAYOUT: LAYOUT,
    SOLID: SOLID,
    HOLLOW: HOLLOW,
    dr: dr,
    drAxis: drAxis,
    family: family,
    orbit: orbit,
    polar: polar,
    packDigit: packDigit,
    unpackGlyph: unpackGlyph,
    mergeDigits: mergeDigits,
    asciiBytes: asciiBytes,
    asciiToDigits: asciiToDigits,
    digitsToAscii: digitsToAscii,
    byteRoots: byteRoots,
    qDigitTape: qDigitTape,
    dateKeyString: dateKeyString,
    dateKeyDigits: dateKeyDigits,
    familyChip: familyChip,
    census: census,
    allDigitsDoubling: allDigitsDoubling,
    rimAngle: rimAngle,
    pad2: pad2,
    digitsOfInt: digitsOfInt,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);

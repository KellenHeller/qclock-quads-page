/* Pure peel / mute / shuffle for the :8558 four-symbol page. No DOM. */
(function (root) {
  "use strict";

  const NAMES = ["sq0", "sq1", "bar0", "bar1"];
  const CODE_FROM = { sq0: 0, sq1: 1, bar0: 2, bar1: 3, 0: 0, 1: 1, 2: 2, 3: 3 };
  const SEED = 421;
  const INK_C2 = "#c41e3a";
  const INK_C3 = "#1e4ec4";
  const INK_C4 = "#1e9c3a";

  function codeOf(g) {
    if (typeof g === "number" && isFinite(g)) return g & 3;
    if (CODE_FROM[g] != null) return CODE_FROM[g];
    return 0;
  }

  function unpackIndex(g) {
    const c = codeOf(g);
    if (c === 0) return { c1: 0, c2: 0, c3: null };
    if (c === 1) return { c1: 0, c2: 1, c3: null };
    if (c === 2) return { c1: 1, c2: null, c3: 0 };
    return { c1: 1, c2: null, c3: 1 };
  }

  function tapeAlignedPlates(glyphs) {
    const n = glyphs && glyphs.length ? glyphs.length : 0;
    const c1 = new Array(n);
    const c2 = new Array(n);
    const c3 = new Array(n);
    for (let i = 0; i < n; i++) {
      const u = unpackIndex(glyphs[i]);
      c1[i] = u.c1;
      c2[i] = u.c2;
      c3[i] = u.c3;
    }
    return { c1: c1, c2: c2, c3: c3 };
  }

  function streamRaster(bits, w, h) {
    const n = Math.max(0, (w | 0) * (h | 0));
    const src = bits || [];
    const out = new Array(n);
    for (let i = 0; i < n; i++) {
      if (i >= src.length) out[i] = -1;
      else out[i] = src[i] ? 1 : 0;
    }
    return out;
  }

  function muteMask(glyphs, muteMap) {
    muteMap = muteMap || {};
    const n = glyphs && glyphs.length ? glyphs.length : 0;
    const vis = new Array(n);
    for (let i = 0; i < n; i++) {
      vis[i] = !muteMap[NAMES[codeOf(glyphs[i])]];
    }
    return vis;
  }

  function mulberry32(seed) {
    let a = seed | 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffleInPlace(out, seed) {
    const rnd = mulberry32(seed == null ? SEED : seed);
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  function shuffleGlyphs(glyphs, seed) {
    const n = glyphs && glyphs.length ? glyphs.length : 0;
    const out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = glyphs[i];
    return shuffleInPlace(out, seed);
  }

  function shufflePosts(posts, seed) {
    const n = posts && posts.length ? posts.length : 0;
    const idx = new Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    return shuffleInPlace(idx, seed);
  }

  function iou(bitsA, bitsB) {
    const a = bitsA || [];
    const b = bitsB || [];
    const n = Math.min(a.length, b.length);
    let inter = 0;
    let union = 0;
    for (let i = 0; i < n; i++) {
      if (a[i] === -1 || b[i] === -1 || a[i] == null || b[i] == null) continue;
      const aa = a[i] ? 1 : 0;
      const bb = b[i] ? 1 : 0;
      if (aa || bb) union += 1;
      if (aa && bb) inter += 1;
    }
    return union ? inter / union : 0;
  }

  function namesOf(glyphs) {
    const n = glyphs && glyphs.length ? glyphs.length : 0;
    const out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = NAMES[codeOf(glyphs[i])] || "sq0";
    return out;
  }

  function splitAligned(glyphs) {
    const Q = root.Quads;
    if (Q && Q.split) return Q.split(namesOf(glyphs));
    const c1 = [];
    const c2 = [];
    const c3 = [];
    const n = glyphs && glyphs.length ? glyphs.length : 0;
    for (let i = 0; i < n; i++) {
      const u = unpackIndex(glyphs[i]);
      c1.push(u.c1);
      if (u.c1 === 0) c2.push(u.c2);
      else c3.push(u.c3);
    }
    return { c1: c1, c2: c2, c3: c3 };
  }

  function streamSize(cellKind, nBits) {
    if (cellKind === "fish") return { w: 8, h: 14 };
    if (cellKind === "cross") return { w: 10, h: 10 };
    if (cellKind === "weeks") return { w: 7, h: Math.max(1, Math.ceil((nBits || 1) / 7)) };
    if (cellKind === "notebook") return { w: 32, h: Math.max(1, Math.ceil((nBits || 1) / 32)) };
    if (cellKind === "square" || cellKind === "spiral") {
      const n = Math.max(1, nBits | 0);
      const side = Math.max(1, Math.ceil(Math.sqrt(n)));
      return { w: side, h: side };
    }
    const n = Math.max(1, nBits | 0);
    return { w: 8, h: Math.max(1, Math.ceil(n / 8)) };
  }

  function countInk(bits) {
    let n = 0;
    const list = bits || [];
    for (let i = 0; i < list.length; i++) {
      if (list[i] === 1) n += 1;
    }
    return n;
  }

  function frameSpec(cellKind) {
    if (cellKind === "fish") return { id: "fish", cols: 8, rows: 14, n: 112, packed: true };
    if (cellKind === "cross") return { id: "cross", cols: 10, rows: 10, n: 100, packed: true };
    if (cellKind === "weeks") return { id: "weeks", cols: 7, rows: 8, n: 56, packed: true };
    if (cellKind === "notebook") return { id: "notebook", cols: 32, rows: 2, n: 64, packed: true };
    return { id: "byte", cols: 8, rows: 8, n: 64, packed: true };
  }

  function meanFrame(listOfGlyphTapes, spec) {
    spec = spec || frameSpec("cross");
    const cols = Math.max(1, spec.cols | 0);
    const rows = Math.max(1, spec.rows | 0);
    const n = cols * rows;
    const counts = new Float32Array(n * 4);
    const contrib = new Float32Array(n);
    const tapes = listOfGlyphTapes || [];
    for (let t = 0; t < tapes.length; t++) {
      const tape = tapes[t];
      if (!tape) continue;
      const len = tape.length;
      for (let i = 0; i < n && i < len; i++) {
        counts[i * 4 + codeOf(tape[i])] += 1;
        contrib[i] += 1;
      }
    }
    const argmax = new Uint8Array(n);
    let strong = 0;
    let cells = 0;
    for (let i = 0; i < n; i++) {
      const total = contrib[i];
      if (!total) {
        argmax[i] = 255;
        continue;
      }
      cells += 1;
      let best = 0;
      let bestN = counts[i * 4];
      for (let k = 1; k < 4; k++) {
        const v = counts[i * 4 + k];
        if (v > bestN) {
          bestN = v;
          best = k;
        }
      }
      argmax[i] = best;
      if (bestN / total >= 0.4) strong += 1;
    }
    return {
      cols: cols,
      rows: rows,
      n: n,
      counts: counts,
      contrib: contrib,
      argmax: argmax,
      score: cells ? strong / cells : 0,
      cells: cells,
    };
  }

  function mixRgba(mean, inks) {
    const n = mean && mean.n ? mean.n : 0;
    const out = new Uint8ClampedArray(n * 4);
    const palette = inks || [
      [17, 17, 17, 255],
      [196, 30, 58, 255],
      [30, 78, 196, 255],
      [160, 160, 160, 255],
    ];
    for (let i = 0; i < n; i++) {
      const total = mean.contrib[i];
      const o = i * 4;
      if (!total) {
        out[o + 3] = 0;
        continue;
      }
      let r = 0;
      let g = 0;
      let b = 0;
      for (let k = 0; k < 4; k++) {
        const w = mean.counts[o + k] / total;
        const c = palette[k] || palette[0];
        r += c[0] * w;
        g += c[1] * w;
        b += c[2] * w;
      }
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = 255;
    }
    return out;
  }

  function diffLuma(aBytes, bBytes) {
    const a = aBytes || [];
    const b = bBytes || [];
    const n = Math.min(a.length, b.length);
    const out = new Int16Array(n);
    for (let i = 0; i < n; i++) out[i] = (a[i] | 0) - (b[i] | 0);
    return out;
  }

  function glyphLuma(code) {
    const table = [220, 160, 90, 30];
    return table[codeOf(code)];
  }

  function cleanQuoteText(raw) {
    let s = raw == null ? "" : String(raw);
    s = s.replace(/<\s*br\s*\/?\s*>/gi, "\n");
    s = s.replace(/<\s*\/?\s*(p|div)(?:\s[^>]*)?\s*>/gi, "\n");
    s = s.replace(/<[^>]+>/g, "");
    s = s.replace(/&nbsp;/gi, " ");
    s = s.replace(/&amp;/g, "&");
    s = s.replace(/&lt;/g, "<");
    s = s.replace(/&gt;/g, ">");
    s = s.replace(/&quot;/g, '"');
    s = s.replace(/&#39;/g, "'");
    s = s.replace(/&#x([0-9a-fA-F]+);/g, function (_, n) {
      return String.fromCharCode(parseInt(n, 16));
    });
    s = s.replace(/&#(\d+);/g, function (_, n) {
      return String.fromCharCode(Number(n));
    });
    s = s.replace(/\r\n?/g, "\n");
    s = s.replace(/[ \t]+\n/g, "\n");
    s = s.replace(/\n{3,}/g, "\n\n");
    return s.replace(/^\n+|\n+$/g, "");
  }

  function mergeClip(c1, c2, c3) {
    const a = c1 || [];
    const e2 = c2 || [];
    const e3 = c3 || [];
    const n = a.length;
    const out = new Array(n);
    let i2 = 0;
    let i3 = 0;
    for (let i = 0; i < n; i++) {
      if (a[i]) {
        const extra = i3 < e3.length ? (e3[i3] ? 1 : 0) : 0;
        i3 += 1;
        out[i] = extra ? 3 : 2;
      } else {
        const extra = i2 < e2.length ? (e2[i2] ? 1 : 0) : 0;
        i2 += 1;
        out[i] = extra ? 1 : 0;
      }
    }
    return out;
  }

  function quoteStamp(ref, hasQ) {
    const hms = String((ref && ref.est_hms) || "00:00:00").split(":");
    const hh = Number(hms[0]) || 0;
    const mm = Number(hms[1]) || 0;
    const n = hh * 100 + mm;
    const n12 = ((hh + 12) % 24) * 100 + mm;
    const pad = (x) => String(x | 0).padStart(2, "0");
    const a = hasQ && hasQ(n) ? String(n) : "—";
    const b = hasQ && hasQ(n12) ? String(n12) : "—";
    return pad(hh) + pad(mm) + "→" + a + "/" + b;
  }

  function nestedBits(text) {
    const t = cleanQuoteText(text);
    if (!t) return [];
    const Q = root.Quads;
    if (!Q || !Q.asciiToBits) return [];
    return Q.asciiToBits(t);
  }

  function quoteTape(text, opts) {
    const t = cleanQuoteText(text);
    if (!t) return [0];
    const Q = root.Quads;
    if (!Q || !Q.asciiToBits) return [0];
    const c1 = Q.asciiToBits(t);
    opts = opts || {};
    const nested = cleanQuoteText(opts.nested || "");
    const stamp = opts.stamp != null ? String(opts.stamp) : "";
    const c2 = nested ? nestedBits(nested) : [];
    const c3 = stamp ? Q.asciiToBits(stamp) : [];
    if (opts.pad && Q.merge) {
      const m = Q.merge(c1, c2, c3);
      const glyphs = m && m.glyphs ? m.glyphs : [];
      const out = new Array(glyphs.length);
      for (let i = 0; i < glyphs.length; i++) out[i] = codeOf(glyphs[i]);
      return out;
    }
    return mergeClip(c1, c2, c3);
  }

  root.QuadLayers = {
    NAMES: NAMES,
    CODE_FROM: CODE_FROM,
    SEED: SEED,
    INK_C2: INK_C2,
    INK_C3: INK_C3,
    INK_C4: INK_C4,
    codeOf: codeOf,
    unpackIndex: unpackIndex,
    tapeAlignedPlates: tapeAlignedPlates,
    streamRaster: streamRaster,
    muteMask: muteMask,
    shuffleGlyphs: shuffleGlyphs,
    shufflePosts: shufflePosts,
    iou: iou,
    namesOf: namesOf,
    splitAligned: splitAligned,
    streamSize: streamSize,
    countInk: countInk,
    frameSpec: frameSpec,
    meanFrame: meanFrame,
    mixRgba: mixRgba,
    diffLuma: diffLuma,
    glyphLuma: glyphLuma,
    mergeClip: mergeClip,
    cleanQuoteText: cleanQuoteText,
    nestedBits: nestedBits,
    quoteStamp: quoteStamp,
    quoteTape: quoteTape,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);

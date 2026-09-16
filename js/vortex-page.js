(() => {
  "use strict";

  const THEME_IDS = ["phosphor", "volt", "magma", "ion", "ebs", "paper", "oak"];
  const VIEWS = ["page", "teach"];
  const STAGES = ["fingerprint", "hourglass"];
  const TAPES = ["decimal", "head8", "q-digits", "family-chip", "byte-root"];
  const COLORS = ["off", "orbit", "family", "polar"];
  const EXTRA_ORDERS = ["family", "orbit"];
  const CELL_IDS = [
    "digit3",
    "digit9",
    "byte",
    "notebook",
    "column",
    "boustrophedon",
    "spiral",
    "weeks",
    "square",
    "fish",
    "cross",
  ];
  const THEME = {
    stage: "#000000",
    ink: "#d8ff9a",
    muted: "#8fdc8a",
    gold: "#7dff6a",
    gold2: "#e8ff7a",
    crimson: "#ff2d7b",
    sage: "#3dfff0",
    teal: "#2ee6ff",
    bar0: "#9ad46a",
    cell: "#07140c",
  };
  const DIGIT_HEX = ["#4a6a62", "#d8ff9a", "#7dff6a", "#ff2d7b", "#9ad46a", "#3dfff0", "#ff4fd8", "#e8ff7a", "#2ee6ff", "#ffd56a"];
  const ORBIT_HEX = { doubling: "#3dff8a", flux: "#ff4fd8", axis: "#ffd56a", hole: "#3a5a52" };
  const FAM_HEX = { "147": "#e8ff7a", "258": "#2ee6ff", "369": "#ff4fd8", hole: "#3a5a52" };
  const POLAR_HEX = { 18: "#7dff6a", 27: "#2ee6ff", 45: "#9ad46a", 36: "#ff2d7b", 90: "#ffd56a" };
  const G_SQ0 = 0;
  const G_SQ1 = 1;
  const G_BAR0 = 2;
  const G_BAR1 = 3;
  const G_CODE = { sq0: G_SQ0, sq1: G_SQ1, bar0: G_BAR0, bar1: G_BAR1 };

  const TAPE_NOTE = {
    decimal: "Full post text as three decimal digits per ASCII byte. Long posts squeeze more rows into the same rectangle.",
    head8: "First eight ASCII bytes (24 glyphs). Readable at page scale, same idea as four-symbol head 8×8.",
    "q-digits": "Digits of q, date-key, then HHMMSS. 421 starts 4,2,1,1,2,2,2.",
    "family-chip": "One glyph per post: dr(q).",
    "byte-root": "Four-symbol squares and bars, painted by each ASCII byte's digital root.",
  };
  const CELL_NOTE = {
    digit3: "One ASCII byte per row: hundreds, tens, ones.",
    digit9: "Three ASCII bytes per row (9 digits).",
    byte: "8-wide grid, same cell as the four-symbol page.",
    notebook: "32 glyphs per row.",
    column: "Down the column, then the next.",
    boustrophedon: "Ox-plow: even rows L→R, odd rows R→L.",
    spiral: "Square spiral from the outside in.",
    weeks: "Seven columns.",
    square: "Nearest square packing of the tape.",
    fish: "8×14 fish frame, then extra rows if the tape is longer.",
    cross: "10×10 cross frame, then extra rows if needed.",
  };
  const ORDER_NOTE = {
    q: "Sequential q fills the page left to right, top to bottom.",
    family: "Family 1-4-7, then 2-5-8, then 3-6-9. Color is not lock color.",
    orbit: "Doubling circuit, then 3↔6 flux, then axis 9.",
    ts: "Chronological EST stamps.",
    date: "Replica packing: unique posting date, then q.",
    spoke: "Clock spoke 0–59, then q. Lock spoke is 15.",
    hops: "Depth to 421↔1222, shallow first.",
    basin: "Phrases that cadence onto 421, then the 1222 basin.",
    walkseq: "First visit along walk(q) for q=1…4966. Every post once.",
  };

  const $ = (id) => document.getElementById(id);
  const V = () => globalThis.Vortex;
  const P = () => globalThis.QuadPage;
  const Q = () => globalThis.Quads;

  const state = {
    posts: [],
    byQ: new Map(),
    hasQ: new Set(),
    inDeg: new Map(),
    ordered: [],
    grid: null,
    cells: [],
    selected: 421,
    hover: null,
    hoverDigit: null,
    view: "page",
    stage: "fingerprint",
    tape: "decimal",
    color: "off",
    theme: "phosphor",
    order: "q",
    weave: "raster",
    cell: "digit3",
    gaps: true,
    labels: false,
    hideEmpty: false,
    hideSolid: false,
    gita: false,
    tapes: null,
    atlas: null,
    dirty: true,
    census: null,
  };
  let DIGIT_RGBA = DIGIT_HEX.map((h) => hexRgbStatic(h));

  function hexRgbStatic(hex) {
    const h = String(hex || "").replace("#", "").trim();
    if (h.length < 6) return [255, 255, 255, 255];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 255];
  }

  function pad2(n) {
    return String(n | 0).padStart(2, "0");
  }

  function decodeHtml(s) {
    return String(s || "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ");
  }

  function walk(q) {
    const path = [];
    const seen = new Set();
    let cur = q;
    for (let i = 0; i < 16; i++) {
      path.push(cur);
      if (seen.has(cur)) break;
      seen.add(cur);
      const p = state.byQ.get(cur);
      if (!p || p.next == null || !state.byQ.has(p.next)) break;
      cur = p.next;
    }
    return path;
  }

  function firstLock(q) {
    const path = walk(q);
    for (let i = 0; i < path.length; i++) {
      if (path[i] === 421 || path[i] === 1222) return path[i];
    }
    return 421;
  }

  function cellSpec(kind, nGlyphs, packed) {
    const n = Math.max(1, nGlyphs | 0);
    const hide = !!packed;
    if (kind === "digit3") return { id: "digit3", cols: 3, rows: Math.max(1, Math.ceil(n / 3)), n: n, packed: hide };
    if (kind === "digit9") return { id: "digit9", cols: 9, rows: Math.max(1, Math.ceil(n / 9)), n: n, packed: hide };
    return P().cellSpec(kind, n, packed);
  }

  function cellXY(i, spec) {
    if (spec && (spec.id === "digit3" || spec.id === "digit9")) {
      const cols = Math.max(1, spec.cols | 0);
      const rows = Math.max(1, spec.rows | 0);
      const n = Math.max(0, i | 0);
      return { c: n % cols, r: Math.floor(n / cols) % rows };
    }
    return P().cellXY(i, spec);
  }

  function isSolidPost(p) {
    return !decodeHtml((p && p.text) || "").trim();
  }

  function buildTape(p) {
    const vx = V();
    if (!p) return { kind: "digit", glyphs: new Uint8Array([0]) };
    if (state.tape === "byte-root") {
      return { kind: "four", glyphs: fourGlyphs(p), roots: vx.byteRoots(postText(p)) };
    }
    let digits;
    if (state.tape === "family-chip") digits = [vx.familyChip(p)];
    else if (state.tape === "q-digits") digits = vx.qDigitTape(p);
    else if (state.tape === "head8") digits = vx.asciiToDigits(postText(p).slice(0, 8));
    else digits = vx.asciiToDigits(postText(p));
    if (!digits || !digits.length) digits = [0];
    return { kind: "digit", glyphs: Uint8Array.from(digits) };
  }

  function rebuildTapes() {
    const n = state.posts.length;
    const tapes = new Array(n + 1);
    for (let i = 0; i < n; i++) {
      const p = state.posts[i];
      tapes[p.q] = buildTape(p);
    }
    state.tapes = tapes;
  }

  function cssVar(name) {
    return getComputedStyle(document.body).getPropertyValue(name).trim();
  }

  function hexRgb(hex) {
    const h = String(hex || "").replace("#", "").trim();
    if (h.length < 6) return [255, 255, 255, 255];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 255];
  }

  function applyTheme(id) {
    const theme = THEME_IDS.indexOf(id) >= 0 ? id : "phosphor";
    state.theme = theme;
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
    THEME.stage = cssVar("--stage") || THEME.stage;
    THEME.ink = cssVar("--ink") || THEME.ink;
    THEME.muted = cssVar("--muted") || THEME.muted;
    THEME.gold = cssVar("--gold") || THEME.gold;
    THEME.gold2 = cssVar("--gold-2") || THEME.gold2;
    THEME.crimson = cssVar("--crimson") || THEME.crimson;
    THEME.sage = cssVar("--sage") || THEME.sage;
    THEME.teal = cssVar("--teal") || THEME.teal;
    THEME.bar0 = cssVar("--bar0") || THEME.bar0;
    THEME.cell = cssVar("--cell") || THEME.cell;
    const names = ["d0", "d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8", "d9"];
    for (let i = 0; i < 10; i++) DIGIT_HEX[i] = cssVar("--" + names[i]) || DIGIT_HEX[i];
    ORBIT_HEX.doubling = cssVar("--orbit-d") || ORBIT_HEX.doubling;
    ORBIT_HEX.flux = cssVar("--orbit-f") || ORBIT_HEX.flux;
    ORBIT_HEX.axis = cssVar("--orbit-a") || ORBIT_HEX.axis;
    ORBIT_HEX.hole = cssVar("--orbit-h") || ORBIT_HEX.hole;
    FAM_HEX["147"] = cssVar("--fam-147") || FAM_HEX["147"];
    FAM_HEX["258"] = cssVar("--fam-258") || FAM_HEX["258"];
    FAM_HEX["369"] = cssVar("--fam-369") || FAM_HEX["369"];
    DIGIT_RGBA = DIGIT_HEX.map((h) => hexRgb(h));
  }

  function digitColor(d) {
    const vx = V();
    const n = d | 0;
    if (state.color === "off") return DIGIT_HEX[n] || THEME.ink;
    if (state.color === "family") return FAM_HEX[vx.family(n)] || THEME.ink;
    if (state.color === "polar") {
      const a = Math.min(n, vx.polar(n));
      const b = Math.max(n, vx.polar(n));
      return POLAR_HEX[a * 10 + b] || THEME.ink;
    }
    return ORBIT_HEX[vx.orbit(n)] || THEME.ink;
  }

  function postColor(p) {
    return digitColor(V().familyChip(p));
  }

  function sortPosts(posts, order) {
    const vx = V();
    if (order === "family") {
      const rank = { "147": 0, "258": 1, "369": 2, hole: 3 };
      return posts.slice().sort((a, b) => {
        const d = (rank[vx.family(vx.dr(a.q))] | 0) - (rank[vx.family(vx.dr(b.q))] | 0);
        return d || (a.q | 0) - (b.q | 0);
      });
    }
    if (order === "orbit") {
      const rank = { doubling: 0, flux: 1, axis: 2, hole: 3 };
      return posts.slice().sort((a, b) => {
        const d = (rank[vx.orbit(vx.dr(a.q))] | 0) - (rank[vx.orbit(vx.dr(b.q))] | 0);
        return d || (a.q | 0) - (b.q | 0);
      });
    }
    return P().sortPosts(posts, order, { firstLock: firstLock, walk: walk });
  }

  function rebuildOrder() {
    let list = sortPosts(state.posts, state.order);
    if (state.hideSolid) list = list.filter((p) => !isSolidPost(p));
    state.ordered = list;
  }

  function stageSize(cv) {
    const w = Math.max(8, cv.clientWidth || 8);
    const h = Math.max(8, cv.clientHeight || 8);
    return { w: w, h: h };
  }

  function fitCanvas(cv) {
    const sz = stageSize(cv);
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const bw = Math.max(1, Math.floor(sz.w * dpr));
    const bh = Math.max(1, Math.floor(sz.h * dpr));
    if (cv.width !== bw || cv.height !== bh) {
      cv.width = bw;
      cv.height = bh;
    }
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: sz.w, h: sz.h, dpr: dpr };
  }

  function rebuildGrid() {
    const cv = $("page");
    if (!cv) return;
    const sz = stageSize(cv);
    const n = state.ordered.length || 1;
    state.grid = P().fitGrid(n, sz.w, sz.h, state.hideEmpty);
    const g = state.grid;
    g.weave = state.weave;
    const cells = new Array(g.cols * g.rows);
    for (let i = 0; i < cells.length; i++) cells[i] = null;
    for (let i = 0; i < state.ordered.length; i++) {
      const pos = P().slotPos(i, g, state.weave);
      const idx = pos.row * g.cols + pos.col;
      if (idx >= 0 && idx < cells.length) cells[idx] = { post: state.ordered[i], seq: i, col: pos.col, row: pos.row };
    }
    state.cells = cells;
    const el = $("grid-readout");
    if (el) {
      const waste = g.waste | 0;
      const extra = state.hideEmpty ? (waste ? ` · hid ${waste} empty` : " · no empty") : waste ? ` · ${waste} empty` : "";
      const solidN = state.hideSolid ? state.posts.length - n : 0;
      const solid = solidN ? ` · hid ${solidN} solid` : "";
      el.textContent = `${g.cols}×${g.rows} · ${g.cellW.toFixed(1)}×${g.cellH.toFixed(1)} px · ${n} posts${extra}${solid}`;
    }
  }

  function drawDigitGlyph(ctx, x, y, w, h, digit, extra, color) {
    const d = ((digit | 0) % 10 + 10) % 10;
    const hollow = !!extra;
    const fill = color || digitColor(d);
    if (w < 2.4 || h < 2.4) {
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, Math.max(0.6, w), Math.max(0.6, h));
      return;
    }
    const pad = Math.max(0.2, Math.min(w, h) * 0.14);
    const ix = x + pad;
    const iy = y + pad;
    const iw = Math.max(0.6, w - pad * 2);
    const ih = Math.max(0.6, h - pad * 2);
    const cx = ix + iw / 2;
    const cy = iy + ih / 2;
    ctx.strokeStyle = fill;
    ctx.fillStyle = fill;
    ctx.lineWidth = Math.max(0.7, Math.min(iw, ih) * (hollow ? 0.1 : 0.16));
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    function strokePoly(pts, close) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      if (close) ctx.closePath();
      if (hollow || close === false) ctx.stroke();
      else ctx.fill();
    }

    if (d === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(iw, ih) * 0.32, 0, Math.PI * 2);
      ctx.stroke();
      if (hollow) {
        ctx.beginPath();
        ctx.arc(cx, cy, Math.min(iw, ih) * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    if (d === 1) {
      if (hollow) ctx.strokeRect(ix + 0.4, iy + 0.4, iw - 0.8, ih - 0.8);
      else ctx.fillRect(ix, iy, iw, ih);
      return;
    }
    if (d === 4) {
      const bw = iw * 0.34;
      if (hollow) ctx.strokeRect(cx - bw / 2, iy, bw, ih);
      else ctx.fillRect(cx - bw / 2, iy, bw, ih);
      return;
    }
    if (d === 5) {
      const bh = ih * 0.28;
      if (hollow) ctx.strokeRect(ix, cy - bh / 2, iw, bh);
      else ctx.fillRect(ix, cy - bh / 2, iw, bh);
      return;
    }
    if (d === 8) {
      const pts = [
        [cx, iy],
        [ix + iw, cy],
        [cx, iy + ih],
        [ix, cy],
      ];
      strokePoly(pts, true);
      return;
    }
    if (d === 9) {
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(iw, ih) * 0.38, 0, Math.PI * 2);
      if (hollow) ctx.stroke();
      else {
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, Math.min(iw, ih) * 0.14, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    if (d === 2) {
      const pts = [
        [ix, iy + ih * 0.72],
        [cx, iy],
        [ix + iw, iy + ih * 0.72],
      ];
      strokePoly(pts, false);
      return;
    }
    if (d === 7) {
      const pts = [
        [ix, iy + ih * 0.28],
        [cx, iy + ih],
        [ix + iw, iy + ih * 0.28],
      ];
      strokePoly(pts, false);
      return;
    }
    if (d === 3) {
      ctx.beginPath();
      ctx.moveTo(ix, iy);
      ctx.lineTo(ix + iw, cy);
      ctx.lineTo(ix, iy + ih);
      ctx.stroke();
      return;
    }
    if (d === 6) {
      ctx.beginPath();
      ctx.moveTo(ix + iw, iy);
      ctx.lineTo(ix, cy);
      ctx.lineTo(ix + iw, iy + ih);
      ctx.stroke();
    }
  }

  function postText(p) {
    return decodeHtml((p && p.text) || "");
  }

  function tapeRecord(p) {
    if (p && state.tapes && state.tapes[p.q]) return state.tapes[p.q];
    return buildTape(p);
  }

  function fourGlyphs(p) {
    const quads = Q();
    const text = postText(p);
    if (!quads || !text) return new Uint8Array([G_SQ0]);
    const bits = quads.asciiToBits(text);
    const out = new Uint8Array(bits.length);
    for (let i = 0; i < bits.length; i++) out[i] = bits[i] ? G_BAR0 : G_SQ0;
    return out;
  }

  function drawFourGlyph(ctx, x, y, w, h, code, color) {
    const pad = Math.max(0.15, Math.min(w, h) * 0.12);
    const ix = x + pad;
    const iy = y + pad;
    const iw = Math.max(0.5, w - pad * 2);
    const ih = Math.max(0.5, h - pad * 2);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    if (w < 2.2 || h < 2.2) {
      ctx.fillRect(x, y, Math.max(0.6, w), Math.max(0.6, h));
      return;
    }
    if (code === G_SQ0) ctx.fillRect(ix, iy, iw, ih);
    else if (code === G_SQ1) {
      ctx.lineWidth = Math.max(0.7, Math.min(iw, ih) * 0.12);
      ctx.strokeRect(ix + 0.4, iy + 0.4, iw - 0.8, ih - 0.8);
    } else if (code === G_BAR0) {
      const bw = iw * 0.38;
      ctx.fillRect(ix + (iw - bw) / 2, iy, bw, ih);
    } else {
      ctx.lineWidth = Math.max(0.7, iw * 0.08);
      const bw = iw * 0.22;
      ctx.beginPath();
      ctx.moveTo(ix + iw / 2 - bw, iy);
      ctx.lineTo(ix + iw / 2 - bw, iy + ih);
      ctx.moveTo(ix + iw / 2 + bw, iy);
      ctx.lineTo(ix + iw / 2 + bw, iy + ih);
      ctx.stroke();
    }
  }

  const blitScratch = document.createElement("canvas");
  const blitCtx = blitScratch.getContext("2d");

  function digitRgba(d) {
    if (state.color === "off") return DIGIT_RGBA[d | 0] || DIGIT_RGBA[0];
    return hexRgb(digitColor(d));
  }

  function blitTape(ctx, x, y, w, h, rec, spec) {
    const cols = spec.cols;
    const rows = spec.rows;
    if (blitScratch.width !== cols || blitScratch.height !== rows) {
      blitScratch.width = cols;
      blitScratch.height = rows;
    }
    const img = blitCtx.createImageData(cols, rows);
    const data = img.data;
    data.fill(0);
    const glyphs = rec.glyphs;
    const n = glyphs.length;
    const four = rec.kind === "four";
    const roots = rec.roots || [];
    for (let i = 0; i < n; i++) {
      const pos = four ? P().cellXY(i, spec) : cellXY(i, spec);
      let c;
      if (four) {
        const byte = Math.floor(i / 8);
        c = digitRgba(roots[byte] || 0);
      } else {
        c = digitRgba(glyphs[i]);
      }
      const o = (pos.r * cols + pos.c) * 4;
      data[o] = c[0];
      data[o + 1] = c[1];
      data[o + 2] = c[2];
      data[o + 3] = 255;
    }
    blitCtx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(blitScratch, 0, 0, cols, rows, x, y, w, h);
    ctx.imageSmoothingEnabled = true;
  }

  function drawTapeInRect(ctx, x, y, w, h, p) {
    if (!p) return;
    const rec = tapeRecord(p);
    const glyphs = rec.glyphs;
    const n = glyphs && glyphs.length ? glyphs.length : 0;
    if (!n) return;
    const kind = rec.kind === "four" ? "byte" : state.cell;
    if (n === 1 && rec.kind !== "four") {
      drawDigitGlyph(ctx, x, y, w, h, glyphs[0], 0, digitColor(glyphs[0]));
      return;
    }
    const spec = cellSpec(kind, n, state.hideEmpty);
    const gw = w / spec.cols;
    const gh = h / spec.rows;
    if (n > 64 || gw < 3 || gh < 3) {
      blitTape(ctx, x, y, w, h, rec, spec);
      return;
    }
    if (rec.kind === "four") {
      const roots = rec.roots || [];
      for (let i = 0; i < n; i++) {
        const pos = P().cellXY(i, spec);
        const byte = Math.floor(i / 8);
        drawFourGlyph(ctx, x + pos.c * gw, y + pos.r * gh, gw, gh, glyphs[i], digitColor(roots[byte] || 0));
      }
      return;
    }
    for (let i = 0; i < n; i++) {
      const pos = cellXY(i, spec);
      drawDigitGlyph(ctx, x + pos.c * gw, y + pos.r * gh, gw, gh, glyphs[i], 0, digitColor(glyphs[i]));
    }
  }

  function rimPoint(cx, cy, r, d) {
    const a = V().rimAngle(d);
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, a: a };
  }

  function circleHitDigit(mx, my, geom) {
    if (!geom) return null;
    const dx = mx - geom.cx;
    const dy = my - geom.cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < geom.r * 0.18) return 0;
    const vx = V();
    let best = null;
    let bestD = 1e9;
    const digits = [9].concat(vx.LAYOUT.clockwise);
    for (let i = 0; i < digits.length; i++) {
      const p = rimPoint(geom.cx, geom.cy, geom.r, digits[i]);
      const dd = (p.x - mx) * (p.x - mx) + (p.y - my) * (p.y - my);
      if (dd < bestD) {
        bestD = dd;
        best = digits[i];
      }
    }
    return bestD < (geom.r * 0.22) * (geom.r * 0.22) ? best : null;
  }

  let circleGeom = null;

  function selectedDigits(p) {
    const vx = V();
    if (!p) return [];
    return vx.digitsOfInt(p.q);
  }

  function drawFingerprint(ctx, w, h) {
    const vx = V();
    ctx.fillStyle = THEME.stage;
    ctx.fillRect(0, 0, w, h);
    const cx = w * 0.5;
    const cy = h * 0.52;
    const r = Math.min(w, h) * 0.36;
    circleGeom = { cx: cx, cy: cy, r: r };
    ctx.strokeStyle = THEME.muted;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    const doubling = vx.DOUBLING;
    ctx.strokeStyle = ORBIT_HEX.doubling;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < doubling.length; i++) {
      const p = rimPoint(cx, cy, r, doubling[i]);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 1;

    const p9 = rimPoint(cx, cy, r, 9);
    const p3 = rimPoint(cx, cy, r, 3);
    const p6 = rimPoint(cx, cy, r, 6);
    ctx.strokeStyle = cssVar("--vector") || "#ff2d55";
    ctx.lineWidth = 2.2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(p9.x, p9.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.moveTo(p9.x, p9.y);
    ctx.lineTo(p6.x, p6.y);
    ctx.stroke();
    ctx.setLineDash([]);

    const p = state.byQ.get(state.selected);
    const beads = selectedDigits(p);
    const fold = p ? vx.dr(p.q) : 7;
    const ghosts = beads.map((d) => vx.polar(d));
    const hover = state.hoverDigit;
    const mate = hover == null ? null : vx.polar(hover);

    ctx.font = `${Math.max(11, Math.min(18, r * 0.12))}px "IBM Plex Mono", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const rim = [9].concat(vx.LAYOUT.clockwise);
    for (let i = 0; i < rim.length; i++) {
      const d = rim[i];
      const pt = rimPoint(cx, cy, r, d);
      const active = beads.indexOf(d) >= 0 || d === fold;
      const ghost = ghosts.indexOf(d) >= 0;
      const lit = hover === d || mate === d;
      const rr = active ? 11 : ghost || lit ? 9 : 7;
      ctx.beginPath();
      ctx.fillStyle = digitColor(d);
      ctx.globalAlpha = active || lit ? 1 : ghost ? 0.45 : 0.8;
      ctx.arc(pt.x, pt.y, rr, 0, Math.PI * 2);
      ctx.fill();
      if (lit) {
        ctx.strokeStyle = THEME.gold2;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const lx = cx + Math.cos(pt.a) * (r + 22);
      const ly = cy + Math.sin(pt.a) * (r + 22);
      ctx.fillStyle = THEME.gold2;
      ctx.fillText(String(d), lx, ly);
      if (state.gita) {
        ctx.fillStyle = THEME.muted;
        ctx.font = "10px \"IBM Plex Sans\", sans-serif";
        ctx.fillText(d === 9 ? "soul" : "material", lx, ly + 14);
        ctx.font = `${Math.max(11, Math.min(18, r * 0.12))}px "IBM Plex Mono", monospace`;
      }
    }

    ctx.beginPath();
    ctx.strokeStyle = ORBIT_HEX.hole;
    ctx.fillStyle = THEME.cell;
    ctx.lineWidth = 2;
    ctx.arc(cx, cy, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = THEME.muted;
    ctx.fillText("0", cx, cy);
    if (state.gita) {
      ctx.font = "10px \"IBM Plex Sans\", sans-serif";
      ctx.fillText("O origin", cx, cy + r * 0.28);
    }

    ctx.textAlign = "left";
    ctx.fillStyle = THEME.gold2;
    ctx.font = "12px \"IBM Plex Mono\", monospace";
    ctx.fillText("9 at top · 0 in the hole · 3-9-6 open vector (no base)", 14, 18);
    ctx.fillStyle = THEME.muted;
    ctx.fillText(`beads ${beads.join("-") || "—"}  fold ${fold}  polar ghosts ${ghosts.join(",")}`, 14, 36);
    const path = walk(state.selected);
    const drs = path.map((n) => vx.dr(n));
    ctx.fillText(`walk ${path.join("→")}`, 14, h - 28);
    ctx.fillStyle = THEME.gold;
    ctx.fillText(`dr ${drs.join("-")}`, 14, h - 12);
  }

  function drawHourglass(ctx, w, h) {
    const vx = V();
    ctx.fillStyle = THEME.stage;
    ctx.fillRect(0, 0, w, h);
    const cx = w * 0.5;
    const cy = h * 0.52;
    const r = Math.min(w, h) * 0.36;
    function pt(d) {
      if ((d | 0) === 0) return { x: cx, y: cy, a: 0 };
      return rimPoint(cx, cy, r, d);
    }
    function diamond(ids, color) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      const pts = ids.map(pt);
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.stroke();
    }
    diamond([1, 2, 4, 0], ORBIT_HEX.doubling);
    diamond([8, 7, 5, 0], ORBIT_HEX.doubling);
    const p9 = pt(9);
    const p3 = pt(3);
    const p6 = pt(6);
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = cssVar("--vector") || "#ff2d55";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p9.x, p9.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.moveTo(p9.x, p9.y);
    ctx.lineTo(p6.x, p6.y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.fillStyle = ORBIT_HEX.axis;
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = "13px \"IBM Plex Mono\", monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const labels = [
      [9, "−9"],
      [1, "1"],
      [2, "2"],
      [3, "+3"],
      [4, "4"],
      [5, "5"],
      [6, "+6"],
      [7, "7"],
      [8, "8"],
    ];
    for (let i = 0; i < labels.length; i++) {
      const d = labels[i][0];
      const p = pt(d);
      ctx.fillStyle = digitColor(d);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      ctx.fill();
      const lx = cx + Math.cos(p.a) * (r + 20);
      const ly = cy + Math.sin(p.a) * (r + 20);
      ctx.fillStyle = THEME.gold2;
      ctx.fillText(labels[i][1], lx, ly);
    }
    ctx.textAlign = "left";
    ctx.fillStyle = THEME.gold2;
    ctx.font = "12px \"IBM Plex Mono\", monospace";
    ctx.fillText("hourglass · nested diamonds 124 / 875 · vector 3-9-6, no base", 14, 18);
  }

  function paintAtlas() {
    const cv = $("page");
    if (!cv) return;
    const sz = stageSize(cv);
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    if (!state.atlas) state.atlas = document.createElement("canvas");
    const atlas = state.atlas;
    atlas.width = Math.max(1, Math.floor(sz.w * dpr));
    atlas.height = Math.max(1, Math.floor(sz.h * dpr));
    const ctx = atlas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = THEME.stage;
    ctx.fillRect(0, 0, sz.w, sz.h);
    const g = state.grid;
    if (!g) return;
    const gap = state.gaps ? Math.min(1.2, Math.max(0.4, Math.min(g.cellW, g.cellH) * 0.06)) : 0;
    const labelOk = state.labels && g.cellW >= 22 && g.cellH >= 14;
    if (labelOk) {
      ctx.font = `${Math.max(7, Math.min(10, g.cellH * 0.28))}px "IBM Plex Mono", monospace`;
      ctx.textBaseline = "top";
    }
    for (let i = 0; i < state.cells.length; i++) {
      const cell = state.cells[i];
      if (!cell) continue;
      const r = P().cellRect(cell.col, cell.row, g);
      const x = r.x + gap;
      const y = r.y + gap;
      const w = Math.max(0.8, r.w - gap * 2);
      const h = Math.max(0.8, r.h - gap * 2);
      ctx.fillStyle = THEME.cell;
      ctx.fillRect(x, y, w, h);
      const tapeH = labelOk ? h - 10 : h;
      drawTapeInRect(ctx, x + 0.4, y + 0.4, w - 0.8, Math.max(1, tapeH - 0.8), cell.post);
      if (labelOk) {
        ctx.fillStyle = THEME.gold2;
        ctx.fillText(String(cell.post.q), x + 2, y + h - 10);
      }
    }
    state.dirty = false;
  }

  function drawPage() {
    const cv = $("page");
    if (!cv || state.view !== "page") return;
    const sz = stageSize(cv);
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const bw = Math.max(1, Math.floor(sz.w * dpr));
    const bh = Math.max(1, Math.floor(sz.h * dpr));
    if (cv.width !== bw || cv.height !== bh) {
      cv.width = bw;
      cv.height = bh;
      state.dirty = true;
    }
    if (state.dirty || !state.atlas) paintAtlas();
    const ctx = cv.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (state.atlas) ctx.drawImage(state.atlas, 0, 0, cv.width, cv.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = state.grid;
    if (!g) return;
    const marks = [state.hover, state.cells.find((c) => c && c.post.q === state.selected)];
    const seen = new Set();
    for (const cell of marks) {
      if (!cell || seen.has(cell.post.q)) continue;
      seen.add(cell.post.q);
      const r = P().cellRect(cell.col, cell.row, g);
      ctx.strokeStyle = cell.post.q === state.selected ? THEME.gold2 : THEME.gold;
      ctx.lineWidth = cell.post.q === state.selected ? 2 : 1;
      ctx.strokeRect(r.x + 0.6, r.y + 0.6, r.w - 1.2, r.h - 1.2);
    }
  }

  function drawTeach() {
    if (state.view !== "teach") return;
    const circle = $("circle");
    const hour = $("hourglass");
    if (circle) {
      const { ctx, w, h } = fitCanvas(circle);
      drawFingerprint(ctx, w, h);
    }
    if (hour) {
      const { ctx, w, h } = fitCanvas(hour);
      drawHourglass(ctx, w, h);
    }
  }

  function paintPeek(p) {
    const cv = $("peek");
    if (!cv) return;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = THEME.stage;
    ctx.fillRect(0, 0, cv.width, cv.height);
    if (!p) return;
    drawTapeInRect(ctx, 8, 8, cv.width - 16, cv.height - 16, p);
  }

  function asciiChar(b) {
    const n = b | 0;
    if (n === 10) return "LF";
    if (n === 13) return "CR";
    if (n === 9) return "TAB";
    if (n >= 32 && n < 127) return String.fromCharCode(n);
    return "x" + n.toString(16).padStart(2, "0");
  }

  function byteTable(p) {
    const vx = V();
    const text = postText(p);
    const bytes = vx.asciiBytes(text);
    const roots = vx.byteRoots(text);
    const lines = ["Byte  ASCII  dr  orbit"];
    const n = Math.min(bytes.length, 48);
    for (let i = 0; i < n; i++) {
      lines.push(`${String(bytes[i]).padStart(3)}   ${asciiChar(bytes[i]).padEnd(4)}  ${roots[i]}   ${vx.orbit(roots[i])}`);
    }
    if (bytes.length > n) lines.push(`… ${bytes.length - n} more bytes`);
    return lines.join("\n");
  }

  function recoveredText(p) {
    const vx = V();
    const rec = tapeRecord(p);
    if (rec.kind === "digit" && (state.tape === "decimal" || state.tape === "head8")) {
      return vx.digitsToAscii(Array.from(rec.glyphs));
    }
    if (state.tape === "byte-root") {
      const quads = Q();
      const text = postText(p);
      if (!quads) return text;
      return quads.bitsToAscii(quads.asciiToBits(text));
    }
    return postText(p);
  }

  function renderInspector() {
    const vx = V();
    const p = state.byQ.get(state.selected);
    const sel = $("sel-readout");
    if (sel) sel.textContent = p ? `#${p.q}` : "—";
    const four = $("four-link");
    if (four) four.href = `index.html#q=${state.selected}`;
    const meta = $("inspect-meta");
    const table = $("inspect-table");
    const textEl = $("inspect-text");
    if (!p) {
      if (meta) meta.textContent = "q=" + state.selected;
      if (table) table.textContent = "—";
      if (textEl) textEl.textContent = "—";
      paintPeek(null);
      return;
    }
    const path = walk(p.q);
    const lock = firstLock(p.q);
    const rec = tapeRecord(p);
    const glyphs = rec.glyphs || [];
    const spec = cellSpec(rec.kind === "four" ? "byte" : state.cell, glyphs.length || 1, state.hideEmpty);
    if (meta) {
      meta.textContent =
        `#${p.q}  ${p.date}  ${pad2(p.hh)}:${pad2(p.mm)}:${pad2(p.ss)} EST\n` +
        `spoke ${p.spoke}  hops ${p.hops}  next ${p.next}  lock ${lock}\n` +
        `glyphs ${glyphs.length}  cell ${spec.cols}×${spec.rows}  tape ${state.tape}\n` +
        `walk ${path.join("→")}`;
    }
    try {
      if (table) table.textContent = byteTable(p);
      if (textEl) textEl.textContent = recoveredText(p) || "(empty)";
      paintPeek(p);
    } catch (err) {
      if (table) table.textContent = String(err && err.message ? err.message : err);
      if (textEl && !textEl.textContent) textEl.textContent = postText(p) || "—";
    }
    if ($("qnum") && document.activeElement !== $("qnum")) $("qnum").value = String(p.q);
  }

  function setNotes() {
    if ($("order-note")) $("order-note").textContent = ORDER_NOTE[state.order] || "";
    let extra = "";
    if (state.hideEmpty) extra += " Empty slots hidden.";
    if (state.hideSolid) extra += " Solid squares off: empty-text posts are omitted.";
    if ($("tape-note")) $("tape-note").textContent = (TAPE_NOTE[state.tape] || "") + " " + (CELL_NOTE[state.cell] || "") + extra;
    if ($("view-note")) {
      $("view-note").textContent =
        state.view === "teach"
          ? "Optional circle. The page view is the 9-symbol packing of every post."
          : "Each rectangle is that post’s 9-symbol tape. All 4,966 fit here.";
    }
  }

  function writeHash() {
    const parts = [
      `q=${state.selected}`,
      `view=${state.view}`,
      `tape=${state.tape}`,
      `cell=${state.cell}`,
      `color=${state.color}`,
      `theme=${state.theme}`,
    ];
    if (state.stage !== "fingerprint") parts.push(`stage=${state.stage}`);
    if (state.order !== "q") parts.push(`order=${state.order}`);
    if (state.weave !== "raster") parts.push(`weave=${state.weave}`);
    if (!state.gaps) parts.push("gaps=0");
    if (state.labels) parts.push("labels=1");
    if (state.hideEmpty) parts.push("hide=1");
    if (state.hideSolid) parts.push("solid=1");
    if (state.gita) parts.push("legend=1");
    const next = "#" + parts.join("&");
    if (location.hash !== next) history.replaceState(null, "", next);
  }

  function readHash() {
    const raw = (location.hash || "").replace(/^#/, "");
    if (!raw) return;
    const map = {};
    raw.split("&").forEach((pair) => {
      const i = pair.indexOf("=");
      if (i < 0) map[pair] = "1";
      else map[decodeURIComponent(pair.slice(0, i))] = decodeURIComponent(pair.slice(i + 1));
    });
    if (map.q) state.selected = P().clampInt(Number(map.q), 1, 4966);
    if (map.view && VIEWS.indexOf(map.view) >= 0) state.view = map.view;
    if (map.stage && STAGES.indexOf(map.stage) >= 0) state.stage = map.stage;
    if (map.tape && TAPES.indexOf(map.tape) >= 0) state.tape = map.tape;
    if (map.cell && CELL_IDS.indexOf(map.cell) >= 0) state.cell = map.cell;
    if (map.color && COLORS.indexOf(map.color) >= 0) state.color = map.color;
    if (map.theme && THEME_IDS.indexOf(map.theme) >= 0) state.theme = map.theme;
    if (map.order && (P().ORDER.indexOf(map.order) >= 0 || EXTRA_ORDERS.indexOf(map.order) >= 0)) state.order = map.order;
    if (map.weave && P().WEAVE.indexOf(map.weave) >= 0) state.weave = map.weave;
    if (map.gaps === "0") state.gaps = false;
    if (map.labels === "1") state.labels = true;
    if (map.hide === "1") state.hideEmpty = true;
    if (map.solid === "1") state.hideSolid = true;
    if (map.legend === "1") state.gita = true;
  }

  function syncView() {
    document.body.dataset.view = state.view;
    document.body.dataset.stage = state.stage;
  }

  function syncControls() {
    const bind = (id, val) => {
      if ($(id) && $(id).value !== String(val)) $(id).value = String(val);
    };
    bind("view", state.view);
    bind("stage", state.stage);
    bind("tape", state.tape);
    bind("cell", state.cell);
    bind("color", state.color);
    bind("theme", state.theme);
    bind("order", state.order);
    bind("weave", state.weave);
    applyTheme(state.theme);
    if ($("gaps")) $("gaps").checked = state.gaps;
    if ($("labels")) $("labels").checked = state.labels;
    if ($("hide-empty")) $("hide-empty").checked = state.hideEmpty;
    if ($("hide-solid")) $("hide-solid").checked = state.hideSolid;
    if ($("gita")) $("gita").checked = state.gita;
    if ($("qnum")) $("qnum").value = String(state.selected);
    syncView();
    setNotes();
  }

  function banner() {
    const el = $("banner-meta");
    if (!el) return;
    const c = state.census;
    if (!c) {
      el.textContent = "loading…";
      return;
    }
    el.innerHTML = `<b>${c.n}</b> posts · 9-symbol · independent packing`;
  }

  function relayout(opts) {
    const o = opts || {};
    const st = $("pack-status");
    if (st) st.textContent = "packing…";
    if (o.tapes !== false) rebuildTapes();
    if (o.order !== false) rebuildOrder();
    rebuildGrid();
    state.dirty = true;
    drawPage();
    drawTeach();
    renderInspector();
    writeHash();
    if (st) {
      const g = state.grid;
      const n = state.ordered.length;
      const solidN = state.hideSolid ? state.posts.length - n : 0;
      st.textContent = g
        ? `fitted ${n} rectangles in ${g.cols}×${g.rows}` +
          (state.hideEmpty ? (g.waste ? ` (hid ${g.waste} empty)` : " (no empty)") : g.waste ? ` (${g.waste} empty)` : "") +
          (solidN ? ` (hid ${solidN} solid)` : "")
        : "—";
    }
  }

  function selectQ(q, fromClick) {
    const n = P().clampInt(q, 1, state.posts.length || 4966);
    state.selected = n;
    renderInspector();
    drawPage();
    drawTeach();
    writeHash();
    if (fromClick) document.body.classList.add("show-inspect");
  }

  function hitAt(cssX, cssY) {
    const g = state.grid;
    if (!g) return null;
    const pos = P().hitPos(cssX, cssY, g);
    if (!pos) return null;
    return state.cells[pos.row * g.cols + pos.col] || null;
  }

  function neighbor(dqCol, dqRow) {
    const cell = state.cells.find((c) => c && c.post.q === state.selected);
    if (!cell || !state.grid) return;
    const col = cell.col + dqCol;
    const row = cell.row + dqRow;
    if (col < 0 || row < 0 || col >= state.grid.cols || row >= state.grid.rows) return;
    const next = state.cells[row * state.grid.cols + col];
    if (next) selectQ(next.post.q);
  }

  function onResize() {
    state.dirty = true;
    rebuildGrid();
    drawPage();
    drawTeach();
  }

  async function load() {
    readHash();
    syncControls();
    const res = await fetch("data/corpus.json");
    const data = await res.json();
    state.posts = data.posts || [];
    state.byQ.clear();
    state.hasQ.clear();
    state.inDeg.clear();
    for (let i = 0; i < state.posts.length; i++) {
      const p = state.posts[i];
      state.byQ.set(p.q, p);
      state.hasQ.add(p.q);
    }
    for (let i = 0; i < state.posts.length; i++) {
      const p = state.posts[i];
      if (p.next != null) state.inDeg.set(p.next, (state.inDeg.get(p.next) || 0) + 1);
    }
    state.census = V().census(state.posts);
    banner();
    if (!state.byQ.has(state.selected)) state.selected = 421;
    relayout();
  }

  function bind() {
    const sel = (id, key, tapes, order) => {
      if (!$(id)) return;
      $(id).addEventListener("change", () => {
        state[key] = $(id).value;
        if (key === "theme") applyTheme(state.theme);
        if (key === "view" || key === "stage") syncView();
        setNotes();
        relayout({ tapes: !!tapes, order: order !== false });
      });
    };
    sel("view", "view", false, false);
    sel("stage", "stage", false, false);
    sel("tape", "tape", true, false);
    sel("cell", "cell", false, false);
    sel("color", "color", false, false);
    sel("theme", "theme", false, false);
    sel("order", "order", false, true);
    sel("weave", "weave", false, true);
    if ($("gaps")) {
      $("gaps").addEventListener("change", () => {
        state.gaps = $("gaps").checked;
        relayout({ tapes: false, order: false });
      });
    }
    if ($("labels")) {
      $("labels").addEventListener("change", () => {
        state.labels = $("labels").checked;
        relayout({ tapes: false, order: false });
      });
    }
    if ($("hide-empty")) {
      $("hide-empty").addEventListener("change", () => {
        state.hideEmpty = $("hide-empty").checked;
        setNotes();
        relayout({ tapes: false, order: false });
      });
    }
    if ($("hide-solid")) {
      $("hide-solid").addEventListener("change", () => {
        state.hideSolid = $("hide-solid").checked;
        setNotes();
        relayout({ tapes: false, order: true });
      });
    }
    if ($("gita")) {
      $("gita").addEventListener("change", () => {
        state.gita = $("gita").checked;
        drawTeach();
        writeHash();
      });
    }
    if ($("go")) $("go").addEventListener("click", () => selectQ(Number($("qnum").value)));
    if ($("qnum")) {
      $("qnum").addEventListener("keydown", (e) => {
        if (e.key === "Enter") selectQ(Number($("qnum").value));
      });
    }
    if ($("fit")) $("fit").addEventListener("click", () => relayout());

    const page = $("page");
    if (page) {
      page.addEventListener("mousemove", (e) => {
        const r = page.getBoundingClientRect();
        const hit = hitAt(e.clientX - r.left, e.clientY - r.top);
        const q = hit ? hit.post.q : null;
        if ((state.hover && state.hover.post.q) !== q) {
          state.hover = hit;
          drawPage();
        }
      });
      page.addEventListener("mouseleave", () => {
        if (state.hover) {
          state.hover = null;
          drawPage();
        }
      });
      page.addEventListener("click", (e) => {
        const r = page.getBoundingClientRect();
        const hit = hitAt(e.clientX - r.left, e.clientY - r.top);
        if (hit) selectQ(hit.post.q, true);
      });
    }

    const circle = $("circle");
    if (circle) {
      circle.addEventListener("mousemove", (e) => {
        const r = circle.getBoundingClientRect();
        const d = circleHitDigit(e.clientX - r.left, e.clientY - r.top, circleGeom);
        if (state.hoverDigit !== d) {
          state.hoverDigit = d;
          drawTeach();
        }
      });
      circle.addEventListener("mouseleave", () => {
        if (state.hoverDigit != null) {
          state.hoverDigit = null;
          drawTeach();
        }
      });
    }

    window.addEventListener("keydown", (e) => {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowLeft") neighbor(-1, 0);
      else if (e.key === "ArrowRight") neighbor(1, 0);
      else if (e.key === "ArrowUp") neighbor(0, -1);
      else if (e.key === "ArrowDown") neighbor(0, 1);
    });
    window.addEventListener("resize", onResize);
    window.addEventListener("hashchange", () => {
      readHash();
      applyTheme(state.theme);
      syncControls();
      relayout();
    });
  }

  bind();
  load().catch((err) => {
    const meta = $("banner-meta");
    if (meta) meta.textContent = String(err && err.message ? err.message : err);
  });
})();

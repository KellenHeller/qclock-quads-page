(() => {
  "use strict";

  const THEME_IDS = ["phosphor", "volt", "magma", "ion", "ebs", "paper", "oak"];
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
    ampmAm: "#2ee6ff",
    ampmPm: "#ff2d7b",
  };
  let HOP_COL = ["#f4ff7a", "#9dff4a", "#3dff8a", "#2ee6c8", "#2ec8ff", "#7a8cff", "#ff4fd8"];
  const PAINT_IDS = ["meaning", "spectrum", "toast"];
  let EBS_SQUARES = [
    "#ff0000",
    "#ff7a00",
    "#ffff00",
    "#00e000",
    "#0066ff",
    "#3d00cc",
    "#9b00ff",
    "#ffffff",
    "#000000",
  ];
  let TOAST_INK = ["#901131", "#319011", "#113190", "#903111"];
  let TOAST_CELL = "#901171";
  let GLYPH_RGBA = [
    [216, 255, 154, 255],
    [255, 45, 123, 255],
    [154, 212, 106, 255],
    [61, 255, 240, 255],
  ];
  const G_SQ0 = 0;
  const G_SQ1 = 1;
  const G_BAR0 = 2;
  const G_BAR1 = 3;
  const G_CODE = { sq0: G_SQ0, sq1: G_SQ1, bar0: G_BAR0, bar1: G_BAR1 };
  const ORDER_NOTE = {
    q: "Sequential q fills the page left to right, top to bottom.",
    ts: "Chronological EST stamps, same order as the vinyl spiral.",
    date: "Replica packing: unique posting date, then q.",
    spoke: "Clock spoke 0–59, then q. Lock spoke is 15.",
    hops: "Depth to 421↔1222, shallow first.",
    time: "Time face: hour ring, then minute, then second.",
    grid: "Date-day × minute, the 60×60 layout flattened into the page.",
    spoke15: "Lock chapter first (spoke 15), then the rest of the face.",
    basin: "Phrases that cadence onto 421, then the 1222 basin.",
    ampm: "AM stamps, then PM.",
    even: "Even q, then odd q.",
    loop: "LOOP depth (hops) then q — closer to lock first.",
    walkseq: "First visit along walk(q) for q=1…4966. Every post once.",
  };
  const TAPE_NOTE = {
    "c1-only": "Full post text as Code 1. Long posts squeeze more rows into the same rectangle.",
    "triple-text": "C1 = post text. C2 = LOOP walk. C3 = HHMM→hash line.",
    head8: "First eight ASCII bytes (64 glyphs). Drew’s 8×8 notebook cell, readable at page scale.",
    chip: "One field glyph per post (spoke-hops, ampm-lock, even-q, timehash).",
  };
  const CELL_NOTE = {
    byte: "Drew byte rows: 8 glyphs = one ASCII character, left to right, top to bottom.",
    notebook: "Notebook face flattened: 32 glyphs per row, outer ring = first row.",
    column: "Down the column, then the next. Same 8-wide page.",
    boustrophedon: "Ox-plow: even rows L→R, odd rows R→L.",
    spiral: "Square spiral from the outside in.",
    weeks: "Seven columns, one per weekday.",
    square: "Nearest square packing of the tape.",
    fish: "Rodney 8×14 fish frame, then extra rows if the tape is longer.",
    cross: "Rodney 10×10 cross frame, then extra rows if needed.",
  };

  const $ = (id) => document.getElementById(id);

  const state = {
    posts: [],
    byQ: new Map(),
    inDeg: new Map(),
    hasQ: new Set(),
    ordered: [],
    tapes: null,
    grid: null,
    cells: [],
    selected: 3414,
    hover: null,
    order: "q",
    weave: "raster",
    cell: "cross",
    tape: "triple-text",
    chips: "spoke-hops",
    color: "off",
    theme: "ebs",
    ebsPaint: "toast",
    gaps: false,
    labels: false,
    hideEmpty: true,
    hideSolid: true,
    atlas: null,
    dirty: true,
    packing: false,
  };

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

  function fieldHelpers() {
    return {
      firstLock: firstLock,
      inDegree: (q) => state.inDeg.get(q) || 0,
      hasQ: (n) => state.hasQ.has(n),
    };
  }

  function stampPlain(p) {
    if (!p) return "";
    const n = (p.hh | 0) * 100 + (p.mm | 0);
    const n12 = (((p.hh | 0) + 12) % 24) * 100 + (p.mm | 0);
    const a = state.hasQ.has(n) ? String(n) : "—";
    const b = state.hasQ.has(n12) ? String(n12) : "—";
    return `${pad2(p.hh)}${pad2(p.mm)}→${a}/${b}`;
  }

  function encodeGlyphs(nameList) {
    const out = new Uint8Array(nameList.length);
    for (let i = 0; i < nameList.length; i++) {
      const v = G_CODE[nameList[i]];
      out[i] = v == null ? G_SQ0 : v;
    }
    return out;
  }

  function buildTape(p) {
    const Q = globalThis.Quads;
    if (!Q || !p) return new Uint8Array([G_SQ0]);
    if (state.tape === "chip") {
      const g = Q.fieldGlyph(p, state.chips, fieldHelpers());
      return encodeGlyphs([g]);
    }
    const text = decodeHtml(p.text || "");
    if (!text) return new Uint8Array([G_SQ0]);
    let c1 = Q.asciiToBits(text);
    if (state.tape === "head8") c1 = c1.slice(0, 64);
    let c2 = [];
    let c3 = [];
    if (state.tape === "triple-text") {
      c2 = Q.asciiToBits(walk(p.q).join("→"));
      c3 = Q.asciiToBits(stampPlain(p));
    }
    const m = Q.merge(c1, c2, c3);
    return encodeGlyphs(m.glyphs);
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

  function isSolidPost(p) {
    return !decodeHtml((p && p.text) || "").trim();
  }

  function rebuildOrder() {
    let list = globalThis.QuadPage.sortPosts(state.posts, state.order, {
      firstLock: firstLock,
      walk: walk,
    });
    if (state.hideSolid) list = list.filter((p) => !isSolidPost(p));
    state.ordered = list;
  }

  function stageSize() {
    const cv = $("page");
    const w = Math.max(8, cv.clientWidth || 8);
    const h = Math.max(8, cv.clientHeight || 8);
    return { w: w, h: h };
  }

  function rebuildGrid() {
    const sz = stageSize();
    const n = state.ordered.length || 1;
    state.grid = globalThis.QuadPage.fitGrid(n, sz.w, sz.h, state.hideEmpty);
    const g = state.grid;
    g.weave = state.weave;
    const cells = new Array(g.cols * g.rows);
    for (let i = 0; i < cells.length; i++) cells[i] = null;
    for (let i = 0; i < state.ordered.length; i++) {
      const pos = globalThis.QuadPage.slotPos(i, g, state.weave);
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

  function rainbowAt(i) {
    const n = HOP_COL.length || 7;
    return HOP_COL[(((i | 0) % n) + n) % n];
  }

  function ebsSquareAt(i) {
    const pal = paintSquares();
    const n = pal.length || 1;
    return pal[(((i | 0) % n) + n) % n];
  }

  function isBlackHex(hex) {
    const rgb = hexRgb(hex);
    return rgb[0] < 12 && rgb[1] < 12 && rgb[2] < 12;
  }

  function isWhiteHex(hex) {
    const rgb = hexRgb(hex);
    return rgb[0] > 240 && rgb[1] > 240 && rgb[2] > 240;
  }

  function darkenHex(hex, k) {
    const rgb = hexRgb(hex);
    const t = k == null ? 0.22 : k;
    return `rgb(${Math.round(rgb[0] * t)},${Math.round(rgb[1] * t)},${Math.round(rgb[2] * t)})`;
  }

  function paintSquares() {
    return EBS_SQUARES;
  }

  function toastOn() {
    return ebsOn() && state.ebsPaint === "toast";
  }

  function toastInk(code) {
    return TOAST_INK[(code | 0) & 3] || TOAST_INK[0];
  }

  function ebsBand(cell) {
    const n = paintSquares().length || 1;
    if (cell && state.grid && state.grid.cols) {
      return Math.min(n - 1, Math.floor((cell.col / state.grid.cols) * n));
    }
    if (cell && cell.post) return (((cell.post.q | 0) - 1) % n + n) % n;
    return 0;
  }

  function ebsPaintCtx(cell, post) {
    return {
      hops: (post && post.hops) | 0,
      band: ebsBand(cell),
    };
  }

  function cellFill(p, cell) {
    if (state.color === "hops") return HOP_COL[Math.min(6, p.hops | 0)];
    if (state.color === "ampm") return (p.hh | 0) >= 12 ? THEME.ampmPm : THEME.ampmAm;
    if (state.color === "basin") return firstLock(p.q) === 1222 ? THEME.crimson : THEME.gold;
    if (state.theme === "ebs" && state.ebsPaint === "spectrum") {
      const hex = ebsSquareAt(ebsBand(cell));
      if (isBlackHex(hex)) return "#3a3a3a";
      if (isWhiteHex(hex)) return "#5c5c5c";
      return darkenHex(hex, 0.28);
    }
    if (toastOn()) return darkenHex(TOAST_CELL, 0.22);
    if (state.theme === "ebs") return darkenHex(rainbowAt(p.hops | 0), 0.34);
    return THEME.cell;
  }

  function hexRgb(hex) {
    const h = String(hex || "").replace("#", "").trim();
    if (h.length < 6) return [255, 255, 255, 255];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 255];
  }

  function cssVar(name) {
    return getComputedStyle(document.body).getPropertyValue(name).trim();
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
    THEME.ampmAm = cssVar("--ampm-am") || THEME.ampmAm;
    THEME.ampmPm = cssVar("--ampm-pm") || THEME.ampmPm;
    HOP_COL = [0, 1, 2, 3, 4, 5, 6].map((i) => cssVar(`--hop-${i}`) || HOP_COL[i]);
    EBS_SQUARES = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => cssVar(`--ebs-${i}`) || EBS_SQUARES[i]);
    TOAST_INK = [
      cssVar("--toast-sq0") || TOAST_INK[0],
      cssVar("--toast-sq1") || TOAST_INK[1],
      cssVar("--toast-bar0") || TOAST_INK[2],
      cssVar("--toast-bar1") || TOAST_INK[3],
    ];
    TOAST_CELL = cssVar("--toast-cell") || TOAST_CELL;
    GLYPH_RGBA = [hexRgb(THEME.ink), hexRgb(THEME.crimson), hexRgb(THEME.bar0), hexRgb(THEME.sage)];
    document.body.dataset.paint = state.ebsPaint;
  }

  const blitScratch = document.createElement("canvas");
  const blitCtx = blitScratch.getContext("2d");

  function ebsOn() {
    return state.theme === "ebs";
  }

  function ebsSpectrum() {
    return ebsOn() && state.ebsPaint === "spectrum";
  }

  function glyphPaint(code, i, paint) {
    paint = paint || {};
    if (toastOn()) return toastInk(code);
    if (ebsSpectrum()) return ebsSquareAt((paint.band | 0) + (i | 0));
    if (ebsOn()) {
      if (code === G_SQ0) return "#ffffff";
      if (code === G_BAR0) return "#000000";
      return rainbowAt(paint.hops | 0);
    }
    if (code === G_SQ0) return THEME.ink;
    if (code === G_SQ1) return THEME.crimson;
    if (code === G_BAR0) return THEME.bar0;
    return THEME.sage;
  }

  function drawGlyph(ctx, x, y, gw, gh, code, color) {
    const pad = Math.max(0.15, Math.min(gw, gh) * 0.12);
    const ix = x + pad;
    const iy = y + pad;
    const iw = Math.max(0.5, gw - pad * 2);
    const ih = Math.max(0.5, gh - pad * 2);
    const fill = color || THEME.ink;
    const stroke = color || (code === G_SQ1 ? THEME.crimson : THEME.sage);
    if (gw < 2.2 || gh < 2.2) {
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, Math.max(0.6, gw), Math.max(0.6, gh));
      return;
    }
    if (code === G_SQ0) {
      ctx.fillStyle = fill;
      ctx.fillRect(ix, iy, iw, ih);
      if (isBlackHex(fill) && Math.min(iw, ih) >= 4) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = Math.max(0.6, Math.min(iw, ih) * 0.06);
        ctx.strokeRect(ix + 0.4, iy + 0.4, iw - 0.8, ih - 0.8);
      }
    } else if (code === G_SQ1) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(0.7, Math.min(iw, ih) * 0.12);
      ctx.strokeRect(ix + 0.4, iy + 0.4, iw - 0.8, ih - 0.8);
    } else if (code === G_BAR0) {
      const bw = iw * 0.38;
      ctx.fillStyle = fill;
      ctx.fillRect(ix + (iw - bw) / 2, iy, bw, ih);
      if (isBlackHex(fill) && ih >= 4) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = Math.max(0.6, bw * 0.12);
        ctx.strokeRect(ix + (iw - bw) / 2, iy, bw, ih);
      }
    } else {
      ctx.strokeStyle = stroke;
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

  function blitTape(ctx, x, y, w, h, glyphs, spec, hueBase) {
    const cols = spec.cols;
    const rows = spec.rows;
    if (blitScratch.width !== cols || blitScratch.height !== rows) {
      blitScratch.width = cols;
      blitScratch.height = rows;
    }
    const img = blitCtx.createImageData(cols, rows);
    const data = img.data;
    data.fill(0);
    const n = glyphs.length;
    const paint = hueBase && typeof hueBase === "object" ? hueBase : { hops: hueBase | 0, band: 0 };
    for (let i = 0; i < n; i++) {
      const p = globalThis.QuadPage.cellXY(i, spec);
      const code = glyphs[i];
      let c;
      if (toastOn()) {
        c = hexRgb(toastInk(code));
      } else if (ebsSpectrum()) {
        c = hexRgb(ebsSquareAt((paint.band | 0) + i));
        if (code === G_SQ1 || code === G_BAR1) {
          if (isBlackHex(ebsSquareAt((paint.band | 0) + i))) c = [90, 90, 90, 255];
          else c = [Math.round(c[0] * 0.55), Math.round(c[1] * 0.55), Math.round(c[2] * 0.55), 255];
        }
      } else if (ebsOn()) {
        if (code === G_SQ0) c = [255, 255, 255, 255];
        else if (code === G_BAR0) c = [0, 0, 0, 255];
        else {
          c = hexRgb(rainbowAt(paint.hops | 0));
          c = [Math.round(c[0] * 0.85), Math.round(c[1] * 0.85), Math.round(c[2] * 0.85), 255];
        }
      } else {
        c = GLYPH_RGBA[code] || GLYPH_RGBA[0];
      }
      const o = (p.r * cols + p.c) * 4;
      data[o] = c[0];
      data[o + 1] = c[1];
      data[o + 2] = c[2];
      data[o + 3] = c[3];
    }
    blitCtx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(blitScratch, 0, 0, cols, rows, x, y, w, h);
  }

  function drawTapeInRect(ctx, x, y, w, h, glyphs, cellKind, paint) {
    const n = glyphs && glyphs.length ? glyphs.length : 0;
    if (!n) return;
    const ctxp = paint && typeof paint === "object" ? paint : { hops: paint | 0, band: 0 };
    if (n === 1) {
      drawGlyph(ctx, x, y, w, h, glyphs[0], glyphPaint(glyphs[0], 0, ctxp));
      return;
    }
    const spec = globalThis.QuadPage.cellSpec(cellKind, n, state.hideEmpty);
    const gw = w / spec.cols;
    const gh = h / spec.rows;
    // Page-scale overview stays a 1px blit. The inspector peek is large
    // enough to draw real squares/bars — required for Toast, where the
    // four hex inks otherwise collapse into two muddy bands.
    const tiny = gw < 3 || gh < 3;
    if (tiny || (n > 64 && !toastOn())) {
      blitTape(ctx, x, y, w, h, glyphs, spec, ctxp);
      return;
    }
    for (let i = 0; i < n; i++) {
      const p = globalThis.QuadPage.cellXY(i, spec);
      drawGlyph(ctx, x + p.c * gw, y + p.r * gh, gw, gh, glyphs[i], glyphPaint(glyphs[i], i, ctxp));
    }
  }

  function paintAtlas() {
    const cv = $("page");
    const sz = stageSize();
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
      const r = globalThis.QuadPage.cellRect(cell.col, cell.row, g);
      const x = r.x + gap;
      const y = r.y + gap;
      const w = Math.max(0.8, r.w - gap * 2);
      const h = Math.max(0.8, r.h - gap * 2);
      ctx.fillStyle = cellFill(cell.post, cell);
      ctx.fillRect(x, y, w, h);
      const glyphs = state.tapes[cell.post.q] || new Uint8Array([G_SQ0]);
      const tapeH = labelOk ? h - 10 : h;
      drawTapeInRect(ctx, x + 0.4, y + 0.4, w - 0.8, Math.max(1, tapeH - 0.8), glyphs, state.cell, ebsPaintCtx(cell, cell.post));
      if (labelOk) {
        ctx.fillStyle = THEME.gold2;
        ctx.fillText(String(cell.post.q), x + 2, y + h - 10);
      }
    }
    state.dirty = false;
  }

  function hitAt(cssX, cssY) {
    const g = state.grid;
    if (!g) return null;
    const pos = globalThis.QuadPage.hitPos(cssX, cssY, g);
    if (!pos) return null;
    return state.cells[pos.row * g.cols + pos.col] || null;
  }

  function drawOverlay(ctx, w, h) {
    const g = state.grid;
    if (!g) return;
    const marks = [state.hover, state.cells.find((c) => c && c.post.q === state.selected)];
    const seen = new Set();
    for (const cell of marks) {
      if (!cell || seen.has(cell.post.q)) continue;
      seen.add(cell.post.q);
      const r = globalThis.QuadPage.cellRect(cell.col, cell.row, g);
      ctx.strokeStyle = cell.post.q === state.selected ? THEME.gold2 : THEME.gold;
      ctx.lineWidth = cell.post.q === state.selected ? 2 : 1;
      ctx.strokeRect(r.x + 0.6, r.y + 0.6, r.w - 1.2, r.h - 1.2);
    }
  }

  function draw() {
    const cv = $("page");
    if (!cv) return;
    const sz = stageSize();
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
    drawOverlay(ctx, sz.w, sz.h);
  }

  function c1Text(p) {
    const Q = globalThis.Quads;
    if (!Q || !p) return "";
    const glyphs = state.tapes && state.tapes[p.q];
    if (!glyphs || !glyphs.length) return decodeHtml(p.text || "");
    const names = ["sq0", "sq1", "bar0", "bar1"];
    const list = [];
    for (let i = 0; i < glyphs.length; i++) list.push(names[glyphs[i]] || "sq0");
    return Q.bitsToAscii(Q.split(list).c1);
  }

  function paintPeek(p) {
    const cv = $("peek");
    if (!cv) return;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const w = Math.max(8, cv.clientWidth || cv.width || 300);
    const h = Math.max(8, cv.clientHeight || cv.height || 220);
    const bw = Math.max(1, Math.floor(w * dpr));
    const bh = Math.max(1, Math.floor(h * dpr));
    if (cv.width !== bw || cv.height !== bh) {
      cv.width = bw;
      cv.height = bh;
    }
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = state.theme === "ebs" ? "#6a6a6a" : THEME.stage;
    ctx.fillRect(0, 0, w, h);
    if (!p) return;
    const glyphs = (state.tapes && state.tapes[p.q]) || new Uint8Array([G_SQ0]);
    const pad = 8;
    const cell = state.cells.find((c) => c && c.post && c.post.q === p.q);
    drawTapeInRect(ctx, pad, pad, w - pad * 2, h - pad * 2, glyphs, state.cell, ebsPaintCtx(cell, p));
  }

  function renderInspector() {
    const p = state.byQ.get(state.selected);
    const sel = $("sel-readout");
    if (sel) sel.textContent = p ? `#${p.q}` : "—";
    const meta = $("inspect-meta");
    const textEl = $("inspect-text");
    if (!p) {
      if (meta) meta.textContent = "Click a cell.";
      if (textEl) textEl.textContent = "—";
      paintPeek(null);
      return;
    }
    const glyphs = (state.tapes && state.tapes[p.q]) || new Uint8Array([G_SQ0]);
    const spec = globalThis.QuadPage.cellSpec(state.cell, glyphs.length, state.hideEmpty);
    const lock = firstLock(p.q);
    const path = walk(p.q);
    if (meta) {
      meta.textContent =
        `#${p.q}  ${p.date}  ${pad2(p.hh)}:${pad2(p.mm)}:${pad2(p.ss)} EST\n` +
        `spoke ${p.spoke}  hops ${p.hops}  next ${p.next}  lock ${lock}\n` +
        `glyphs ${glyphs.length}  cell ${spec.cols}×${spec.rows}  tape ${state.tape}\n` +
        `walk ${path.join("→")}`;
    }
    if (textEl) {
      if (state.tape === "chip") {
        const names = ["sq0", "sq1", "bar0", "bar1"];
        textEl.textContent = `${names[glyphs[0]] || "sq0"} · ${state.chips}`;
      } else {
        textEl.textContent = c1Text(p) || "(empty)";
      }
    }
    paintPeek(p);
    if ($("qnum") && document.activeElement !== $("qnum")) $("qnum").value = String(p.q);
  }

  function setNotes() {
    if ($("order-note")) $("order-note").textContent = ORDER_NOTE[state.order] || "";
    let extra = state.tape === "chip" ? ` Map: ${state.chips}.` : "";
    if (state.theme === "ebs" && state.ebsPaint === "spectrum") {
      extra += " EBS spectrum: each glyph walks ROYGBIV + white + black. Cell band follows the header stripe.";
    } else if (state.theme === "ebs" && state.ebsPaint === "toast") {
      extra += " EBS toast: hex is the four-symbol code. sq0=#901131 sq1=#319011 bar0=#113190 bar1=#903111. Cell ground #901171.";
    } else if (state.theme === "ebs") {
      extra += " EBS meaning: white = square (C1=0), black = bar (C1=1). Cell color = hops to lock (red→violet). Hollow extra-bits (Code 2/3) take that hops color.";
    }
    if (state.hideEmpty) extra += " Empty slots hidden: leftover page cells and padded tape cells are omitted.";
    if (state.hideSolid) extra += " Solid squares off: empty-text posts (544, 550, …) are omitted.";
    if ($("tape-note")) $("tape-note").textContent = (TAPE_NOTE[state.tape] || "") + " " + (CELL_NOTE[state.cell] || "") + extra;
  }

  function writeHash() {
    const parts = [
      `q=${state.selected}`,
      `order=${state.order}`,
      `weave=${state.weave}`,
      `cell=${state.cell}`,
      `tape=${state.tape}`,
      `chips=${state.chips}`,
      `color=${state.color}`,
      `theme=${state.theme}`,
      `paint=${state.ebsPaint}`,
    ];
    if (!state.gaps) parts.push("gaps=0");
    if (state.labels) parts.push("labels=1");
    if (state.hideEmpty) parts.push("hide=1");
    if (state.hideSolid) parts.push("solid=1");
    const next = "#" + parts.join("&");
    if (location.hash !== next) history.replaceState(null, "", next);
  }

  function readHash() {
    const raw = (location.hash || "").replace(/^#/, "");
    if (!raw) return;
    const P = globalThis.QuadPage;
    const map = {};
    raw.split("&").forEach((pair) => {
      const i = pair.indexOf("=");
      if (i < 0) map[pair] = "1";
      else map[decodeURIComponent(pair.slice(0, i))] = decodeURIComponent(pair.slice(i + 1));
    });
    if (map.q) state.selected = P.clampInt(Number(map.q), 1, 4966);
    if (map.order && P.ORDER.indexOf(map.order) >= 0) state.order = map.order;
    if (map.weave && P.WEAVE.indexOf(map.weave) >= 0) state.weave = map.weave;
    if (map.cell && P.CELL.indexOf(map.cell) >= 0) state.cell = map.cell;
    if (map.tape && P.TAPE.indexOf(map.tape) >= 0) state.tape = map.tape;
    if (map.chips && P.CHIPS.indexOf(map.chips) >= 0) state.chips = map.chips;
    if (map.color && ["off", "hops", "ampm", "basin"].indexOf(map.color) >= 0) state.color = map.color;
    if (map.theme && THEME_IDS.indexOf(map.theme) >= 0) state.theme = map.theme;
    if (map.paint && PAINT_IDS.indexOf(map.paint) >= 0) state.ebsPaint = map.paint;
    if (map.gaps === "0") state.gaps = false;
    if (map.labels === "1") state.labels = true;
    if (map.hide === "1") state.hideEmpty = true;
    if (map.solid === "1") state.hideSolid = true;
  }

  function syncControls() {
    const bind = (id, val) => {
      if ($(id) && $(id).value !== String(val)) $(id).value = String(val);
    };
    bind("order", state.order);
    bind("weave", state.weave);
    bind("cell", state.cell);
    bind("tape", state.tape);
    bind("chips", state.chips);
    bind("color", state.color);
    bind("theme", state.theme);
    bind("ebs-paint", state.ebsPaint);
    applyTheme(state.theme);
    if ($("gaps")) $("gaps").checked = state.gaps;
    if ($("labels")) $("labels").checked = state.labels;
    if ($("hide-empty")) $("hide-empty").checked = state.hideEmpty;
    if ($("hide-solid")) $("hide-solid").checked = state.hideSolid;
    if ($("qnum")) $("qnum").value = String(state.selected);
    setNotes();
  }

  function relayout(opts) {
    const o = opts || {};
    const st = $("pack-status");
    if (st) st.textContent = "packing…";
    if (o.tapes !== false) rebuildTapes();
    if (o.order !== false) rebuildOrder();
    rebuildGrid();
    state.dirty = true;
    draw();
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
    const n = globalThis.QuadPage.clampInt(q, 1, state.posts.length || 4966);
    state.selected = n;
    renderInspector();
    draw();
    writeHash();
    if (fromClick) document.body.classList.add("show-inspect");
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
    draw();
  }

  async function load() {
    readHash();
    syncControls();
    const res = await fetch("data/corpus.json");
    const data = await res.json();
    state.posts = data.posts || [];
    state.byQ.clear();
    state.inDeg.clear();
    state.hasQ.clear();
    for (let i = 0; i < state.posts.length; i++) {
      const p = state.posts[i];
      state.byQ.set(p.q, p);
      state.hasQ.add(p.q);
    }
    for (let i = 0; i < state.posts.length; i++) {
      const p = state.posts[i];
      if (p.next != null) state.inDeg.set(p.next, (state.inDeg.get(p.next) || 0) + 1);
    }
    const meta = $("banner-meta");
    if (meta) {
      meta.innerHTML = `<b>${state.posts.length}</b> posts · Drew/Rodney four-symbol · independent packing`;
    }
    if (!state.byQ.has(state.selected)) state.selected = 421;
    relayout();
  }

  function bind() {
    const sel = (id, key, tapes) => {
      if (!$(id)) return;
      $(id).addEventListener("change", () => {
        state[key] = $(id).value;
        setNotes();
        relayout({ tapes: !!tapes, order: key === "order" || key === "weave" });
      });
    };
    sel("order", "order", false);
    sel("weave", "weave", false);
    sel("cell", "cell", false);
    sel("tape", "tape", true);
    sel("chips", "chips", true);
    sel("color", "color", false);
    if ($("theme")) {
      $("theme").addEventListener("change", () => {
        applyTheme($("theme").value);
        setNotes();
        relayout({ tapes: false, order: false });
      });
    }
    if ($("ebs-paint")) {
      $("ebs-paint").addEventListener("change", () => {
        const v = $("ebs-paint").value;
        state.ebsPaint = PAINT_IDS.indexOf(v) >= 0 ? v : "meaning";
        document.body.dataset.paint = state.ebsPaint;
        setNotes();
        relayout({ tapes: false, order: false });
      });
    }
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
    if ($("go")) {
      $("go").addEventListener("click", () => selectQ(Number($("qnum").value)));
    }
    if ($("qnum")) {
      $("qnum").addEventListener("keydown", (e) => {
        if (e.key === "Enter") selectQ(Number($("qnum").value));
      });
    }
    if ($("fit")) {
      $("fit").addEventListener("click", () => relayout({ tapes: false }));
    }
    const cv = $("page");
    cv.addEventListener("mousemove", (e) => {
      const r = cv.getBoundingClientRect();
      const hit = hitAt(e.clientX - r.left, e.clientY - r.top);
      const q = hit ? hit.post.q : null;
      if ((state.hover && state.hover.post.q) !== q) {
        state.hover = hit;
        draw();
      }
    });
    cv.addEventListener("mouseleave", () => {
      if (state.hover) {
        state.hover = null;
        draw();
      }
    });
    cv.addEventListener("click", (e) => {
      const r = cv.getBoundingClientRect();
      const hit = hitAt(e.clientX - r.left, e.clientY - r.top);
      if (hit) selectQ(hit.post.q, true);
    });
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

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
  const LAYER_IDS = ["off", "peel", "mute", "stack", "diff"];
  const ALIGN_IDS = ["tape", "stream"];
  const COMP_IDS = ["solo", "add", "screen", "multiply"];
  const ONPAGE_IDS = ["off", "under", "over"];
  const MIX_DEFAULT = 55;
  const PLATE_INK = { c1: "#111111", c2: "#c41e3a", c3: "#1e4ec4" };
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
    ampm: "AM stamps, then PM. 12h fold lives on :8765.",
    even: "Even q, then odd q.",
    loop: "LOOP depth (hops) then q — closer to lock first.",
    walkseq: "First visit along walk(q) for q=1…4966. Every post once.",
  };
  const PICTURE_NOTE = {
    off: "Order + Weave pack the page as before. Picture scans stay off. Transform applies only when Picture is not Off.",
    frame: "Lock the page to 64×74 (4,735 text posts + 1 remainder). Weave still fills it. Glyphs inside each square are unchanged.",
    morton: "Z-order (Morton) on 64×74. Neighboring squares stay near each other in 2-D — the usual descramble if a picture was stored as a quadtree.",
    hilbert: "Hilbert curve on 64×74 (window of a 128-curve). Stronger locality than Z-order.",
    bitrev: "Bit-reversal of the raster index. FFT-style unshuffle of 64×74.",
    zigzag: "Diagonal zig-zag, JPEG-style, across the 64×74 frame.",
    interlace: "Even rows, then odd rows. Analog-TV / PNG 2:1 interlace.",
    blocks8: "8×8 blocks (64-wide is exact), then the leftover two rows. JPEG MCU order.",
    mod37: "37-way interlace. 74 = 2×37 and 64×74 is 37 groups of 128.",
    nipkow: "Polar scan from the center: angle, then radius. Same family as the Nipkow CRT.",
    shuffle: "Seeded shuffle (421). If this still looks like a picture, the mapping is a palette trick, not a packing.",
  };
  const XFORM_NOTE = {
    none: "",
    fliph: "Mirror left ↔ right.",
    flipv: "Mirror top ↔ bottom.",
    rot90: "Rotate 90° clockwise onto 74×64.",
    rot180: "Rotate 180°.",
    rot270: "Rotate 90° counter-clockwise onto 74×64.",
    transp: "Transpose onto 74×64 (the wide-window twin of 64×74).",
  };
  const TAPE_NOTE = {
    "c1-only": "Full post text as Code 1. Long posts squeeze more rows into the same rectangle.",
    "triple-text": "C1 = post text. C2 = LOOP walk. C3 = HHMM→hash line. Same merge as :8765.",
    head8: "First eight ASCII bytes (64 glyphs). Drew’s 8×8 notebook cell, readable at page scale.",
    chip: "One field glyph per post, same maps as :8765 disc chips.",
  };
  const CELL_NOTE = {
    byte: "Drew byte rows: 8 glyphs = one ASCII character, left to right, top to bottom.",
    notebook: "8765 quads face flattened: 32 glyphs per row, outer ring = first row.",
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
    theme: "paper",
    ebsPaint: "meaning",
    gaps: true,
    labels: false,
    hideEmpty: false,
    hideSolid: false,
    filledFrame: false,
    picture: "off",
    xform: "none",
    layer: "off",
    align: "tape",
    comp: "solo",
    plates: { c1: true, c2: true, c3: true },
    mute: { sq0: false, sq1: false, bar0: false, bar1: false },
    stack: "peek",
    onPage: "off",
    mix: MIX_DEFAULT,
    shuffle: false,
    essay: false,
    teaching: null,
    teachingGlyphs: null,
    atlas: null,
    glyphAtlas: null,
    plateAtlas: null,
    dirty: true,
    packing: false,
  };

  let mixRaf = 0;
  let mixHashTimer = 0;

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

  function pictureOn() {
    return state.picture && state.picture !== "off";
  }

  function layerOn() {
    return state.layer && state.layer !== "off";
  }

  function muteOn() {
    return state.layer === "mute";
  }

  function pagePlatesOn() {
    return state.layer === "peel" && (state.onPage === "under" || state.onPage === "over");
  }

  function plateMix() {
    const m = state.mix | 0;
    return Math.max(0, Math.min(100, m)) / 100;
  }

  function applyLayerChrome() {
    document.body.dataset.layer = state.layer || "off";
    const plates = $("plates-block");
    if (plates) {
      const show = state.layer === "peel" || state.layer === "stack" || state.layer === "diff";
      plates.hidden = !show;
    }
    const badge = $("essay-badge");
    if (badge) badge.hidden = !state.essay;
    const essayText = $("essay-text");
    if (essayText) essayText.hidden = !state.essay;
  }

  function clearEssay() {
    if (!state.essay) return false;
    state.essay = false;
    return true;
  }

  function muteMaskFor(glyphs) {
    if (!muteOn() || !globalThis.QuadLayers) return null;
    return globalThis.QuadLayers.muteMask(glyphs, state.mute);
  }

  function rebuildGrid() {
    const sz = stageSize();
    const n = state.ordered.length || 1;
    const P = globalThis.QuadPage;
    if (pictureOn()) {
      const dim = P.xformSize(state.xform);
      state.grid = P.lockedGrid(dim.cols, dim.rows, n, sz.w, sz.h);
      state.grid.packed = state.picture === "frame" && !!state.hideEmpty;
      state.grid.weave = state.weave;
    } else {
      state.grid = P.fitGrid(n, sz.w, sz.h, state.hideEmpty);
      state.grid.weave = state.weave;
    }
    const g = state.grid;
    const cells = new Array(g.cols * g.rows);
    for (let i = 0; i < cells.length; i++) cells[i] = null;
    const limit = Math.min(state.ordered.length, g.slots);
    for (let i = 0; i < limit; i++) {
      const pos = P.pictureSlot(i, g, state.picture, state.weave, state.xform);
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
      const pic = pictureOn() ? " · 64×74 picture" : "";
      const clip = n > g.slots ? ` · clipped ${n - g.slots}` : "";
      el.textContent = `${g.cols}×${g.rows} · ${g.cellW.toFixed(1)}×${g.cellH.toFixed(1)} px · ${Math.min(n, g.slots)} posts${extra}${solid}${pic}${clip}`;
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
    const mask = muteMaskFor(glyphs);
    for (let i = 0; i < n; i++) {
      if (mask && !mask[i]) continue;
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
      const mask1 = muteMaskFor(glyphs);
      if (mask1 && !mask1[0]) return;
      drawGlyph(ctx, x, y, w, h, glyphs[0], glyphPaint(glyphs[0], 0, ctxp));
      return;
    }
    const spec = globalThis.QuadPage.cellSpec(cellKind, n, state.hideEmpty);
    const gw = w / spec.cols;
    const gh = h / spec.rows;
    // Page-scale overview stays a 1px blit. Off (default): the inspector
    // peek draws real squares/bars when they fit — Toast needs that or
    // the four hex inks collapse. On (Filled frame): blit every tape the
    // way Meaning does, one solid cell per glyph, stretched to the box.
    const tiny = gw < 3 || gh < 3;
    if (state.filledFrame || tiny || (n > 64 && !toastOn())) {
      blitTape(ctx, x, y, w, h, glyphs, spec, ctxp);
      return;
    }
    const mask = muteMaskFor(glyphs);
    for (let i = 0; i < n; i++) {
      if (mask && !mask[i]) continue;
      const p = globalThis.QuadPage.cellXY(i, spec);
      drawGlyph(ctx, x + p.c * gw, y + p.r * gh, gw, gh, glyphs[i], glyphPaint(glyphs[i], i, ctxp));
    }
  }

  function prepLayerCanvas(existing, bw, bh, dpr, opaque) {
    const cv = existing || document.createElement("canvas");
    if (cv.width !== bw || cv.height !== bh) {
      cv.width = bw;
      cv.height = bh;
    }
    const ctx = cv.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (opaque) {
      ctx.fillStyle = THEME.stage;
      ctx.fillRect(0, 0, bw, bh);
    } else {
      ctx.clearRect(0, 0, bw, bh);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    return { cv: cv, ctx: ctx };
  }

  function paintAtlas() {
    const sz = stageSize();
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const bw = Math.max(1, Math.floor(sz.w * dpr));
    const bh = Math.max(1, Math.floor(sz.h * dpr));
    const split = pagePlatesOn();
    const ground = prepLayerCanvas(state.atlas, bw, bh, dpr, true);
    state.atlas = ground.cv;
    const gctx = ground.ctx;
    let xctx = null;
    let pctx = null;
    if (split) {
      const glyphs = prepLayerCanvas(state.glyphAtlas, bw, bh, dpr, false);
      state.glyphAtlas = glyphs.cv;
      xctx = glyphs.ctx;
      const plates = prepLayerCanvas(state.plateAtlas, bw, bh, dpr, false);
      state.plateAtlas = plates.cv;
      pctx = plates.ctx;
    } else {
      state.glyphAtlas = null;
      state.plateAtlas = null;
    }
    const g = state.grid;
    if (!g) {
      state.dirty = false;
      return;
    }
    const gap = state.gaps ? Math.min(1.2, Math.max(0.4, Math.min(g.cellW, g.cellH) * 0.06)) : 0;
    const labelOk = state.labels && g.cellW >= 22 && g.cellH >= 14;
    if (labelOk) {
      gctx.font = `${Math.max(7, Math.min(10, g.cellH * 0.28))}px "IBM Plex Mono", monospace`;
      gctx.textBaseline = "top";
    }
    for (let i = 0; i < state.cells.length; i++) {
      const cell = state.cells[i];
      if (!cell) continue;
      const r = globalThis.QuadPage.cellRect(cell.col, cell.row, g);
      const x = r.x + gap;
      const y = r.y + gap;
      const w = Math.max(0.8, r.w - gap * 2);
      const h = Math.max(0.8, r.h - gap * 2);
      gctx.fillStyle = cellFill(cell.post, cell);
      gctx.fillRect(x, y, w, h);
      const glyphs = state.tapes[cell.post.q] || new Uint8Array([G_SQ0]);
      const tapeH = labelOk ? h - 10 : h;
      const tx = x + 0.4;
      const ty = y + 0.4;
      const tw = w - 0.8;
      const th = Math.max(1, tapeH - 0.8);
      const paint = ebsPaintCtx(cell, cell.post);
      if (split) {
        drawTapeInRect(xctx, tx, ty, tw, th, glyphs, state.cell, paint);
        drawPlatesInRect(pctx, tx, ty, tw, th, glyphs);
      } else {
        drawTapeInRect(gctx, tx, ty, tw, th, glyphs, state.cell, paint);
      }
      if (labelOk) {
        gctx.fillStyle = THEME.gold2;
        gctx.fillText(String(cell.post.q), x + 2, y + h - 10);
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
    const mix = plateMix();
    const split = pagePlatesOn() && state.glyphAtlas && state.plateAtlas;
    if (state.atlas) ctx.drawImage(state.atlas, 0, 0, cv.width, cv.height);
    if (split && mix > 0 && state.onPage === "under") {
      ctx.drawImage(state.plateAtlas, 0, 0, cv.width, cv.height);
      ctx.globalAlpha = 1 - mix;
      if (ctx.globalAlpha > 0.02) ctx.drawImage(state.glyphAtlas, 0, 0, cv.width, cv.height);
      ctx.globalAlpha = 1;
    } else if (split) {
      ctx.drawImage(state.glyphAtlas, 0, 0, cv.width, cv.height);
      if (mix > 0) {
        ctx.globalAlpha = mix;
        ctx.drawImage(state.plateAtlas, 0, 0, cv.width, cv.height);
        ctx.globalAlpha = 1;
      }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawOverlay(ctx, sz.w, sz.h);
  }

  function scheduleMixDraw() {
    if (mixRaf) return;
    mixRaf = requestAnimationFrame(() => {
      mixRaf = 0;
      draw();
      const p = state.byQ.get(state.selected);
      if (p) paintPeek(p);
    });
  }

  function scheduleMixHash() {
    if (mixHashTimer) clearTimeout(mixHashTimer);
    mixHashTimer = setTimeout(() => {
      mixHashTimer = 0;
      writeHash();
    }, 150);
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
    const glyphs = peekGlyphs(p);
    const pad = 8;
    const cell = state.cells.find((c) => c && c.post && c.post.q === p.q);
    drawLayeredTape(ctx, pad, pad, w - pad * 2, h - pad * 2, glyphs, state.cell, ebsPaintCtx(cell, p));
  }

  function peekGlyphs(p) {
    if (state.essay && state.teachingGlyphs) return state.teachingGlyphs;
    return (state.tapes && p && state.tapes[p.q]) || new Uint8Array([G_SQ0]);
  }

  function layerGlyphs(glyphs) {
    const L = globalThis.QuadLayers;
    if (state.shuffle && L) return L.shuffleGlyphs(glyphs, L.SEED);
    return glyphs;
  }

  function sizePlateCanvas(cv, cssW, cssH) {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const w = Math.max(8, cssW);
    const h = Math.max(8, cssH);
    const bw = Math.max(1, Math.floor(w * dpr));
    const bh = Math.max(1, Math.floor(h * dpr));
    if (cv.width !== bw || cv.height !== bh) {
      cv.width = bw;
      cv.height = bh;
    }
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    return { ctx: ctx, w: w, h: h, dpr: dpr };
  }

  function plateField(glyphs, which) {
    const L = globalThis.QuadLayers;
    const P = globalThis.QuadPage;
    if (!L || !P) return null;
    const g = layerGlyphs(glyphs);
    const n = g.length;
    if (which === "c1" || state.align !== "stream" || state.tape === "chip") {
      const plates = L.tapeAlignedPlates(g);
      return { bits: plates[which], spec: P.cellSpec(state.cell, n, state.hideEmpty) };
    }
    const split = L.splitAligned(g);
    let w;
    let h;
    if (state.essay) {
      if (which === "c2") {
        w = 8;
        h = 14;
      } else {
        w = 10;
        h = 10;
      }
    } else {
      const sz = L.streamSize(state.cell, (split[which] || []).length);
      w = sz.w;
      h = sz.h;
    }
    return {
      bits: L.streamRaster(split[which], w, h),
      spec: { id: "byte", cols: w, rows: h, n: w * h, packed: true },
    };
  }

  function drawPlatesInRect(ctx, x, y, w, h, glyphs) {
    const L = globalThis.QuadLayers;
    const P = globalThis.QuadPage;
    if (!L || !P) return;
    const ink = {
      c1: THEME.ink || PLATE_INK.c1,
      c2: L.INK_C2 || PLATE_INK.c2,
      c3: L.INK_C3 || PLATE_INK.c3,
    };
    const keys = ["c1", "c2", "c3"];
    const g = layerGlyphs(glyphs);
    const stream = state.align === "stream" && state.tape !== "chip";
    const packed = !stream ? L.tapeAlignedPlates(g) : null;
    const spec = !stream ? P.cellSpec(state.cell, g.length, state.hideEmpty) : null;
    ctx.save();
    if (state.comp === "add") ctx.globalCompositeOperation = "lighter";
    else if (state.comp === "screen") ctx.globalCompositeOperation = "screen";
    else if (state.comp === "multiply") ctx.globalCompositeOperation = "multiply";
    else ctx.globalCompositeOperation = "source-over";
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (!state.plates[k]) continue;
      const field = stream ? plateField(glyphs, k) : { bits: packed[k], spec: spec };
      if (!field || !field.bits) continue;
      blitBits(ctx, x, y, w, h, field.bits, field.spec, ink[k], THEME.stage, true);
    }
    ctx.restore();
  }

  function drawLayeredTape(ctx, x, y, w, h, glyphs, cellKind, paint) {
    const mix = plateMix();
    if (!pagePlatesOn() || mix <= 0) {
      drawTapeInRect(ctx, x, y, w, h, glyphs, cellKind, paint);
      return;
    }
    ctx.save();
    if (state.onPage === "under") {
      drawPlatesInRect(ctx, x, y, w, h, glyphs);
      ctx.globalAlpha = 1 - mix;
      if (ctx.globalAlpha > 0.02) drawTapeInRect(ctx, x, y, w, h, glyphs, cellKind, paint);
    } else {
      drawTapeInRect(ctx, x, y, w, h, glyphs, cellKind, paint);
      ctx.globalAlpha = mix;
      drawPlatesInRect(ctx, x, y, w, h, glyphs);
    }
    ctx.restore();
  }

  function blitBits(ctx, x, y, w, h, bits, spec, ink1, ink0, inkOnly) {
    const cols = Math.max(1, spec.cols | 0);
    const rows = Math.max(1, spec.rows | 0);
    if (blitScratch.width !== cols || blitScratch.height !== rows) {
      blitScratch.width = cols;
      blitScratch.height = rows;
    }
    const img = blitCtx.createImageData(cols, rows);
    const data = img.data;
    data.fill(0);
    const on = hexRgb(ink1);
    const off = hexRgb(ink0);
    const n = bits && bits.length ? bits.length : 0;
    for (let i = 0; i < n; i++) {
      const v = bits[i];
      if (v == null || v === -1) continue;
      if (inkOnly && !v) continue;
      const p = globalThis.QuadPage.cellXY(i, spec);
      const c = v ? on : off;
      const o = (p.r * cols + p.c) * 4;
      data[o] = c[0];
      data[o + 1] = c[1];
      data[o + 2] = c[2];
      data[o + 3] = 255;
    }
    blitCtx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(blitScratch, 0, 0, cols, rows, x, y, w, h);
  }

  function paintOnePlate(id, field, ink1) {
    const cv = $(id);
    if (!cv || !field) return;
    const box = sizePlateCanvas(cv, cv.clientWidth || 96, cv.clientHeight || 88);
    box.ctx.fillStyle = THEME.stage;
    box.ctx.fillRect(0, 0, box.w, box.h);
    blitBits(box.ctx, 0, 0, box.w, box.h, field.bits, field.spec, ink1, THEME.stage);
  }

  function flattenPlate(field, ink1, w, h) {
    const cv = document.createElement("canvas");
    cv.width = Math.max(1, w);
    cv.height = Math.max(1, h);
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    blitBits(ctx, 0, 0, w, h, field.bits, field.spec, ink1, "#ffffff", true);
    return cv;
  }

  function paintMix(fields) {
    const cv = $("plate-mix");
    if (!cv) return;
    const box = sizePlateCanvas(cv, cv.clientWidth || 300, cv.clientHeight || 140);
    const ctx = box.ctx;
    ctx.setTransform(box.dpr, 0, 0, box.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const enabled = fields.filter((f) => f && f.on && f.field);
    ctx.fillStyle = state.comp === "multiply" ? "#ffffff" : THEME.stage;
    ctx.fillRect(0, 0, box.w, box.h);
    if (!enabled.length) return;
    if (state.comp === "multiply") {
      ctx.globalCompositeOperation = "multiply";
      for (let i = 0; i < enabled.length; i++) {
        const f = enabled[i];
        const tmp = flattenPlate(f.field, f.ink, box.w, box.h);
        ctx.drawImage(tmp, 0, 0, box.w, box.h);
      }
      ctx.globalCompositeOperation = "source-over";
      return;
    }
    if (state.comp === "add") ctx.globalCompositeOperation = "lighter";
    else if (state.comp === "screen") ctx.globalCompositeOperation = "screen";
    else ctx.globalCompositeOperation = "source-over";
    for (let i = 0; i < enabled.length; i++) {
      const f = enabled[i];
      blitBits(ctx, 0, 0, box.w, box.h, f.field.bits, f.field.spec, f.ink, THEME.stage, state.comp !== "solo");
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function classInks() {
    const L = globalThis.QuadLayers || {};
    return [
      hexRgb(THEME.ink || PLATE_INK.c1),
      hexRgb(L.INK_C2 || PLATE_INK.c2),
      hexRgb(L.INK_C3 || PLATE_INK.c3),
      hexRgb(THEME.sage || "#a0a0a0"),
    ];
  }

  function blitRgbaField(ctx, x, y, w, h, rgba, cols, rows) {
    cols = Math.max(1, cols | 0);
    rows = Math.max(1, rows | 0);
    if (blitScratch.width !== cols || blitScratch.height !== rows) {
      blitScratch.width = cols;
      blitScratch.height = rows;
    }
    const img = blitCtx.createImageData(cols, rows);
    img.data.set(rgba);
    blitCtx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(blitScratch, 0, 0, cols, rows, x, y, w, h);
  }

  function codesToRgba(codes, inks) {
    const n = codes && codes.length ? codes.length : 0;
    const out = new Uint8ClampedArray(n * 4);
    const pal = inks || classInks();
    for (let i = 0; i < n; i++) {
      const c = codes[i];
      const o = i * 4;
      if (c == null || c === 255 || c < 0) {
        out[o + 3] = 0;
        continue;
      }
      const rgb = pal[c & 3] || pal[0];
      out[o] = rgb[0];
      out[o + 1] = rgb[1];
      out[o + 2] = rgb[2];
      out[o + 3] = 255;
    }
    return out;
  }

  function lumaToRgba(bytes) {
    const n = bytes && bytes.length ? bytes.length : 0;
    const out = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) {
      const g = bytes[i] | 0;
      const o = i * 4;
      out[o] = g;
      out[o + 1] = g;
      out[o + 2] = g;
      out[o + 3] = 255;
    }
    return out;
  }

  function diffToRgba(diff) {
    const n = diff && diff.length ? diff.length : 0;
    const out = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) {
      const g = Math.max(0, Math.min(255, 128 + (diff[i] | 0)));
      const o = i * 4;
      out[o] = g;
      out[o + 1] = g;
      out[o + 2] = g;
      out[o + 3] = 255;
    }
    return out;
  }

  function paintFieldCanvas(id, rgba, cols, rows) {
    const cv = $(id);
    if (!cv || !rgba) return;
    const box = sizePlateCanvas(cv, cv.clientWidth || 96, cv.clientHeight || 88);
    box.ctx.fillStyle = THEME.stage;
    box.ctx.fillRect(0, 0, box.w, box.h);
    blitRgbaField(box.ctx, 0, 0, box.w, box.h, rgba, cols, rows);
  }

  function setPlateCaptions(c1, c2, c3) {
    if ($("cap-c1")) $("cap-c1").textContent = c1;
    if ($("cap-c2")) $("cap-c2").textContent = c2;
    if ($("cap-c3")) $("cap-c3").textContent = c3;
  }

  function syncShuffleBtn() {
    const b = $("shuffle-sib");
    if (!b) return;
    b.setAttribute("aria-pressed", state.shuffle ? "true" : "false");
    b.textContent = state.shuffle ? "Shuffled (seed 421)" : "Shuffle sibling";
  }

  function siblingOrder() {
    const cur = state.order;
    // Sequential q and timestamp are the same permutation on this corpus.
    if (cur === "q" || cur === "ts") return "spoke";
    return "q";
  }

  function meanTapes(shuffled) {
    const L = globalThis.QuadLayers;
    const spec = L.frameSpec(state.cell);
    const out = [];
    for (let i = 0; i < state.posts.length; i++) {
      const p = state.posts[i];
      if (state.hideSolid && isSolidPost(p)) continue;
      let t = state.tapes && state.tapes[p.q];
      if (!t) continue;
      if (shuffled) {
        const n = Math.min(spec.n, t.length);
        const prefix = new Array(n);
        for (let k = 0; k < n; k++) prefix[k] = t[k];
        t = L.shuffleGlyphs(prefix, L.SEED);
      }
      out.push(t);
    }
    return { tapes: out, spec: spec };
  }

  function paintStackPlates() {
    const L = globalThis.QuadLayers;
    if (!L || !state.tapes) return;
    const packed = meanTapes(false);
    const shuffled = meanTapes(true);
    const ordered = L.meanFrame(packed.tapes, packed.spec);
    const shuf = L.meanFrame(shuffled.tapes, shuffled.spec);
    const inks = classInks();
    const spec = packed.spec;
    let selected = null;
    const p = state.byQ.get(state.selected);
    if (p && state.tapes[p.q] && !(state.hideSolid && isSolidPost(p))) {
      selected = L.meanFrame([state.tapes[p.q]], spec);
    }
    const left = state.stack === "peek" && selected ? selected : ordered;
    paintFieldCanvas("plate-c1", codesToRgba(left.argmax, inks), spec.cols, spec.rows);
    paintFieldCanvas("plate-c2", codesToRgba(ordered.argmax, inks), spec.cols, spec.rows);
    paintFieldCanvas("plate-c3", codesToRgba(shuf.argmax, inks), spec.cols, spec.rows);
    paintFieldCanvas("plate-mix", L.mixRgba(state.shuffle ? shuf : ordered, inks), spec.cols, spec.rows);
    setPlateCaptions(state.stack === "peek" ? "Selected frame" : "Ordered mean", "Corpus mean", "Shuffle 421");
    const note = $("plate-note");
    if (note) {
      const cmp = ordered.score <= shuf.score ? " no signal." : "";
      note.textContent =
        `Independent average of the ${spec.cols}×${spec.rows} ${state.cell} frame across posts. Not a find.` +
        (state.shuffle ? " Shuffled (seed 421)." : "");
      if (state.hideSolid) note.textContent += " Hide solid honored.";
      note.textContent += cmp;
    }
    const score = $("stack-score");
    if (score) {
      score.hidden = false;
      const flag = ordered.score <= shuf.score ? " no signal." : "";
      score.textContent = `Ordered score ${(ordered.score * 100).toFixed(1)}% · shuffle ${(shuf.score * 100).toFixed(1)}%.${flag}`;
    }
    const essayEl = $("essay-text");
    if (essayEl) {
      essayEl.hidden = true;
      essayEl.textContent = "";
    }
  }

  function orderLuma(orderId, shuffle) {
    const P = globalThis.QuadPage;
    const L = globalThis.QuadLayers;
    const g = state.grid;
    if (!P || !g) return { bytes: new Uint8Array(0), cols: 1, rows: 1 };
    let list = P.sortPosts(state.posts, orderId, { firstLock: firstLock, walk: walk });
    if (state.hideSolid) list = list.filter((p) => !isSolidPost(p));
    if (shuffle && L) {
      const idx = L.shufflePosts(list, L.SEED);
      list = idx.map((i) => list[i]);
    }
    const cols = g.cols;
    const rows = g.rows;
    const out = new Uint8Array(cols * rows);
    out.fill(128);
    const limit = Math.min(list.length, g.slots);
    for (let i = 0; i < limit; i++) {
      const pos = P.pictureSlot(i, g, state.picture, state.weave, state.xform);
      const t = state.tapes[list[i].q];
      out[pos.row * cols + pos.col] = tapeLuma(t);
    }
    return { bytes: out, cols: cols, rows: rows };
  }

  function tapeLuma(t) {
    const L = globalThis.QuadLayers;
    if (!t || !t.length) return 128;
    const n = Math.min(t.length, 64);
    let s = 0;
    for (let i = 0; i < n; i++) s += L.glyphLuma(t[i]);
    return Math.round(s / n);
  }

  function paintDiffPlates() {
    const L = globalThis.QuadLayers;
    if (!L || !state.tapes || !state.grid) return;
    const aId = state.order;
    const bId = siblingOrder();
    const a = orderLuma(aId, false);
    const b = orderLuma(bId, state.shuffle);
    const diff = L.diffLuma(a.bytes, b.bytes);
    const self = L.diffLuma(a.bytes, a.bytes);
    paintFieldCanvas("plate-c1", lumaToRgba(a.bytes), a.cols, a.rows);
    paintFieldCanvas("plate-c2", lumaToRgba(b.bytes), b.cols, b.rows);
    paintFieldCanvas("plate-c3", diffToRgba(self), a.cols, a.rows);
    paintFieldCanvas("plate-mix", diffToRgba(diff), a.cols, a.rows);
    setPlateCaptions("Order " + aId, (state.shuffle ? "Shuffled " : "Sibling ") + bId, "Order vs itself");
    const note = $("plate-note");
    if (note) {
      let extra = "";
      if ((aId === "q" || aId === "ts") && bId === "spoke") {
        extra = " Sequential q and timestamp match on this corpus, so the sibling is spoke.";
      }
      note.textContent =
        `Difference is ${aId} minus ${bId} as signed gray (128 = equal).` +
        extra +
        (state.shuffle ? " Sibling list shuffled with seed 421." : "") +
        " Independent packing — not a find.";
    }
    const score = $("stack-score");
    if (score) {
      score.hidden = false;
      let acc = 0;
      for (let i = 0; i < diff.length; i++) acc += diff[i] === 0 ? 1 : 0;
      const eq = diff.length ? acc / diff.length : 1;
      score.textContent = `${aId} vs ${bId} · ${((1 - eq) * 100).toFixed(1)}% cells differ · 128 = equal.`;
    }
    const essayEl = $("essay-text");
    if (essayEl) {
      essayEl.hidden = true;
      essayEl.textContent = "";
    }
  }

  function paintPlates(p) {
    applyLayerChrome();
    syncShuffleBtn();
    const show = state.layer === "peel" || state.layer === "stack" || state.layer === "diff";
    if (!show) {
      const essayEl = $("essay-text");
      if (essayEl) {
        essayEl.hidden = true;
        essayEl.textContent = "";
      }
      const note = $("plate-note");
      if (note) note.textContent = "";
      if ($("stack-score")) $("stack-score").hidden = true;
      setPlateCaptions("C1", "C2", "C3");
      return;
    }
    if (state.layer === "stack") {
      paintStackPlates();
      return;
    }
    if (state.layer === "diff") {
      paintDiffPlates();
      return;
    }
    if ($("stack-score")) $("stack-score").hidden = true;
    setPlateCaptions("C1", "C2", "C3");
    const L = globalThis.QuadLayers;
    if (!L) return;
    const glyphs = peekGlyphs(p);
    const c1 = plateField(glyphs, "c1");
    const c2 = plateField(glyphs, "c2");
    const c3 = plateField(glyphs, "c3");
    const ink1 = THEME.ink || PLATE_INK.c1;
    paintOnePlate("plate-c1", c1, ink1);
    paintOnePlate("plate-c2", c2, L.INK_C2 || PLATE_INK.c2);
    paintOnePlate("plate-c3", c3, L.INK_C3 || PLATE_INK.c3);
    paintMix([
      { on: state.plates.c1, field: c1, ink: ink1 },
      { on: state.plates.c2, field: c2, ink: L.INK_C2 || PLATE_INK.c2 },
      { on: state.plates.c3, field: c3, ink: L.INK_C3 || PLATE_INK.c3 },
    ]);
    const note = $("plate-note");
    if (note) {
      if (state.essay) {
        note.textContent = "Independent packing of the TEXTPIC teaching slogan + fish 8×14 + cross 10×10. padBytes=3. Not a Q post.";
      } else if (state.tape === "chip") {
        note.textContent = "One glyph. Peel is a single bit. Stream align is disabled.";
      } else if (state.tape === "c1-only") {
        note.textContent = "C2 and C3 are all zeros unless the encoder stuffed extras. Expect empty extra plates.";
      } else if (state.tape === "head8") {
        note.textContent = "First 8 ASCII bytes on C1. Extra plates follow whatever merge filled.";
      } else {
        note.textContent = "C1 = post text. C2 = LOOP walk bits. C3 = HHMM stamp bits. Not TEXTPIC pictures.";
      }
    }
    const essayEl = $("essay-text");
    if (essayEl) {
      if (state.essay && state.teachingGlyphs && globalThis.Quads) {
        const names = globalThis.QuadLayers.namesOf(state.teachingGlyphs);
        essayEl.hidden = false;
        essayEl.textContent = globalThis.Quads.bitsToAscii(globalThis.Quads.split(names).c1);
      } else {
        essayEl.hidden = true;
        essayEl.textContent = "";
      }
    }
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
      paintPlates(null);
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
    paintPlates(p);
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
    if (state.filledFrame) extra += " Filled frame: selected rectangle is a packed bitmap (one cell per glyph), same as Meaning.";
    if (pictureOn()) {
      extra += " Picture: " + (PICTURE_NOTE[state.picture] || "");
      if (state.xform !== "none") extra += " " + (XFORM_NOTE[state.xform] || "");
    }
    if ($("tape-note")) $("tape-note").textContent = (TAPE_NOTE[state.tape] || "") + " " + (CELL_NOTE[state.cell] || "") + extra;
    if ($("picture-note")) {
      const pic = PICTURE_NOTE[state.picture] || PICTURE_NOTE.off;
      const xf = pictureOn() && state.xform !== "none" ? " " + (XFORM_NOTE[state.xform] || "") : "";
      $("picture-note").textContent = pic + xf;
    }
    if ($("peek-note")) {
      let peek = state.filledFrame
        ? "Blow-up packs the tape as a filled frame (one solid cell per glyph). The page itself always fits every post."
        : "Blow-up uses the same cell layout at a readable glyph size. The page itself always fits every post.";
      if (state.layer === "peel") {
        peek += " Plates under this blow-up are C1 / C2 / C3. They do not replace it.";
        if (state.onPage === "under") peek += " On page: plates sit under every post in the middle.";
        else if (state.onPage === "over") peek += " On page: plates sit over every post in the middle.";
      } else if (state.layer === "stack") {
        peek += " Stack is an independent average of the cell frame. The merged blow-up stays.";
      } else if (state.layer === "diff") {
        peek += " Diff is current Order vs its sibling as signed gray. The merged blow-up stays.";
      }
      if (state.essay) peek += " essay, not a find.";
      if (state.shuffle && layerOn()) peek += " Shuffled (seed 421).";
      $("peek-note").textContent = peek;
    }
    if ($("layer-caption")) {
      $("layer-caption").textContent = layerOn()
        ? "Independent plates of the packed alphabet. Not a claim that Q wrote quads. Triple-text C2/C3 are LOOP walk and stamp bits unless the peek is the TEXTPIC essay."
        : "";
    }
    if ($("layer-later-note")) {
      if (state.layer === "stack") {
        $("layer-later-note").textContent =
          "Stack averages the current cell frame across posts. Shuffle sibling (seed 421) is the control. Independent average, not a find.";
      } else if (state.layer === "diff") {
        $("layer-later-note").textContent =
          "Diff is current Order vs a sibling order as signed gray (128 = equal). Sequential q and timestamp match on this corpus, so the sibling is spoke.";
      } else {
        $("layer-later-note").textContent = "";
      }
    }
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
    if (state.filledFrame) parts.push("fill=1");
    if (state.picture !== "off") parts.push("pic=" + state.picture);
    if (state.xform !== "none") parts.push("xform=" + state.xform);
    if (state.layer !== "off") parts.push("layer=" + state.layer);
    if (state.align !== "tape") parts.push("align=" + state.align);
    if (state.comp !== "solo") parts.push("comp=" + state.comp);
    if (!state.plates.c1) parts.push("p1=0");
    if (!state.plates.c2) parts.push("p2=0");
    if (!state.plates.c3) parts.push("p3=0");
    if (state.mute.sq0) parts.push("m0=1");
    if (state.mute.sq1) parts.push("m1=1");
    if (state.mute.bar0) parts.push("m2=1");
    if (state.mute.bar1) parts.push("m3=1");
    if (state.stack !== "peek") parts.push("stack=" + state.stack);
    if (state.shuffle) parts.push("shuf=1");
    if (state.essay) parts.push("essay=1");
    if (state.onPage !== "off") parts.push("onpage=" + state.onPage);
    if ((state.mix | 0) !== MIX_DEFAULT) parts.push("mix=" + (state.mix | 0));
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
    state.filledFrame = map.fill === "1";
    if (map.pic && P.PICTURE.indexOf(map.pic) >= 0) state.picture = map.pic;
    if (map.xform && P.XFORM.indexOf(map.xform) >= 0) state.xform = map.xform;
    state.layer = map.layer && LAYER_IDS.indexOf(map.layer) >= 0 ? map.layer : "off";
    state.align = map.align && ALIGN_IDS.indexOf(map.align) >= 0 ? map.align : "tape";
    state.comp = map.comp && COMP_IDS.indexOf(map.comp) >= 0 ? map.comp : "solo";
    state.plates.c1 = map.p1 !== "0";
    state.plates.c2 = map.p2 !== "0";
    state.plates.c3 = map.p3 !== "0";
    state.mute.sq0 = map.m0 === "1";
    state.mute.sq1 = map.m1 === "1";
    state.mute.bar0 = map.m2 === "1";
    state.mute.bar1 = map.m3 === "1";
    state.stack = map.stack === "corpus" ? "corpus" : "peek";
    state.shuffle = map.shuf === "1";
    state.essay = map.essay === "1";
    state.onPage = map.onpage && ONPAGE_IDS.indexOf(map.onpage) >= 0 ? map.onpage : "off";
    if (map.mix != null && map.mix !== "") {
      const m = Number(map.mix);
      state.mix = isFinite(m) ? Math.max(0, Math.min(100, m | 0)) : MIX_DEFAULT;
    } else {
      state.mix = MIX_DEFAULT;
    }
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
    bind("picture", state.picture);
    bind("xform", state.xform);
    bind("layer", state.layer);
    bind("align", state.align);
    bind("comp", state.comp);
    bind("stack", state.stack);
    bind("onpage", state.onPage);
    applyTheme(state.theme);
    applyLayerChrome();
    if ($("plate-p1")) $("plate-p1").checked = !!state.plates.c1;
    if ($("plate-p2")) $("plate-p2").checked = !!state.plates.c2;
    if ($("plate-p3")) $("plate-p3").checked = !!state.plates.c3;
    if ($("mute-sq0")) $("mute-sq0").checked = !!state.mute.sq0;
    if ($("mute-sq1")) $("mute-sq1").checked = !!state.mute.sq1;
    if ($("mute-bar0")) $("mute-bar0").checked = !!state.mute.bar0;
    if ($("mute-bar1")) $("mute-bar1").checked = !!state.mute.bar1;
    if ($("gaps")) $("gaps").checked = state.gaps;
    if ($("labels")) $("labels").checked = state.labels;
    if ($("hide-empty")) $("hide-empty").checked = state.hideEmpty;
    if ($("hide-solid")) $("hide-solid").checked = state.hideSolid;
    if ($("filled-frame")) $("filled-frame").checked = state.filledFrame;
    if ($("mix")) $("mix").value = String(state.mix | 0);
    if ($("mix-readout")) $("mix-readout").textContent = String(state.mix | 0);
    if ($("qnum")) $("qnum").value = String(state.selected);
    syncShuffleBtn();
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
      const placed = g ? Math.min(n, g.slots) : n;
      st.textContent = g
        ? `fitted ${placed} rectangles in ${g.cols}×${g.rows}` +
          (pictureOn() ? " (64×74 picture)" : "") +
          (state.hideEmpty ? (g.waste ? ` (hid ${g.waste} empty)` : " (no empty)") : g.waste ? ` (${g.waste} empty)` : "") +
          (solidN ? ` (hid ${solidN} solid)` : "") +
          (n > g.slots ? ` (clipped ${n - g.slots})` : "") +
          (layerOn() ? ` · layer ${state.layer}` : "") +
          (pagePlatesOn() ? ` · on-page ${state.onPage}` : "")
        : "—";
    }
  }

  function selectQ(q, fromClick) {
    if (fromClick) clearEssay();
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
    try {
      const tres = await fetch("data/quads-teaching.json");
      const t = await tres.json();
      state.teaching = t;
      const Q = globalThis.Quads;
      if (Q && t && t.ascii && t.fish && t.cross) {
        const m = Q.encodeTextpic(t.ascii, t.fish.bits, t.cross.bits);
        state.teachingGlyphs = encodeGlyphs(m.glyphs);
      }
    } catch (err) {
      state.teaching = null;
      state.teachingGlyphs = null;
    }
    applyLayerChrome();
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
    sel("picture", "picture", false);
    sel("xform", "xform", false);
    sel("cell", "cell", false);
    sel("tape", "tape", true);
    sel("chips", "chips", true);
    if ($("tape")) {
      $("tape").addEventListener("change", () => {
        if (clearEssay()) {
          applyLayerChrome();
          renderInspector();
          writeHash();
        }
      });
    }
    if ($("cell")) {
      $("cell").addEventListener("change", () => {
        if (clearEssay()) {
          applyLayerChrome();
          renderInspector();
          writeHash();
        }
      });
    }
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
    if ($("filled-frame")) {
      $("filled-frame").addEventListener("change", () => {
        state.filledFrame = $("filled-frame").checked;
        setNotes();
        relayout({ tapes: false, order: false });
      });
    }
    if ($("layer")) {
      $("layer").addEventListener("change", () => {
        const v = $("layer").value;
        state.layer = LAYER_IDS.indexOf(v) >= 0 ? v : "off";
        if (state.layer === "off") clearEssay();
        applyLayerChrome();
        setNotes();
        state.dirty = true;
        draw();
        renderInspector();
        writeHash();
      });
    }
    if ($("align")) {
      $("align").addEventListener("change", () => {
        const v = $("align").value;
        state.align = ALIGN_IDS.indexOf(v) >= 0 ? v : "tape";
        if (state.tape === "chip") state.align = "tape";
        applyLayerChrome();
        setNotes();
        if (pagePlatesOn()) {
          state.dirty = true;
          draw();
        }
        renderInspector();
        writeHash();
      });
    }
    if ($("comp")) {
      $("comp").addEventListener("change", () => {
        const v = $("comp").value;
        state.comp = COMP_IDS.indexOf(v) >= 0 ? v : "solo";
        if (pagePlatesOn()) {
          state.dirty = true;
          draw();
        }
        renderInspector();
        writeHash();
      });
    }
    if ($("onpage")) {
      $("onpage").addEventListener("change", () => {
        const v = $("onpage").value;
        state.onPage = ONPAGE_IDS.indexOf(v) >= 0 ? v : "off";
        applyLayerChrome();
        setNotes();
        state.dirty = true;
        draw();
        renderInspector();
        writeHash();
      });
    }
    if ($("mix")) {
      const onMix = () => {
        state.mix = Math.max(0, Math.min(100, Number($("mix").value) | 0));
        if ($("mix-readout")) $("mix-readout").textContent = String(state.mix);
        if (pagePlatesOn()) scheduleMixDraw();
        scheduleMixHash();
      };
      $("mix").addEventListener("input", onMix);
      $("mix").addEventListener("change", onMix);
    }
    if ($("stack")) {
      $("stack").addEventListener("change", () => {
        state.stack = $("stack").value === "corpus" ? "corpus" : "peek";
        setNotes();
        renderInspector();
        writeHash();
      });
    }
    const plateBind = (id, key) => {
      if (!$(id)) return;
      $(id).addEventListener("change", () => {
        state.plates[key] = $(id).checked;
        if (pagePlatesOn()) {
          state.dirty = true;
          draw();
        }
        renderInspector();
        writeHash();
      });
    };
    plateBind("plate-p1", "c1");
    plateBind("plate-p2", "c2");
    plateBind("plate-p3", "c3");
    const muteBind = (id, key) => {
      if (!$(id)) return;
      $(id).addEventListener("change", () => {
        state.mute[key] = $(id).checked;
        state.dirty = true;
        draw();
        renderInspector();
        writeHash();
      });
    };
    muteBind("mute-sq0", "sq0");
    muteBind("mute-sq1", "sq1");
    muteBind("mute-bar0", "bar0");
    muteBind("mute-bar1", "bar1");
    if ($("essay-load")) {
      $("essay-load").addEventListener("click", () => {
        if (!state.teachingGlyphs) return;
        if (state.layer === "off") {
          state.layer = "peel";
          if ($("layer")) $("layer").value = "peel";
        }
        state.essay = true;
        state.align = "stream";
        if ($("align")) $("align").value = "stream";
        applyLayerChrome();
        setNotes();
        renderInspector();
        writeHash();
      });
    }
    if ($("shuffle-sib")) {
      $("shuffle-sib").addEventListener("click", () => {
        state.shuffle = !state.shuffle;
        setNotes();
        if (pagePlatesOn()) {
          state.dirty = true;
          draw();
        }
        renderInspector();
        writeHash();
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

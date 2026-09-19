/* Pure layout helpers for the :8558 four-symbol page. No DOM. */
(function (root) {
  "use strict";

  const CELL = [
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

  const ORDER = [
    "q",
    "ts",
    "date",
    "spoke",
    "hops",
    "time",
    "grid",
    "spoke15",
    "basin",
    "ampm",
    "even",
    "loop",
    "walkseq",
  ];

  const WEAVE = ["raster", "boustrophedon", "spiral", "columns"];

  const TAPE = ["c1-only", "triple-text", "chip", "head8"];

  const CHIPS = ["spoke-hops", "ampm-lock", "even-q", "timehash"];

  function clampInt(n, lo, hi) {
    n = n | 0;
    if (n < lo) return lo;
    if (n > hi) return hi;
    return n;
  }

  function cellSpec(kind, nGlyphs, packed) {
    const n = Math.max(1, nGlyphs | 0);
    const id = CELL.indexOf(kind) >= 0 ? kind : "byte";
    const hide = !!packed;
    if (id === "notebook") return { id: id, cols: 32, rows: Math.max(1, Math.ceil(n / 32)), n: n, packed: hide };
    if (id === "weeks") return { id: id, cols: 7, rows: Math.max(1, Math.ceil(n / 7)), n: n, packed: hide };
    if (id === "fish") {
      const rows = hide ? Math.max(1, Math.ceil(n / 8)) : Math.max(14, Math.ceil(n / 8));
      return { id: id, cols: 8, rows: rows, n: n, packed: hide };
    }
    if (id === "cross") {
      const rows = hide ? Math.max(1, Math.ceil(n / 10)) : Math.max(10, Math.ceil(n / 10));
      return { id: id, cols: 10, rows: rows, n: n, packed: hide };
    }
    if (id === "square" || id === "spiral") {
      const side = Math.max(1, Math.ceil(Math.sqrt(n)));
      if (!hide) return { id: id, cols: side, rows: side, n: n, packed: false };
      let cols = side;
      let rows = Math.max(1, Math.ceil(n / cols));
      let waste = cols * rows - n;
      for (let c = Math.max(1, side - 6); c <= side + 6; c++) {
        const r = Math.max(1, Math.ceil(n / c));
        const w = c * r - n;
        if (w < waste) {
          cols = c;
          rows = r;
          waste = w;
        }
        if (waste === 0) break;
      }
      return { id: id, cols: cols, rows: rows, n: n, packed: true };
    }
    if (id === "column") {
      const cols = 8;
      const rows = Math.max(1, Math.ceil(n / cols));
      return { id: id, cols: cols, rows: rows, n: n, packed: hide };
    }
    return { id: id, cols: 8, rows: Math.max(1, Math.ceil(n / 8)), n: n, packed: hide };
  }

  function spiralCoords(cols, rows) {
    const out = [];
    let top = 0;
    let left = 0;
    let bottom = rows - 1;
    let right = cols - 1;
    while (top <= bottom && left <= right) {
      for (let c = left; c <= right; c++) out.push({ c: c, r: top });
      top += 1;
      for (let r = top; r <= bottom; r++) out.push({ c: right, r: r });
      right -= 1;
      if (top <= bottom) {
        for (let c = right; c >= left; c--) out.push({ c: c, r: bottom });
        bottom -= 1;
      }
      if (left <= right) {
        for (let r = bottom; r >= top; r--) out.push({ c: left, r: r });
        left += 1;
      }
    }
    return out;
  }

  function cellXY(i, spec) {
    const n = Math.max(0, i | 0);
    const cols = Math.max(1, spec.cols | 0);
    const rows = Math.max(1, spec.rows | 0);
    const id = spec.id || "byte";
    if (id === "column") {
      return { c: Math.floor(n / rows) % cols, r: n % rows };
    }
    if (id === "boustrophedon") {
      const r = Math.floor(n / cols) % rows;
      const raw = n % cols;
      return { c: r % 2 ? cols - 1 - raw : raw, r: r };
    }
    if (id === "spiral") {
      const coords = spec._spiral || (spec._spiral = spiralCoords(cols, rows));
      return coords[n % coords.length] || { c: 0, r: 0 };
    }
    return { c: n % cols, r: Math.floor(n / cols) % rows };
  }

  function fitGrid(n, width, height, packed) {
    const count = Math.max(1, n | 0);
    const W = Math.max(8, width || 1);
    const H = Math.max(8, height || 1);
    const aspect = W / H;
    let cols;
    let rows;
    if (packed) {
      const c0 = Math.max(1, Math.round(Math.sqrt(count * aspect)));
      const lo = Math.max(1, Math.floor(c0 * 0.45));
      const hi = Math.max(lo, Math.ceil(c0 * 2.2));
      let best = null;
      for (let c = lo; c <= hi; c++) {
        const r = Math.max(1, Math.ceil(count / c));
        const waste = c * r - count;
        const err = Math.abs(c / r - aspect);
        const score = waste * 40 + err * 12;
        if (!best || score < best.score || (score === best.score && waste < best.waste)) {
          best = { cols: c, rows: r, waste: waste, score: score };
        }
      }
      cols = best.cols;
      rows = best.rows;
    } else {
      cols = Math.max(1, Math.ceil(Math.sqrt(count * aspect)));
      rows = Math.max(1, Math.ceil(count / cols));
      while (cols > 1 && (cols - 1) * Math.ceil(count / (cols - 1)) >= count) {
        const nextCols = cols - 1;
        const nextRows = Math.ceil(count / nextCols);
        const curWaste = cols * rows - count;
        const nextWaste = nextCols * nextRows - count;
        const curErr = Math.abs(cols / rows - aspect);
        const nextErr = Math.abs(nextCols / nextRows - aspect);
        if (nextWaste <= curWaste + 2 && nextErr <= curErr + 0.08) {
          cols = nextCols;
          rows = nextRows;
        } else break;
      }
    }
    while (cols * rows < count) {
      if (cols / rows < aspect) cols += 1;
      else rows += 1;
    }
    return {
      cols: cols,
      rows: rows,
      cellW: W / cols,
      cellH: H / rows,
      slots: cols * rows,
      n: count,
      packed: !!packed,
      waste: cols * rows - count,
    };
  }

  function cellRect(col, row, grid) {
    const cellW = grid.cellW;
    const cellH = grid.cellH;
    const x0 = col * cellW;
    const y0 = row * cellH;
    if (!grid.packed) return { x: x0, y: y0, w: cellW, h: cellH };
    const rem = grid.n % grid.cols;
    if (!rem) return { x: x0, y: y0, w: cellW, h: cellH };
    const weave = grid.weave || "raster";
    if (weave === "columns") {
      const lastCol = Math.floor((grid.n - 1) / grid.rows);
      const nLast = grid.n - lastCol * grid.rows;
      if (col === lastCol && nLast < grid.rows) {
        const h = (cellH * grid.rows) / nLast;
        return { x: col * cellW, y: row * h, w: cellW, h: h };
      }
      return { x: x0, y: y0, w: cellW, h: cellH };
    }
    if (weave === "spiral" || row !== grid.rows - 1) return { x: x0, y: y0, w: cellW, h: cellH };
    const nLast = rem;
    const w = (cellW * grid.cols) / nLast;
    if (weave === "boustrophedon" && (grid.rows - 1) % 2) {
      const start = grid.cols - nLast;
      if (col < start) return { x: x0, y: y0, w: cellW, h: cellH };
      return { x: (col - start) * w, y: y0, w: w, h: cellH };
    }
    if (col >= nLast) return { x: x0, y: y0, w: cellW, h: cellH };
    return { x: col * w, y: y0, w: w, h: cellH };
  }

  function hitPos(x, y, grid) {
    if (!grid) return null;
    const weave = grid.weave || "raster";
    const rem = grid.n % grid.cols;
    if (grid.packed && rem && weave === "columns") {
      const col = Math.floor(x / grid.cellW);
      if (col < 0 || col >= grid.cols) return null;
      const lastCol = Math.floor((grid.n - 1) / grid.rows);
      const nLast = grid.n - lastCol * grid.rows;
      const rowH = col === lastCol && nLast < grid.rows ? (grid.cellH * grid.rows) / nLast : grid.cellH;
      const row = Math.floor(y / rowH);
      if (row < 0 || row >= grid.rows) return null;
      return { col: col, row: row };
    }
    const row = Math.floor(y / grid.cellH);
    if (row < 0 || row >= grid.rows) return null;
    if (grid.packed && rem && row === grid.rows - 1 && weave !== "spiral") {
      const nLast = rem;
      const w = (grid.cellW * grid.cols) / nLast;
      let col = Math.floor(x / w);
      if (weave === "boustrophedon" && (grid.rows - 1) % 2) col += grid.cols - nLast;
      if (col < 0 || col >= grid.cols) return null;
      return { col: col, row: row };
    }
    const col = Math.floor(x / grid.cellW);
    if (col < 0 || col >= grid.cols) return null;
    return { col: col, row: row };
  }

  function slotPos(i, grid, weave) {
    const cols = grid.cols;
    const rows = grid.rows;
    const n = Math.max(0, i | 0);
    const id = WEAVE.indexOf(weave) >= 0 ? weave : "raster";
    if (id === "columns") {
      return { col: Math.floor(n / rows) % cols, row: n % rows };
    }
    if (id === "boustrophedon") {
      const row = Math.floor(n / cols) % rows;
      const raw = n % cols;
      return { col: row % 2 ? cols - 1 - raw : raw, row: row };
    }
    if (id === "spiral") {
      if (!grid._spiral || grid._spiralCols !== cols || grid._spiralRows !== rows) {
        grid._spiral = spiralCoords(cols, rows);
        grid._spiralCols = cols;
        grid._spiralRows = rows;
      }
      const skip = grid.packed ? Math.max(0, grid._spiral.length - (grid.n | 0)) : 0;
      const p = grid._spiral[skip + n];
      return p ? { col: p.c, row: p.r } : { col: 0, row: 0 };
    }
    return { col: n % cols, row: Math.floor(n / cols) % rows };
  }

  function cmpNum(a, b) {
    return (a | 0) - (b | 0);
  }

  function dateKey(iso) {
    const s = String(iso || "");
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return 0;
    return Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]);
  }

  const PICTURE = [
    "off",
    "frame",
    "morton",
    "hilbert",
    "bitrev",
    "zigzag",
    "interlace",
    "blocks8",
    "mod37",
    "nipkow",
    "shuffle",
  ];

  const XFORM = ["none", "fliph", "flipv", "rot90", "rot180", "rot270", "transp"];

  const FRAME_COLS = 64;
  const FRAME_ROWS = 74;
  const SHUFFLE_SEED = 421;

  function lockedGrid(cols, rows, n, width, height) {
    const c = Math.max(1, cols | 0);
    const r = Math.max(1, rows | 0);
    const count = Math.max(1, n | 0);
    const W = Math.max(8, width || 1);
    const H = Math.max(8, height || 1);
    return {
      cols: c,
      rows: r,
      cellW: W / c,
      cellH: H / r,
      slots: c * r,
      n: count,
      packed: false,
      waste: Math.max(0, c * r - count),
      locked: true,
    };
  }

  function xformSwaps(xform) {
    return xform === "transp" || xform === "rot90" || xform === "rot270";
  }

  function xformSize(xform) {
    if (xformSwaps(xform)) return { cols: FRAME_ROWS, rows: FRAME_COLS };
    return { cols: FRAME_COLS, rows: FRAME_ROWS };
  }

  function applyXform(c, r, cols, rows, xform) {
    const id = XFORM.indexOf(xform) >= 0 ? xform : "none";
    if (id === "fliph") return { col: cols - 1 - c, row: r };
    if (id === "flipv") return { col: c, row: rows - 1 - r };
    if (id === "rot180") return { col: cols - 1 - c, row: rows - 1 - r };
    if (id === "rot90") return { col: rows - 1 - r, row: c };
    if (id === "rot270") return { col: r, row: cols - 1 - c };
    if (id === "transp") return { col: r, row: c };
    return { col: c, row: r };
  }

  function part1by1(n) {
    n &= 0xffff;
    n = (n | (n << 8)) & 0x00ff00ff;
    n = (n | (n << 4)) & 0x0f0f0f0f;
    n = (n | (n << 2)) & 0x33333333;
    n = (n | (n << 1)) & 0x55555555;
    return n;
  }

  function mortonEncode(x, y) {
    return (part1by1(y) << 1) | part1by1(x);
  }

  function mortonOrder(cols, rows) {
    const cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cells.push({ c: c, r: r, m: mortonEncode(c, r) });
      }
    }
    cells.sort(function (a, b) {
      return a.m - b.m || a.r - b.r || a.c - b.c;
    });
    return cells.map(function (p) {
      return { c: p.c, r: p.r };
    });
  }

  function hilbertRot(n, x, y, rx, ry) {
    if (ry === 0) {
      if (rx === 1) {
        x = n - 1 - x;
        y = n - 1 - y;
      }
      const t = x;
      x = y;
      y = t;
    }
    return { x: x, y: y };
  }

  function hilbertD2xy(n, d) {
    let x = 0;
    let y = 0;
    let t = d >>> 0;
    for (let s = 1; s < n; s *= 2) {
      const rx = 1 & (t >>> 1);
      const ry = 1 & (t ^ rx);
      const rot = hilbertRot(s, x, y, rx, ry);
      x = rot.x + s * rx;
      y = rot.y + s * ry;
      t >>>= 2;
    }
    return { c: x, r: y };
  }

  function hilbertOrder(cols, rows) {
    let n = 1;
    while (n < cols || n < rows) n *= 2;
    const out = [];
    const total = n * n;
    for (let d = 0; d < total; d++) {
      const p = hilbertD2xy(n, d);
      if (p.c >= 0 && p.c < cols && p.r >= 0 && p.r < rows) out.push(p);
    }
    return out;
  }

  function reverseBits(v, bits) {
    let r = 0;
    let x = v >>> 0;
    for (let i = 0; i < bits; i++) {
      r = (r << 1) | (x & 1);
      x >>>= 1;
    }
    return r >>> 0;
  }

  function bitrevOrder(cols, rows) {
    const slots = cols * rows;
    let bits = 1;
    while (1 << bits < slots) bits += 1;
    const n = 1 << bits;
    const out = [];
    for (let i = 0; i < n; i++) {
      const rev = reverseBits(i, bits);
      if (rev < slots) out.push({ c: rev % cols, r: Math.floor(rev / cols) });
    }
    return out;
  }

  function zigzagOrder(cols, rows) {
    const out = [];
    const max = cols + rows - 2;
    for (let s = 0; s <= max; s++) {
      if (s % 2 === 0) {
        for (let r = 0; r <= s; r++) {
          const c = s - r;
          if (c >= 0 && c < cols && r < rows) out.push({ c: c, r: r });
        }
      } else {
        for (let c = 0; c <= s; c++) {
          const r = s - c;
          if (c < cols && r >= 0 && r < rows) out.push({ c: c, r: r });
        }
      }
    }
    return out;
  }

  function interlaceOrder(cols, rows) {
    const out = [];
    for (let r = 0; r < rows; r += 2) {
      for (let c = 0; c < cols; c++) out.push({ c: c, r: r });
    }
    for (let r = 1; r < rows; r += 2) {
      for (let c = 0; c < cols; c++) out.push({ c: c, r: r });
    }
    return out;
  }

  function blocks8Order(cols, rows) {
    const out = [];
    const bw = 8;
    const bh = 8;
    const fullH = Math.floor(rows / bh) * bh;
    for (let br = 0; br < fullH; br += bh) {
      for (let bc = 0; bc < cols; bc += bw) {
        for (let y = 0; y < bh; y++) {
          for (let x = 0; x < bw; x++) {
            const c = bc + x;
            const r = br + y;
            if (c < cols && r < rows) out.push({ c: c, r: r });
          }
        }
      }
    }
    for (let r = fullH; r < rows; r++) {
      for (let c = 0; c < cols; c++) out.push({ c: c, r: r });
    }
    return out;
  }

  function modInterlace(cols, rows, step) {
    const slots = cols * rows;
    const stride = Math.max(1, step | 0);
    const out = [];
    for (let start = 0; start < stride; start++) {
      for (let x = start; x < slots; x += stride) {
        out.push({ c: x % cols, r: Math.floor(x / cols) });
      }
    }
    return out;
  }

  function nipkowOrder(cols, rows) {
    const cx = (cols - 1) / 2;
    const cy = (rows - 1) / 2;
    const cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const dx = c - cx;
        const dy = r - cy;
        cells.push({ c: c, r: r, ang: Math.atan2(dy, dx), rad: dx * dx + dy * dy });
      }
    }
    cells.sort(function (a, b) {
      const da = a.ang - b.ang;
      if (da) return da;
      const dr = a.rad - b.rad;
      if (dr) return dr;
      return a.r - b.r || a.c - b.c;
    });
    return cells.map(function (p) {
      return { c: p.c, r: p.r };
    });
  }

  function lcg32(seed) {
    let s = (seed >>> 0) || 1;
    return function () {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function shuffleOrder(cols, rows, seed) {
    const slots = cols * rows;
    const idx = new Array(slots);
    for (let i = 0; i < slots; i++) idx[i] = i;
    const rng = lcg32(seed == null ? SHUFFLE_SEED : seed);
    for (let i = slots - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = idx[i];
      idx[i] = idx[j];
      idx[j] = t;
    }
    return idx.map(function (i) {
      return { c: i % cols, r: Math.floor(i / cols) };
    });
  }

  function rasterOrder(cols, rows) {
    const out = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) out.push({ c: c, r: r });
    }
    return out;
  }

  function pictureOrder(kind, cols, rows) {
    const c = Math.max(1, cols | 0);
    const r = Math.max(1, rows | 0);
    const id = PICTURE.indexOf(kind) >= 0 ? kind : "off";
    if (id === "morton") return mortonOrder(c, r);
    if (id === "hilbert") return hilbertOrder(c, r);
    if (id === "bitrev") return bitrevOrder(c, r);
    if (id === "zigzag") return zigzagOrder(c, r);
    if (id === "interlace") return interlaceOrder(c, r);
    if (id === "blocks8") return blocks8Order(c, r);
    if (id === "mod37") return modInterlace(c, r, 37);
    if (id === "nipkow") return nipkowOrder(c, r);
    if (id === "shuffle") return shuffleOrder(c, r, SHUFFLE_SEED);
    return rasterOrder(c, r);
  }

  function pictureSlot(i, grid, kind, weave, xform) {
    const n = Math.max(0, i | 0);
    const id = PICTURE.indexOf(kind) >= 0 ? kind : "off";
    if (id === "off") return slotPos(n, grid, weave);
    const srcCols = FRAME_COLS;
    const srcRows = FRAME_ROWS;
    let pos;
    if (id === "frame") {
      const src = {
        cols: srcCols,
        rows: srcRows,
        n: grid.n,
        packed: grid.packed,
        weave: weave,
      };
      pos = slotPos(n, src, weave);
    } else {
      if (!grid._pic || grid._picKind !== id || grid._picCols !== srcCols || grid._picRows !== srcRows) {
        grid._pic = pictureOrder(id, srcCols, srcRows);
        grid._picKind = id;
        grid._picCols = srcCols;
        grid._picRows = srcRows;
      }
      const p = grid._pic[n];
      pos = p ? { col: p.c, row: p.r } : { col: 0, row: 0 };
    }
    return applyXform(pos.col, pos.row, srcCols, srcRows, xform);
  }

  function sortPosts(posts, order, helpers) {
    const id = ORDER.indexOf(order) >= 0 ? order : "q";
    const list = (posts || []).slice();
    const firstLock = helpers && helpers.firstLock ? helpers.firstLock : function () { return 421; };
    const walk = helpers && helpers.walk ? helpers.walk : function (q) { return [q]; };

    if (id === "walkseq") {
      const seen = new Set();
      const out = [];
      const byQ = new Map();
      for (let i = 0; i < list.length; i++) byQ.set(list[i].q, list[i]);
      const maxQ = list.length;
      for (let q = 1; q <= maxQ; q++) {
        const path = walk(q);
        for (let i = 0; i < path.length; i++) {
          const n = path[i];
          if (seen.has(n)) continue;
          seen.add(n);
          const p = byQ.get(n);
          if (p) out.push(p);
        }
      }
      for (let i = 0; i < list.length; i++) {
        if (!seen.has(list[i].q)) out.push(list[i]);
      }
      return out;
    }

    list.sort(function (a, b) {
      if (id === "ts") {
        const d = (a.ts | 0) - (b.ts | 0);
        return d || cmpNum(a.q, b.q);
      }
      if (id === "date") {
        const d = dateKey(a.date) - dateKey(b.date);
        return d || cmpNum(a.q, b.q);
      }
      if (id === "spoke") {
        const d = cmpNum(a.spoke, b.spoke);
        return d || cmpNum(a.q, b.q);
      }
      if (id === "hops" || id === "loop") {
        const d = cmpNum(a.hops, b.hops);
        return d || cmpNum(a.q, b.q);
      }
      if (id === "time") {
        const d = cmpNum(a.hh, b.hh) || cmpNum(a.mm, b.mm) || cmpNum(a.ss, b.ss);
        return d || cmpNum(a.q, b.q);
      }
      if (id === "grid") {
        const da = dateKey(a.date);
        const db = dateKey(b.date);
        const d = (da % 100) * 60 + (a.mm | 0) - ((db % 100) * 60 + (b.mm | 0));
        return d || cmpNum(a.q, b.q);
      }
      if (id === "spoke15") {
        const da = (a.spoke | 0) === 15 ? 0 : 1;
        const db = (b.spoke | 0) === 15 ? 0 : 1;
        return da - db || cmpNum(a.spoke, b.spoke) || cmpNum(a.q, b.q);
      }
      if (id === "basin") {
        const da = firstLock(a.q) === 1222 ? 1 : 0;
        const db = firstLock(b.q) === 1222 ? 1 : 0;
        return da - db || cmpNum(a.hops, b.hops) || cmpNum(a.q, b.q);
      }
      if (id === "ampm") {
        const da = (a.hh | 0) >= 12 ? 1 : 0;
        const db = (b.hh | 0) >= 12 ? 1 : 0;
        return da - db || cmpNum(a.hh, b.hh) || cmpNum(a.q, b.q);
      }
      if (id === "even") {
        const da = (a.q | 0) % 2;
        const db = (b.q | 0) % 2;
        return da - db || cmpNum(a.q, b.q);
      }
      return cmpNum(a.q, b.q);
    });
    return list;
  }

  root.QuadPage = {
    CELL: CELL,
    ORDER: ORDER,
    WEAVE: WEAVE,
    TAPE: TAPE,
    CHIPS: CHIPS,
    PICTURE: PICTURE,
    XFORM: XFORM,
    FRAME_COLS: FRAME_COLS,
    FRAME_ROWS: FRAME_ROWS,
    SHUFFLE_SEED: SHUFFLE_SEED,
    clampInt: clampInt,
    cellSpec: cellSpec,
    cellXY: cellXY,
    spiralCoords: spiralCoords,
    fitGrid: fitGrid,
    lockedGrid: lockedGrid,
    cellRect: cellRect,
    hitPos: hitPos,
    slotPos: slotPos,
    pictureOrder: pictureOrder,
    pictureSlot: pictureSlot,
    applyXform: applyXform,
    xformSize: xformSize,
    xformSwaps: xformSwaps,
    sortPosts: sortPosts,
    dateKey: dateKey,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);

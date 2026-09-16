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
    clampInt: clampInt,
    cellSpec: cellSpec,
    cellXY: cellXY,
    spiralCoords: spiralCoords,
    fitGrid: fitGrid,
    cellRect: cellRect,
    hitPos: hitPos,
    slotPos: slotPos,
    sortPosts: sortPosts,
    dateKey: dateKey,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);

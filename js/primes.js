/* Prime / composite / Sophie Germain puzzle engine for :8558. No DOM. */
(function (root) {
  "use strict";

  const N = 4966;
  const LIMIT = 16 * N + 32;
  const CHAIN_HEADS = [89, 2, 509, 41, 1031, 1229];
  const CARD = [
    [0, 1],
    [1, 0],
    [0, -1],
    [-1, 0],
  ];

  const sieve = new Uint8Array(LIMIT + 1);
  sieve.fill(1);
  sieve[0] = 0;
  sieve[1] = 0;
  for (let i = 2; i * i <= LIMIT; i++) {
    if (!sieve[i]) continue;
    for (let j = i * i; j <= LIMIT; j += i) sieve[j] = 0;
  }

  const primes = [];
  const composites = [];
  const primeIdx = new Int32Array(N + 1);
  const compIdx = new Int32Array(N + 1);
  for (let i = 2; i <= N; i++) {
    if (sieve[i]) {
      primes.push(i);
      primeIdx[i] = primes.length;
    } else {
      composites.push(i);
      compIdx[i] = composites.length;
    }
  }

  const sophie = [];
  const safe = [];
  const sophieIdx = new Int32Array(N + 1);
  for (let i = 0; i < primes.length; i++) {
    const p = primes[i];
    if (sieve[2 * p + 1]) {
      sophie.push(p);
      sophieIdx[p] = sophie.length;
    }
    if (p > 2 && sieve[(p - 1) >> 1]) safe.push(p);
  }

  function isPrime(n) {
    n = n | 0;
    if (n < 2 || n > LIMIT) return false;
    return !!sieve[n];
  }

  function isComposite(n) {
    n = n | 0;
    return n >= 4 && n <= N && !sieve[n];
  }

  function isUnit(n) {
    return (n | 0) === 1;
  }

  function primeIndex(n) {
    n = n | 0;
    if (n < 2 || n > N) return 0;
    return primeIdx[n] | 0;
  }

  function compositeIndex(n) {
    n = n | 0;
    if (n < 4 || n > N) return 0;
    return compIdx[n] | 0;
  }

  function factorize(n) {
    n = n | 0;
    if (n <= 1) return [];
    const out = [];
    let x = n;
    while (x % 2 === 0) {
      out.push(2);
      x = (x / 2) | 0;
    }
    let p = 3;
    while (p * p <= x) {
      while (x % p === 0) {
        out.push(p);
        x = (x / p) | 0;
      }
      p += 2;
    }
    if (x > 1) out.push(x);
    return out;
  }

  function factorPairs(n) {
    n = n | 0;
    if (n < 1) return [];
    const out = [];
    const r = Math.floor(Math.sqrt(n));
    for (let d = 1; d <= r; d++) {
      if (n % d === 0) out.push([d, (n / d) | 0]);
    }
    return out;
  }

  function omega(n) {
    const f = factorize(n);
    let k = 0;
    let last = 0;
    for (let i = 0; i < f.length; i++) {
      if (f[i] !== last) {
        k += 1;
        last = f[i];
      }
    }
    return k;
  }

  function Omega(n) {
    return factorize(n).length;
  }

  function divisorCount(n) {
    n = n | 0;
    if (n < 1) return 0;
    let c = 0;
    const r = Math.floor(Math.sqrt(n));
    for (let d = 1; d <= r; d++) {
      if (n % d === 0) c += d * d === n ? 1 : 2;
    }
    return c;
  }

  function isSophieGermain(n) {
    n = n | 0;
    return n >= 2 && n <= N && !!sieve[n] && !!sieve[2 * n + 1];
  }

  function sophieIndex(n) {
    n = n | 0;
    if (n < 2 || n > N) return 0;
    return sophieIdx[n] | 0;
  }

  function safePartner(n) {
    n = n | 0;
    if (!isSophieGermain(n)) return 0;
    return 2 * n + 1;
  }

  function isSafeprime(n) {
    n = n | 0;
    if (n < 5 || n > N || !sieve[n]) return false;
    const g = (n - 1) >> 1;
    return g >= 2 && !!sieve[g];
  }

  function germainOf(n) {
    if (!isSafeprime(n)) return 0;
    return (n - 1) >> 1;
  }

  function cunningham(n) {
    n = n | 0;
    if (n < 2 || !sieve[n]) return [];
    const chain = [n];
    let cur = n;
    for (;;) {
      const nxt = 2 * cur + 1;
      if (nxt > LIMIT || !sieve[nxt]) break;
      chain.push(nxt);
      cur = nxt;
    }
    return chain;
  }

  function kindOf(n) {
    n = n | 0;
    if (n === 1) return "unit";
    if (n >= 2 && n <= N && sieve[n]) return "prime";
    if (n >= 4 && n <= N) return "composite";
    return "out";
  }

  function kxy(x, y) {
    return x + ":" + y;
  }

  function occupiedHas(occ, x, y) {
    return occ.has(kxy(x, y));
  }

  function placeCell(cells, occ, qBy, q, role, x, y, ghost) {
    if (qBy.has(q) && role !== "ghost") return qBy.get(q);
    const cell = { q: q, role: role, x: x, y: y, rot: 0, flipH: false, ghost: !!ghost };
    cells.push(cell);
    occ.add(kxy(x, y));
    if (!ghost) qBy.set(q, cell);
    return cell;
  }

  function adjacentOccupied(occ, x, y) {
    for (let i = 0; i < 4; i++) {
      const d = CARD[i];
      if (occupiedHas(occ, x + d[0], y + d[1])) return true;
    }
    return false;
  }

  function homeFreeCount(occ) {
    let n = 0;
    for (let i = 0; i < 4; i++) {
      if (!occupiedHas(occ, CARD[i][0], CARD[i][1])) n += 1;
    }
    return n;
  }

  function firstFreeHome(occ, reserveLast) {
    if (reserveLast && homeFreeCount(occ) <= 1) return null;
    for (let i = 0; i < 4; i++) {
      const x = CARD[i][0];
      const y = CARD[i][1];
      if (!occupiedHas(occ, x, y)) return [x, y];
    }
    return null;
  }

  function ringCells(r) {
    const out = [];
    for (let i = 0; i < r; i++) out.push([i, r - i]);
    for (let i = 0; i < r; i++) out.push([r - i, -i]);
    for (let i = 0; i < r; i++) out.push([-i, -r + i]);
    for (let i = 0; i < r; i++) out.push([-r + i, i]);
    return out;
  }

  function firstFreeConnected(occ, skipHome) {
    if (!skipHome) {
      const home = firstFreeHome(occ, false);
      if (home) return home;
    }
    for (let r = 2; r < 48; r++) {
      const ring = ringCells(r);
      for (let i = 0; i < ring.length; i++) {
        const x = ring[i][0];
        const y = ring[i][1];
        if (occupiedHas(occ, x, y)) continue;
        if (adjacentOccupied(occ, x, y)) return [x, y];
      }
    }
    return null;
  }

  function cardinalAway(x, y) {
    if (Math.abs(x) >= Math.abs(y)) {
      if (x !== 0) return [x > 0 ? 1 : -1, 0];
      if (y !== 0) return [0, y > 0 ? 1 : -1];
      return [1, 0];
    }
    return [0, y > 0 ? 1 : -1];
  }

  function firstFreeBeside(occ, x, y, notX, notY, preferDx, preferDy) {
    const dirs = [];
    const prefMan = Math.abs(preferDx) + Math.abs(preferDy);
    if (prefMan === 1) dirs.push([preferDx, preferDy]);
    for (let i = 0; i < 4; i++) {
      const d = CARD[i];
      if (d[0] === preferDx && d[1] === preferDy) continue;
      dirs.push(d);
    }
    for (let i = 0; i < dirs.length; i++) {
      const nx = x + dirs[i][0];
      const ny = y + dirs[i][1];
      if (nx === notX && ny === notY) continue;
      if (!occupiedHas(occ, nx, ny)) return [nx, ny];
    }
    return null;
  }

  function shareEdge(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
  }

  function addJoin(joins, a, b, kind) {
    if (!a || !b) return;
    if (!shareEdge(a, b)) return;
    joins.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, kind: kind });
  }

  function findCellAt(cells, x, y) {
    for (let i = 0; i < cells.length; i++) {
      if (cells[i].x === x && cells[i].y === y) return cells[i];
    }
    return null;
  }

  function bboxOf(cells) {
    let minX = 0;
    let minY = 0;
    let maxX = 0;
    let maxY = 0;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      if (c.x < minX) minX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.x > maxX) maxX = c.x;
      if (c.y > maxY) maxY = c.y;
    }
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }

  function pairIndexOf(pairs, d) {
    for (let i = 0; i < pairs.length; i++) {
      if (pairs[i][0] === d) return i;
    }
    return 0;
  }

  function applyOrient(cells, n, kind, flags, pairs, pi, Om, sgHome, safeHome) {
    if (!flags.orient) return;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      let rot = 0;
      let flipH = false;
      if (c.role === "self") {
        if (kind === "prime") {
          rot = ((pi % 4) + 4) % 4;
          if (sgHome) rot = (rot + 1) % 4;
        } else if (kind === "composite") {
          rot = ((Om % 4) + 4) % 4;
        } else {
          rot = 0;
        }
        if (safeHome) flipH = true;
      } else if (c.role === "unit") {
        rot = 0;
      } else if (c.role === "ordinal") {
        rot = 1;
      } else if (c.role === "pair-small") {
        rot = ((pairIndexOf(pairs, c.q) % 4) + 4) % 4;
      } else if (c.role === "pair-large") {
        const small = n / c.q;
        const si = pairIndexOf(pairs, small);
        rot = (si + 2) % 4;
      } else if (c.role === "sg-partner" || c.role === "chain") {
        rot = 3;
      } else if (c.role === "sg-germain") {
        rot = 1;
      } else if (c.role === "omega") {
        rot = 0;
      } else {
        rot = 0;
      }
      c.rot = rot;
      c.flipH = flipH;
    }
  }

  function attachForwardSg(cells, occ, qBy, joins, home, flags, n) {
    const chain = cunningham(n);
    if (chain.length < 2) return;
    const limit = flags.sg === "chain" ? chain.length : 2;
    let prev = home;
    for (let i = 1; i < limit; i++) {
      const q = chain[i];
      const ghost = q > N;
      if (qBy.has(q) && !ghost) {
        prev = qBy.get(q);
        continue;
      }
      let pos;
      if (i === 1) {
        pos = firstFreeHome(occ, false) || firstFreeConnected(occ);
      } else {
        const dx = prev.x - home.x;
        const dy = prev.y - home.y;
        const pdx = dx === 0 ? 0 : dx > 0 ? 1 : -1;
        const pdy = dy === 0 ? 0 : dy > 0 ? 1 : -1;
        pos = firstFreeBeside(occ, prev.x, prev.y, home.x, home.y, pdx, pdy);
      }
      if (!pos) break;
      const role = ghost ? "ghost" : i === 1 ? "sg-partner" : "chain";
      const cell = placeCell(cells, occ, qBy, q, role, pos[0], pos[1], ghost);
      addJoin(joins, prev, cell, "sg");
      prev = cell;
      if (ghost) break;
    }
  }

  function attachGermain(cells, occ, qBy, joins, home, flags, n) {
    const g = germainOf(n);
    if (!g) return;
    if (qBy.has(g)) {
      addJoin(joins, home, qBy.get(g), "sg");
    } else {
      const pos = firstFreeHome(occ, false) || firstFreeConnected(occ);
      if (pos) {
        const cell = placeCell(cells, occ, qBy, g, "sg-germain", pos[0], pos[1], g > N);
        addJoin(joins, home, cell, "sg");
      }
    }
    if (flags.sg !== "chain") return;
    const chain = cunningham(g);
    let prev = qBy.get(g) || home;
    for (let i = 0; i < chain.length; i++) {
      const q = chain[i];
      if (q === n || q === g) continue;
      if (q > N) {
        const pos = firstFreeBeside(occ, prev.x, prev.y, home.x, home.y, 0, 0);
        if (!pos) break;
        const cell = placeCell(cells, occ, qBy, q, "ghost", pos[0], pos[1], true);
        addJoin(joins, prev, cell, "sg");
        break;
      }
      if (qBy.has(q)) {
        prev = qBy.get(q);
        continue;
      }
      const pos = firstFreeBeside(occ, prev.x, prev.y, home.x, home.y, 0, 0);
      if (!pos) break;
      const cell = placeCell(cells, occ, qBy, q, "chain", pos[0], pos[1], false);
      addJoin(joins, prev, cell, "sg");
      prev = cell;
    }
  }

  function piece(n, flags) {
    n = n | 0;
    flags = flags || {};
    const unit = flags.unit !== false;
    const ordinal = !!flags.ordinal;
    const pairsOn = flags.pairs !== false;
    const omegaOn = !!flags.omega;
    const sg = flags.sg || "off";
    const orient = flags.orient !== false;
    const use = { unit: unit, ordinal: ordinal, pairs: pairsOn, omega: omegaOn, sg: sg, orient: orient };

    const kind = kindOf(n);
    const fac = n > 1 ? factorize(n) : [];
    const pairs = n >= 1 ? factorPairs(n) : [];
    const om = omega(n);
    const Om = Omega(n);
    const pi = primeIndex(n);
    const ci = compositeIndex(n);
    const si = sophieIndex(n);
    const sp = safePartner(n);
    const go = germainOf(n);
    const chain = n >= 2 && sieve[n] ? cunningham(n) : [];

    const cells = [];
    const joins = [];
    const occ = new Set();
    const qBy = new Map();

    if (kind === "out" || n < 1) {
      return {
        n: n,
        kind: "out",
        omega: 0,
        Omega: 0,
        pairs: [],
        factors: [],
        primeIndex: 0,
        compositeIndex: 0,
        sophieIndex: 0,
        safePartner: 0,
        germainOf: 0,
        chain: [],
        cells: [],
        joins: [],
        bbox: { minX: 0, minY: 0, maxX: 0, maxY: 0, w: 1, h: 1 },
      };
    }

    const home = placeCell(cells, occ, qBy, n, "self", 0, 0, false);

    if (kind === "unit") {
      applyOrient(cells, n, kind, use, pairs, pi, Om, false, false);
      return packPiece(n, kind, om, Om, pairs, fac, pi, ci, si, sp, go, chain, cells, joins);
    }

    if (use.unit && n !== 1 && !qBy.has(1)) {
      const u = placeCell(cells, occ, qBy, 1, "unit", -1, 0, false);
      addJoin(joins, u, home, "pair");
    }

    if (use.pairs && kind === "composite") {
      const rest = [];
      for (let i = 0; i < pairs.length; i++) {
        const d = pairs[i][0];
        const big = pairs[i][1];
        if (d < big && d !== 1) rest.push(pairs[i]);
      }
      for (let i = 0; i < rest.length; i++) {
        const d = rest[i][0];
        const big = rest[i][1];
        let smallCell;
        if (qBy.has(d)) {
          smallCell = qBy.get(d);
        } else {
          let pos = firstFreeHome(occ, use.ordinal);
          if (!pos) pos = firstFreeConnected(occ, !!use.ordinal);
          if (!pos) break;
          smallCell = placeCell(cells, occ, qBy, d, "pair-small", pos[0], pos[1], false);
        }
        addJoin(joins, home, smallCell, "pair");
        if (!qBy.has(big)) {
          const away = cardinalAway(smallCell.x, smallCell.y);
          const bpos = firstFreeBeside(occ, smallCell.x, smallCell.y, 0, 0, away[0], away[1]);
          if (bpos) {
            const bigCell = placeCell(cells, occ, qBy, big, "pair-large", bpos[0], bpos[1], false);
            addJoin(joins, smallCell, bigCell, "pair");
          }
        } else {
          addJoin(joins, smallCell, qBy.get(big), "pair");
        }
      }
    }

    if (use.ordinal) {
      const rank = kind === "prime" ? pi : kind === "composite" ? ci : 0;
      if (rank >= 1 && rank !== n && !qBy.has(rank)) {
        let pos = firstFreeHome(occ, false);
        if (!pos) pos = firstFreeConnected(occ);
        if (pos) {
          const oc = placeCell(cells, occ, qBy, rank, "ordinal", pos[0], pos[1], false);
          addJoin(joins, home, oc, "ordinal");
        }
      } else if (rank >= 1 && qBy.has(rank)) {
        addJoin(joins, home, qBy.get(rank), "ordinal");
      }
    }

    if (use.omega && kind === "composite") {
      const seen = new Set();
      for (let i = 0; i < fac.length; i++) {
        const p = fac[i];
        if (seen.has(p)) continue;
        seen.add(p);
        if (qBy.has(p)) continue;
        const pos = firstFreeHome(occ, false) || firstFreeConnected(occ);
        if (!pos) break;
        const oc = placeCell(cells, occ, qBy, p, "omega", pos[0], pos[1], false);
        addJoin(joins, home, oc, "omega");
      }
    }

    const sgHome = isSophieGermain(n);
    const safeHome = isSafeprime(n);
    if (use.sg === "partner" || use.sg === "chain") {
      if (sgHome) attachForwardSg(cells, occ, qBy, joins, home, use, n);
      else if (safeHome) attachGermain(cells, occ, qBy, joins, home, use, n);
    }

    applyOrient(cells, n, kind, use, pairs, pi, Om, sgHome, safeHome);
    return packPiece(n, kind, om, Om, pairs, fac, pi, ci, si, sp, go, chain, cells, joins);
  }

  function packPiece(n, kind, om, Om, pairs, fac, pi, ci, si, sp, go, chain, cells, joins) {
    return {
      n: n,
      kind: kind,
      omega: om,
      Omega: Om,
      pairs: pairs,
      factors: fac,
      primeIndex: pi,
      compositeIndex: ci,
      sophieIndex: si,
      safePartner: sp,
      germainOf: go,
      chain: chain,
      cells: cells,
      joins: joins,
      bbox: bboxOf(cells),
    };
  }

  function packField(homes, flags, opts) {
    opts = opts || {};
    const gutter = opts.gutter | 0;
    const src = homes || [];
    const built = [];
    let area = 0;
    for (let i = 0; i < src.length; i++) {
      const q = src[i] | 0;
      if (q < 1) continue;
      const pc = piece(q, flags);
      if (!pc || !pc.cells || !pc.cells.length) continue;
      const w = pc.bbox.w | 0;
      const h = pc.bbox.h | 0;
      area += w * h;
      built.push(pc);
    }
    const targetW = Math.max(1, Math.ceil(Math.sqrt(area || 1)));
    const sorted = built.slice();
    sorted.sort(function (a, b) {
      const dh = (b.bbox.h | 0) - (a.bbox.h | 0);
      if (dh) return dh;
      const dw = (b.bbox.w | 0) - (a.bbox.w | 0);
      if (dw) return dw;
      return (a.n | 0) - (b.n | 0);
    });
    let cursorX = 0;
    let cursorY = 0;
    let rowH = 0;
    let usedW = 0;
    const placed = [];
    for (let i = 0; i < sorted.length; i++) {
      const pc = sorted[i];
      const w = pc.bbox.w | 0;
      const h = pc.bbox.h | 0;
      if (cursorX > 0 && cursorX + w > targetW) {
        cursorY += rowH + gutter;
        cursorX = 0;
        rowH = 0;
      }
      placed.push({ pc: pc, x: cursorX, y: cursorY });
      cursorX += w + gutter;
      if (cursorX > usedW) usedW = cursorX;
      if (h > rowH) rowH = h;
    }
    const totalW = Math.max(1, usedW);
    const totalH = Math.max(1, cursorY + rowH);
    const cells = [];
    const joins = [];
    for (let i = 0; i < placed.length; i++) {
      const pc = placed[i].pc;
      const ox = placed[i].x - (pc.bbox.minX | 0);
      const oy = placed[i].y - (pc.bbox.minY | 0);
      const home = pc.n | 0;
      const srcCells = pc.cells;
      for (let k = 0; k < srcCells.length; k++) {
        const c = srcCells[k];
        cells.push({
          q: c.q | 0,
          role: c.role,
          x: (c.x | 0) + ox,
          y: (c.y | 0) + oy,
          rot: c.rot | 0,
          flipH: !!c.flipH,
          ghost: !!c.ghost,
          home: home,
        });
      }
      const srcJoins = pc.joins || [];
      for (let k = 0; k < srcJoins.length; k++) {
        const jn = srcJoins[k];
        joins.push({
          ax: (jn.ax | 0) + ox,
          ay: (jn.ay | 0) + oy,
          bx: (jn.bx | 0) + ox,
          by: (jn.by | 0) + oy,
          kind: jn.kind,
          home: home,
        });
      }
    }
    return {
      homes: src.slice(),
      cells: cells,
      joins: joins,
      bbox: {
        minX: 0,
        minY: 0,
        maxX: totalW - 1,
        maxY: totalH - 1,
        w: totalW,
        h: totalH,
      },
      pieces: placed.map(function (p) {
        return {
          q: p.pc.n | 0,
          x: p.x | 0,
          y: p.y | 0,
          w: p.pc.bbox.w | 0,
          h: p.pc.bbox.h | 0,
          kind: p.pc.kind,
        };
      }),
    };
  }

  function factorString(n) {
    const f = factorize(n);
    if (!f.length) return "1";
    const sup = "⁰¹²³⁴⁵⁶⁷⁸⁹";
    const parts = [];
    let i = 0;
    while (i < f.length) {
      const p = f[i];
      let k = 0;
      while (i < f.length && f[i] === p) {
        k += 1;
        i += 1;
      }
      if (k === 1) parts.push(String(p));
      else {
        let exp = "";
        const s = String(k);
        for (let j = 0; j < s.length; j++) exp += sup[s.charCodeAt(j) - 48] || s[j];
        parts.push(String(p) + exp);
      }
    }
    return parts.join(" × ");
  }

  const api = {
    N: N,
    LIMIT: LIMIT,
    CHAIN_HEADS: CHAIN_HEADS.slice(),
    primes: primes,
    composites: composites,
    sophie: sophie,
    safeprimes: safe,
    isPrime: isPrime,
    isComposite: isComposite,
    isUnit: isUnit,
    primeIndex: primeIndex,
    compositeIndex: compositeIndex,
    factorize: factorize,
    factorPairs: factorPairs,
    omega: omega,
    Omega: Omega,
    divisorCount: divisorCount,
    isSophieGermain: isSophieGermain,
    sophieIndex: sophieIndex,
    safePartner: safePartner,
    isSafeprime: isSafeprime,
    germainOf: germainOf,
    cunningham: cunningham,
    kindOf: kindOf,
    piece: piece,
    packField: packField,
    factorString: factorString,
    shareEdge: function (ax, ay, bx, by) {
      return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
    },
  };

  root.QuadPrimes = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

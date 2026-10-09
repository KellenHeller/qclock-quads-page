#!/usr/bin/env python3
"""Freeze prime / composite / Sophie Germain puzzle engine for :8558."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
N = 4966
LIMIT = 16 * N + 32
CHAIN_HEADS = [89, 2, 509, 41, 1031, 1229]
CARD = [(0, 1), (1, 0), (0, -1), (-1, 0)]


def sieve(limit: int) -> list[bool]:
    s = [True] * (limit + 1)
    s[0] = False
    s[1] = False
    i = 2
    while i * i <= limit:
        if s[i]:
            for j in range(i * i, limit + 1, i):
                s[j] = False
        i += 1
    return s


IS_PRIME = sieve(LIMIT)
PRIMES = [i for i in range(2, N + 1) if IS_PRIME[i]]
COMPOSITES = [i for i in range(2, N + 1) if not IS_PRIME[i]]
PRIME_IDX = {p: i + 1 for i, p in enumerate(PRIMES)}
COMP_IDX = {c: i + 1 for i, c in enumerate(COMPOSITES)}
SOPHIE = [p for p in PRIMES if IS_PRIME[2 * p + 1]]
SOPHIE_IDX = {p: i + 1 for i, p in enumerate(SOPHIE)}
SAFE = [p for p in PRIMES if p > 2 and IS_PRIME[(p - 1) // 2]]


def is_prime(n: int) -> bool:
    return 2 <= n <= LIMIT and IS_PRIME[n]


def is_composite(n: int) -> bool:
    return 4 <= n <= N and not IS_PRIME[n]


def is_unit(n: int) -> bool:
    return n == 1


def prime_index(n: int) -> int:
    return PRIME_IDX.get(n, 0)


def composite_index(n: int) -> int:
    return COMP_IDX.get(n, 0)


def factorize(n: int) -> list[int]:
    if n <= 1:
        return []
    out: list[int] = []
    x = n
    while x % 2 == 0:
        out.append(2)
        x //= 2
    p = 3
    while p * p <= x:
        while x % p == 0:
            out.append(p)
            x //= p
        p += 2
    if x > 1:
        out.append(x)
    return out


def factor_pairs(n: int) -> list[tuple[int, int]]:
    if n < 1:
        return []
    out: list[tuple[int, int]] = []
    r = int(n**0.5)
    for d in range(1, r + 1):
        if n % d == 0:
            out.append((d, n // d))
    return out


def omega(n: int) -> int:
    last = 0
    k = 0
    for p in factorize(n):
        if p != last:
            k += 1
            last = p
    return k


def Omega(n: int) -> int:
    return len(factorize(n))


def divisor_count(n: int) -> int:
    if n < 1:
        return 0
    c = 0
    r = int(n**0.5)
    for d in range(1, r + 1):
        if n % d == 0:
            c += 1 if d * d == n else 2
    return c


def is_sophie(n: int) -> bool:
    return 2 <= n <= N and IS_PRIME[n] and IS_PRIME[2 * n + 1]


def sophie_index(n: int) -> int:
    return SOPHIE_IDX.get(n, 0)


def safe_partner(n: int) -> int:
    return 2 * n + 1 if is_sophie(n) else 0


def is_safeprime(n: int) -> bool:
    if n < 5 or n > N or not IS_PRIME[n]:
        return False
    g = (n - 1) // 2
    return g >= 2 and IS_PRIME[g]


def germain_of(n: int) -> int:
    return (n - 1) // 2 if is_safeprime(n) else 0


def cunningham(n: int) -> list[int]:
    if n < 2 or not IS_PRIME[n]:
        return []
    chain = [n]
    cur = n
    while True:
        nxt = 2 * cur + 1
        if nxt > LIMIT or not IS_PRIME[nxt]:
            break
        chain.append(nxt)
        cur = nxt
    return chain


def kind_of(n: int) -> str:
    if n == 1:
        return "unit"
    if 2 <= n <= N and IS_PRIME[n]:
        return "prime"
    if 4 <= n <= N:
        return "composite"
    return "out"


def kxy(x: int, y: int) -> str:
    return f"{x}:{y}"


def ring_cells(r: int) -> list[tuple[int, int]]:
    out: list[tuple[int, int]] = []
    for i in range(r):
        out.append((i, r - i))
    for i in range(r):
        out.append((r - i, -i))
    for i in range(r):
        out.append((-i, -r + i))
    for i in range(r):
        out.append((-r + i, i))
    return out


def first_free_home(occ: set[str], reserve_last: bool) -> tuple[int, int] | None:
    free = [d for d in CARD if kxy(*d) not in occ]
    if reserve_last and len(free) <= 1:
        return None
    return free[0] if free else None


def adjacent_occupied(occ: set[str], x: int, y: int) -> bool:
    return any(kxy(x + dx, y + dy) in occ for dx, dy in CARD)


def first_free_connected(occ: set[str], skip_home: bool = False) -> tuple[int, int] | None:
    if not skip_home:
        home = first_free_home(occ, False)
        if home:
            return home
    for r in range(2, 48):
        for x, y in ring_cells(r):
            if kxy(x, y) in occ:
                continue
            if adjacent_occupied(occ, x, y):
                return (x, y)
    return None


def cardinal_away(x: int, y: int) -> tuple[int, int]:
    if abs(x) >= abs(y):
        if x != 0:
            return (1 if x > 0 else -1, 0)
        if y != 0:
            return (0, 1 if y > 0 else -1)
        return (1, 0)
    return (0, 1 if y > 0 else -1)


def first_free_beside(
    occ: set[str], x: int, y: int, not_x: int, not_y: int, prefer_dx: int, prefer_dy: int
) -> tuple[int, int] | None:
    dirs: list[tuple[int, int]] = []
    if abs(prefer_dx) + abs(prefer_dy) == 1:
        dirs.append((prefer_dx, prefer_dy))
    for d in CARD:
        if d != (prefer_dx, prefer_dy):
            dirs.append(d)
    for dx, dy in dirs:
        nx, ny = x + dx, y + dy
        if nx == not_x and ny == not_y:
            continue
        if kxy(nx, ny) not in occ:
            return (nx, ny)
    return None


def share_edge(a: dict, b: dict) -> bool:
    return abs(a["x"] - b["x"]) + abs(a["y"] - b["y"]) == 1


def add_join(joins: list, a: dict | None, b: dict | None, kind: str) -> None:
    if not a or not b:
        return
    if not share_edge(a, b):
        return
    joins.append({"ax": a["x"], "ay": a["y"], "bx": b["x"], "by": b["y"], "kind": kind})


def bbox_of(cells: list[dict]) -> dict:
    xs = [c["x"] for c in cells] or [0]
    ys = [c["y"] for c in cells] or [0]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    return {"minX": min_x, "minY": min_y, "maxX": max_x, "maxY": max_y, "w": max_x - min_x + 1, "h": max_y - min_y + 1}


def pair_index_of(pairs: list[tuple[int, int]], d: int) -> int:
    for i, pair in enumerate(pairs):
        if pair[0] == d:
            return i
    return 0


def apply_orient(cells, n, kind, flags, pairs, pi, Om, sg_home, safe_home) -> None:
    if not flags["orient"]:
        return
    for c in cells:
        rot = 0
        flip_h = False
        role = c["role"]
        if role == "self":
            if kind == "prime":
                rot = ((pi % 4) + 4) % 4
                if sg_home:
                    rot = (rot + 1) % 4
            elif kind == "composite":
                rot = ((Om % 4) + 4) % 4
            if safe_home:
                flip_h = True
        elif role == "unit":
            rot = 0
        elif role == "ordinal":
            rot = 1
        elif role == "pair-small":
            rot = ((pair_index_of(pairs, c["q"]) % 4) + 4) % 4
        elif role == "pair-large":
            small = n // c["q"]
            si = pair_index_of(pairs, small)
            rot = (si + 2) % 4
        elif role in ("sg-partner", "chain"):
            rot = 3
        elif role == "sg-germain":
            rot = 1
        c["rot"] = rot
        c["flipH"] = flip_h


def piece(n: int, flags: dict | None = None) -> dict:
    flags = flags or {}
    use = {
        "unit": flags.get("unit", True),
        "ordinal": bool(flags.get("ordinal", False)),
        "pairs": flags.get("pairs", True),
        "omega": bool(flags.get("omega", False)),
        "sg": flags.get("sg", "off"),
        "orient": flags.get("orient", True),
    }
    kind = kind_of(n)
    fac = factorize(n) if n > 1 else []
    pairs = factor_pairs(n) if n >= 1 else []
    om = omega(n)
    Om = Omega(n)
    pi = prime_index(n)
    ci = composite_index(n)
    si = sophie_index(n)
    sp = safe_partner(n)
    go = germain_of(n)
    chain = cunningham(n) if n >= 2 and is_prime(n) else []
    empty = {
        "n": n,
        "kind": "out",
        "omega": 0,
        "Omega": 0,
        "pairs": [],
        "factors": [],
        "primeIndex": 0,
        "compositeIndex": 0,
        "sophieIndex": 0,
        "safePartner": 0,
        "germainOf": 0,
        "chain": [],
        "cells": [],
        "joins": [],
        "bbox": {"minX": 0, "minY": 0, "maxX": 0, "maxY": 0, "w": 1, "h": 1},
    }
    if kind == "out" or n < 1:
        return empty

    cells: list[dict] = []
    joins: list[dict] = []
    occ: set[str] = set()
    q_by: dict[int, dict] = {}

    def place(q: int, role: str, x: int, y: int, ghost: bool = False) -> dict:
        if q in q_by and role != "ghost":
            return q_by[q]
        cell = {"q": q, "role": role, "x": x, "y": y, "rot": 0, "flipH": False, "ghost": ghost}
        cells.append(cell)
        occ.add(kxy(x, y))
        if not ghost:
            q_by[q] = cell
        return cell

    home = place(n, "self", 0, 0, False)
    if kind == "unit":
        apply_orient(cells, n, kind, use, pairs, pi, Om, False, False)
        return pack(n, kind, om, Om, pairs, fac, pi, ci, si, sp, go, chain, cells, joins)

    if use["unit"] and n != 1 and 1 not in q_by:
        u = place(1, "unit", -1, 0, False)
        add_join(joins, u, home, "pair")

    if use["pairs"] and kind == "composite":
        rest = [pair for pair in pairs if pair[0] < pair[1] and pair[0] != 1]
        for d, big in rest:
            if d in q_by:
                small_cell = q_by[d]
            else:
                pos = first_free_home(occ, use["ordinal"])
                if not pos:
                    pos = first_free_connected(occ, bool(use["ordinal"]))
                if not pos:
                    break
                small_cell = place(d, "pair-small", pos[0], pos[1], False)
            add_join(joins, home, small_cell, "pair")
            if big not in q_by:
                away = cardinal_away(small_cell["x"], small_cell["y"])
                bpos = first_free_beside(occ, small_cell["x"], small_cell["y"], 0, 0, away[0], away[1])
                if bpos:
                    big_cell = place(big, "pair-large", bpos[0], bpos[1], False)
                    add_join(joins, small_cell, big_cell, "pair")
            else:
                add_join(joins, small_cell, q_by[big], "pair")

    if use["ordinal"]:
        rank = pi if kind == "prime" else ci if kind == "composite" else 0
        if rank >= 1 and rank != n and rank not in q_by:
            pos = first_free_home(occ, False) or first_free_connected(occ, False)
            if pos:
                oc = place(rank, "ordinal", pos[0], pos[1], False)
                add_join(joins, home, oc, "ordinal")
        elif rank >= 1 and rank in q_by:
            add_join(joins, home, q_by[rank], "ordinal")

    if use["omega"] and kind == "composite":
        seen: set[int] = set()
        for p in fac:
            if p in seen:
                continue
            seen.add(p)
            if p in q_by:
                continue
            pos = first_free_home(occ, False) or first_free_connected(occ, False)
            if not pos:
                break
            oc = place(p, "omega", pos[0], pos[1], False)
            add_join(joins, home, oc, "omega")

    sg_home = is_sophie(n)
    safe_home = is_safeprime(n)
    if use["sg"] in ("partner", "chain"):
        if sg_home:
            attach_forward_sg(cells, occ, q_by, joins, home, use, n, place)
        elif safe_home:
            attach_germain(cells, occ, q_by, joins, home, use, n, place)

    apply_orient(cells, n, kind, use, pairs, pi, Om, sg_home, safe_home)
    return pack(n, kind, om, Om, pairs, fac, pi, ci, si, sp, go, chain, cells, joins)


def attach_forward_sg(cells, occ, q_by, joins, home, flags, n, place) -> None:
    chain = cunningham(n)
    if len(chain) < 2:
        return
    limit = len(chain) if flags["sg"] == "chain" else 2
    prev = home
    for i in range(1, limit):
        q = chain[i]
        ghost = q > N
        if q in q_by and not ghost:
            prev = q_by[q]
            continue
        if i == 1:
            pos = first_free_home(occ, False) or first_free_connected(occ, False)
        else:
            dx = prev["x"] - home["x"]
            dy = prev["y"] - home["y"]
            pdx = 0 if dx == 0 else (1 if dx > 0 else -1)
            pdy = 0 if dy == 0 else (1 if dy > 0 else -1)
            pos = first_free_beside(occ, prev["x"], prev["y"], home["x"], home["y"], pdx, pdy)
        if not pos:
            break
        role = "ghost" if ghost else ("sg-partner" if i == 1 else "chain")
        cell = place(q, role, pos[0], pos[1], ghost)
        add_join(joins, prev, cell, "sg")
        prev = cell
        if ghost:
            break


def attach_germain(cells, occ, q_by, joins, home, flags, n, place) -> None:
    g = germain_of(n)
    if not g:
        return
    if g in q_by:
        add_join(joins, home, q_by[g], "sg")
    else:
        pos = first_free_home(occ, False) or first_free_connected(occ, False)
        if pos:
            cell = place(g, "sg-germain", pos[0], pos[1], g > N)
            add_join(joins, home, cell, "sg")
    if flags["sg"] != "chain":
        return
    chain = cunningham(g)
    prev = q_by.get(g) or home
    for q in chain:
        if q in (n, g):
            continue
        if q > N:
            pos = first_free_beside(occ, prev["x"], prev["y"], home["x"], home["y"], 0, 0)
            if not pos:
                break
            cell = place(q, "ghost", pos[0], pos[1], True)
            add_join(joins, prev, cell, "sg")
            break
        if q in q_by:
            prev = q_by[q]
            continue
        pos = first_free_beside(occ, prev["x"], prev["y"], home["x"], home["y"], 0, 0)
        if not pos:
            break
        cell = place(q, "chain", pos[0], pos[1], False)
        add_join(joins, prev, cell, "sg")
        prev = cell


def pack(n, kind, om, Om, pairs, fac, pi, ci, si, sp, go, chain, cells, joins) -> dict:
    return {
        "n": n,
        "kind": kind,
        "omega": om,
        "Omega": Om,
        "pairs": pairs,
        "factors": fac,
        "primeIndex": pi,
        "compositeIndex": ci,
        "sophieIndex": si,
        "safePartner": sp,
        "germainOf": go,
        "chain": chain,
        "cells": cells,
        "joins": joins,
        "bbox": bbox_of(cells),
    }


def factor_string(n: int) -> str:
    f = factorize(n)
    if not f:
        return "1"
    sup = "⁰¹²³⁴⁵⁶⁷⁸⁹"
    parts: list[str] = []
    i = 0
    while i < len(f):
        p = f[i]
        k = 0
        while i < len(f) and f[i] == p:
            k += 1
            i += 1
        if k == 1:
            parts.append(str(p))
        else:
            exp = "".join(sup[int(ch)] if ch.isdigit() else ch for ch in str(k))
            parts.append(f"{p}{exp}")
    return " × ".join(parts)


def cell_xy(pc: dict) -> set[tuple[int, int, int]]:
    return {(c["q"], c["x"], c["y"]) for c in pc["cells"]}


def cell_by_q(pc: dict) -> dict[int, dict]:
    return {c["q"]: c for c in pc["cells"]}


def main() -> int:
    errors: list[str] = []

    def check(cond: bool, msg: str) -> None:
        if not cond:
            errors.append(msg)

    check(1 + len(PRIMES) + len(COMPOSITES) == N, f"census {len(PRIMES)}+{len(COMPOSITES)}")
    check(len(PRIMES) == 663, f"prime count {len(PRIMES)}")
    check(len(COMPOSITES) == 4302, f"composite count {len(COMPOSITES)}")
    check(not is_prime(1) and not is_composite(1) and is_unit(1), "1 is unit")
    check(PRIMES[0] == 2 and PRIMES[-1] == 4957, "prime range")
    check(COMPOSITES[0] == 4 and COMPOSITES[-1] == 4966, "composite range")

    check(prime_index(491) == 94 and PRIMES[93] == 491, "π(491)=94")
    check(composite_index(492) == 397 and COMPOSITES[396] == 492, "rank 492=397")
    check(sum(1 for c in COMPOSITES if c < 492) == 396, "396 composites below 492")
    check(factorize(492) == [2, 2, 3, 41], f"factorize 492 {factorize(492)}")
    check(omega(492) == 3 and Omega(492) == 4, "ω Ω 492")
    check(factor_pairs(492) == [(1, 492), (2, 246), (3, 164), (4, 123), (6, 82), (12, 41)], "pairs 492")
    check((3, 164) in factor_pairs(492), "pair (3,164)")

    check(is_sophie(491) and safe_partner(491) == 983 and sophie_index(491) == 25, "SG 491")
    check(is_sophie(1223) and safe_partner(1223) == 2447, "SG 1223")
    check(not is_sophie(421), "421 not SG")
    check(len(SOPHIE) == 115, f"SG count {len(SOPHIE)}")
    in_corpus = [p for p in SOPHIE if 2 * p + 1 <= N]
    ghosts = [p for p in SOPHIE if 2 * p + 1 > N]
    check(len(in_corpus) == 72, f"in-corpus SG partners {len(in_corpus)}")
    check(len(ghosts) == 43, f"ghost SG {len(ghosts)}")
    check(ghosts[0] == 2543 and 2 * 2543 + 1 == 5087, "first ghost 2543→5087")
    check(SOPHIE[-1] == 4943, f"last SG {SOPHIE[-1]}")
    check(in_corpus[-1] == 2459 and 2 * 2459 + 1 == 4919, "last in-corpus 2459→4919")
    check(len(SAFE) == 72 and SAFE[0] == 5 and SAFE[-1] == 4919, f"safeprimes {len(SAFE)}")

    check(cunningham(2) == [2, 5, 11, 23, 47], f"chain 2 {cunningham(2)}")
    check(cunningham(89)[:6] == [89, 179, 359, 719, 1439, 2879], f"chain 89 {cunningham(89)}")
    check(cunningham(1229) == [1229, 2459, 4919, 9839], f"chain 1229 {cunningham(1229)}")
    check(cunningham(509) == [509, 1019, 2039, 4079], f"chain 509 {cunningham(509)}")
    check(cunningham(41) == [41, 83, 167], f"chain 41 {cunningham(41)}")
    check(cunningham(1031) == [1031, 2063, 4127], f"chain 1031 {cunningham(1031)}")

    check(not is_prime(94) and composite_index(94) == 69, "94 is 69th composite")
    check(is_prime(397) and prime_index(397) == 78, "397 is 78th prime")
    check(prime_index(421) == 82, "π(421)=82")
    check(prime_index(1223) == 200, "π(1223)=200")
    check(composite_index(3414) == 2933, "3414 rank 2933")
    check(prime_index(911) == 156 and is_sophie(911) and safe_partner(911) == 1823, "911 SG")

    check(divisor_count(2520) == 48, f"d(2520)={divisor_count(2520)}")
    eight = {n for n in range(1, N + 1) if divisor_count(n) == 48}
    check(eight == {2520, 3360, 3780, 3960, 4200, 4320, 4620, 4680}, f"d=48 set {sorted(eight)}")
    check(max(omega(n) for n in range(1, N + 1)) == 5, "max ω")
    check(Omega(4096) == 12, "Ω(4096)=12")
    check(max(Omega(n) for n in range(1, N + 1)) == 12, "max Ω")

    p491 = piece(491, {"unit": True, "ordinal": True, "pairs": True, "orient": False})
    check(cell_xy(p491) == {(491, 0, 0), (1, -1, 0), (94, 0, 1)}, f"491 L {cell_xy(p491)}")
    p491p = piece(491, {"unit": True, "ordinal": True, "sg": "partner", "orient": False})
    check(cell_xy(p491p) == {(491, 0, 0), (1, -1, 0), (94, 0, 1), (983, 1, 0)}, f"491 T {cell_xy(p491p)}")
    by = cell_by_q(p491p)
    check(by[491]["role"] == "self" and by[1]["role"] == "unit", "491 roles")
    check(by[94]["role"] == "ordinal" and by[983]["role"] == "sg-partner", "491 attach roles")

    p492 = piece(492, {"unit": True, "pairs": True, "ordinal": True, "orient": False})
    qs = {c["q"] for c in p492["cells"]}
    want = {1, 2, 3, 4, 6, 12, 41, 82, 123, 164, 246, 397, 492}
    check(qs == want, f"492 q-set {sorted(qs)}")
    by492 = cell_by_q(p492)
    for a, b in factor_pairs(492):
        check(share_edge(by492[a], by492[b]), f"pair ({a},{b}) must share an edge")
    check(share_edge(by492[1], by492[492]), "1 shares edge with 492")
    check(share_edge(by492[397], by492[492]), "397 shares edge with 492")

    p1 = piece(1, {})
    check(len(p1["cells"]) == 1 and p1["cells"][0]["q"] == 1 and p1["kind"] == "unit", "unit 1")

    p2 = piece(2, {"unit": True, "ordinal": True, "sg": "chain", "orient": False})
    q2 = {c["q"] for c in p2["cells"]}
    check(1 in q2 and 2 in q2 and {5, 11, 23, 47} <= q2, f"chain 2 cells {sorted(q2)}")
    check(sum(1 for c in p2["cells"] if c["q"] == 1) == 1, "prime 2 does not duplicate ordinal 1")

    p89 = piece(89, {"unit": True, "ordinal": True, "sg": "chain", "orient": False})
    q89 = {c["q"] for c in p89["cells"]}
    check({89, 179, 359, 719, 1439, 2879} <= q89, f"chain 89 {sorted(q89)}")

    p1229 = piece(1229, {"unit": True, "ordinal": True, "sg": "chain", "orient": False})
    q1229 = {c["q"] for c in p1229["cells"]}
    ghosts_q = {c["q"] for c in p1229["cells"] if c["ghost"]}
    check({1229, 2459, 4919} <= q1229, f"1229 chain {sorted(q1229)}")
    check(9839 in ghosts_q, f"1229 ghost {ghosts_q}")

    p2543 = piece(2543, {"unit": True, "ordinal": True, "sg": "partner", "orient": False})
    g2543 = [c for c in p2543["cells"] if c["ghost"]]
    check(len(g2543) == 1 and g2543[0]["q"] == 5087, "2543 ghost 5087")

    p421 = piece(421, {"unit": True, "ordinal": True, "sg": "partner", "orient": False})
    check(all(c["q"] != 843 for c in p421["cells"]), "421 has no partner")
    check({c["q"] for c in p421["cells"]} == {421, 1, prime_index(421)}, "421 L-tromino")

    p983 = piece(983, {"unit": True, "ordinal": True, "sg": "partner", "orient": False})
    q983 = {c["q"] for c in p983["cells"]}
    check(491 in q983, f"safeprime 983 reverse germain {sorted(q983)}")
    check(any(c["role"] == "sg-germain" and c["q"] == 491 for c in p983["cells"]), "983 germain role")

    p5 = piece(5, {"unit": True, "ordinal": True, "sg": "partner", "orient": False})
    q5 = {c["q"] for c in p5["cells"]}
    check(11 in q5 and 2 not in q5, f"5 is SG first: forward 11, no reverse 2 {sorted(q5)}")

    p491o = piece(491, {"unit": True, "ordinal": True, "sg": "partner", "orient": True})
    byo = cell_by_q(p491o)
    check(byo[491]["rot"] == 3, f"491 self rot {byo[491]['rot']} (π≡2 + SG)")
    check(byo[94]["rot"] == 1, "ordinal rot 90")
    check(byo[1]["rot"] == 0, "unit upright")
    check(byo[983]["rot"] == 3, "sg-partner rot 270")

    p492o = piece(492, {"unit": True, "pairs": True, "ordinal": True, "orient": True})
    byo2 = cell_by_q(p492o)
    check(byo2[492]["rot"] == 0, f"492 Ω=4 → rot 0 got {byo2[492]['rot']}")
    check(byo2[2]["rot"] == pair_index_of(factor_pairs(492), 2) % 4, "pair-small 2 rot")
    check(byo2[246]["rot"] == (pair_index_of(factor_pairs(492), 2) + 2) % 4, "pair-large 246 faces 2")

    p3414 = piece(3414, {"unit": True, "pairs": True, "ordinal": True, "orient": False})
    q3414 = {c["q"] for c in p3414["cells"]}
    check({1, 2, 3, 6, 569, 1138, 1707, 3414, 2933} <= q3414, f"3414 family {sorted(q3414)}")

    js = (ROOT / "js" / "primes.js").read_text()
    html = (ROOT / "index.html").read_text()
    check("globalThis" in js and "QuadPrimes" in js, "QuadPrimes export")
    check("CHAIN_HEADS" in js, "chain heads in JS")
    check("function piece" in js, "piece() in JS")

    node = _node_compare()
    if node is not None:
        check(node[0], node[1])

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print("OK")
    print(f"primes {len(PRIMES)} composites {len(COMPOSITES)} SG {len(SOPHIE)} safe {len(SAFE)}")
    return 0


def _node_compare() -> tuple[bool, str] | None:
    try:
        proc = subprocess.run(
            ["node", "-e", NODE_PROBE],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            timeout=20,
        )
    except FileNotFoundError:
        return None
    except subprocess.TimeoutExpired:
        return False, "node probe timed out"
    if proc.returncode != 0:
        return False, f"node probe failed: {proc.stderr.strip() or proc.stdout.strip()}"
    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return False, f"node probe JSON {proc.stdout[:200]}"
    py491 = sorted(cell_xy(piece(491, {"unit": True, "ordinal": True, "sg": "partner", "orient": False})))
    py492 = sorted({c["q"] for c in piece(492, {"unit": True, "pairs": True, "ordinal": True, "orient": False})["cells"]})
    js491 = sorted((tuple(x) for x in data["c491"]))
    js492 = sorted(data["q492"])
    if py491 != list(js491):
        return False, f"JS/Py 491 mismatch py={py491} js={js491}"
    if py492 != js492:
        return False, f"JS/Py 492 mismatch py={py492} js={js492}"
    if data["nPrimes"] != 663 or data["nSG"] != 115:
        return False, f"JS census {data}"
    return True, "node matches"


NODE_PROBE = r"""
const fs = require("fs");
const vm = require("vm");
const ctx = { globalThis: {} };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync("js/primes.js", "utf8"), ctx);
const Q = ctx.QuadPrimes;
const p491 = Q.piece(491, { unit: true, ordinal: true, sg: "partner", orient: false });
const p492 = Q.piece(492, { unit: true, pairs: true, ordinal: true, orient: false });
const out = {
  nPrimes: Q.primes.length,
  nSG: Q.sophie.length,
  c491: p491.cells.map(c => [c.q, c.x, c.y]),
  q492: p492.cells.map(c => c.q),
};
process.stdout.write(JSON.stringify(out));
"""


if __name__ == "__main__":
    sys.exit(main())

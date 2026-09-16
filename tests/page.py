#!/usr/bin/env python3
"""Freeze fit / weave / Drew cell packing for the :8558 four-symbol page."""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORPUS = ROOT / "data" / "corpus.json"


FOLD = {
    0x2018: "'",
    0x2019: "'",
    0x201C: '"',
    0x201D: '"',
    0x2013: "-",
    0x2014: "-",
    0x2015: "-",
    0x2026: "...",
    0x2002: " ",
}
SPACE_BITS = [0, 0, 1, 0, 0, 0, 0, 0]


def ascii_to_bits(s: str) -> list[int]:
    bits: list[int] = []
    i = 0
    while i < len(s):
        cp = ord(s[i])
        if cp > 0xFFFF:
            i += 1
        chunk = FOLD.get(cp)
        if chunk is None:
            chunk = "?" if cp > 255 else chr(cp)
        for ch in chunk:
            b = ord(ch) & 0xFF
            for k in range(7, -1, -1):
                bits.append((b >> k) & 1)
        i += 1
    return bits


def encode_triple_text(post: dict, posts: list[dict]) -> list[int]:
    by_q = {p["q"]: p for p in posts}
    has_q = set(by_q)
    text = str(post.get("text") or "").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"').replace("&#39;", "'").replace("&nbsp;", " ")
    path: list[int] = []
    seen: set[int] = set()
    cur = int(post["q"])
    for _ in range(16):
        path.append(cur)
        if cur in seen:
            break
        seen.add(cur)
        nxt = by_q.get(cur, {}).get("next")
        if nxt is None or nxt not in by_q:
            break
        cur = int(nxt)
    hh, mm = int(post["hh"]), int(post["mm"])
    n = hh * 100 + mm
    n12 = ((hh + 12) % 24) * 100 + mm
    a = str(n) if n in has_q else "—"
    b = str(n12) if n12 in has_q else "—"
    stamp = f"{hh:02d}{mm:02d}→{a}/{b}"
    c1 = ascii_to_bits(text)
    c2 = ascii_to_bits("→".join(str(x) for x in path))
    c3 = ascii_to_bits(stamp)
    while True:
        zeros = sum(1 for x in c1 if not x)
        ones = sum(1 for x in c1 if x)
        if zeros >= len(c2) and ones >= len(c3):
            break
        c1.extend(SPACE_BITS)
    glyphs: list[int] = []
    i2 = i3 = 0
    for bit in c1:
        if bit:
            extra = c3[i3] if i3 < len(c3) else 0
            i3 += 1
            glyphs.append(3 if extra else 2)
        else:
            extra = c2[i2] if i2 < len(c2) else 0
            i2 += 1
            glyphs.append(1 if extra else 0)
    return glyphs


def cell_spec(kind: str, n_glyphs: int, packed: bool = False) -> dict:
    n = max(1, int(n_glyphs))
    hide = bool(packed)
    if kind == "notebook":
        return {"id": kind, "cols": 32, "rows": max(1, math.ceil(n / 32)), "n": n, "packed": hide}
    if kind == "weeks":
        return {"id": kind, "cols": 7, "rows": max(1, math.ceil(n / 7)), "n": n, "packed": hide}
    if kind == "fish":
        rows = max(1, math.ceil(n / 8)) if hide else max(14, math.ceil(n / 8))
        return {"id": kind, "cols": 8, "rows": rows, "n": n, "packed": hide}
    if kind == "cross":
        rows = max(1, math.ceil(n / 10)) if hide else max(10, math.ceil(n / 10))
        return {"id": kind, "cols": 10, "rows": rows, "n": n, "packed": hide}
    if kind in ("square", "spiral"):
        side = max(1, math.ceil(math.sqrt(n)))
        if not hide:
            return {"id": kind, "cols": side, "rows": side, "n": n, "packed": False}
        cols, rows = side, max(1, math.ceil(n / side))
        waste = cols * rows - n
        for c in range(max(1, side - 6), side + 7):
            r = max(1, math.ceil(n / c))
            w = c * r - n
            if w < waste:
                cols, rows, waste = c, r, w
            if waste == 0:
                break
        return {"id": kind, "cols": cols, "rows": rows, "n": n, "packed": True}
    if kind == "column":
        return {"id": kind, "cols": 8, "rows": max(1, math.ceil(n / 8)), "n": n, "packed": hide}
    return {"id": kind, "cols": 8, "rows": max(1, math.ceil(n / 8)), "n": n, "packed": hide}


def spiral_coords(cols: int, rows: int) -> list[tuple[int, int]]:
    out: list[tuple[int, int]] = []
    top, left, bottom, right = 0, 0, rows - 1, cols - 1
    while top <= bottom and left <= right:
        for c in range(left, right + 1):
            out.append((c, top))
        top += 1
        for r in range(top, bottom + 1):
            out.append((right, r))
        right -= 1
        if top <= bottom:
            for c in range(right, left - 1, -1):
                out.append((c, bottom))
            bottom -= 1
        if left <= right:
            for r in range(bottom, top - 1, -1):
                out.append((left, r))
            left += 1
    return out


def cell_xy(i: int, spec: dict) -> tuple[int, int]:
    n = max(0, int(i))
    cols = spec["cols"]
    rows = spec["rows"]
    kind = spec["id"]
    if kind == "column":
        return (n // rows) % cols, n % rows
    if kind == "boustrophedon":
        r = (n // cols) % rows
        raw = n % cols
        return (cols - 1 - raw if r % 2 else raw), r
    if kind == "spiral":
        coords = spec.setdefault("_spiral", spiral_coords(cols, rows))
        return coords[n % len(coords)]
    return n % cols, (n // cols) % rows


def fit_grid(n: int, width: float, height: float, packed: bool = False) -> dict:
    count = max(1, int(n))
    W = max(8, width)
    H = max(8, height)
    aspect = W / H
    if packed:
        c0 = max(1, round(math.sqrt(count * aspect)))
        lo = max(1, math.floor(c0 * 0.45))
        hi = max(lo, math.ceil(c0 * 2.2))
        best = None
        for c in range(lo, hi + 1):
            r = max(1, math.ceil(count / c))
            waste = c * r - count
            err = abs(c / r - aspect)
            score = waste * 40 + err * 12
            if best is None or score < best["score"] or (score == best["score"] and waste < best["waste"]):
                best = {"cols": c, "rows": r, "waste": waste, "score": score}
        cols, rows = best["cols"], best["rows"]
    else:
        cols = max(1, math.ceil(math.sqrt(count * aspect)))
        rows = max(1, math.ceil(count / cols))
        while cols > 1:
            next_cols = cols - 1
            next_rows = math.ceil(count / next_cols)
            cur_waste = cols * rows - count
            next_waste = next_cols * next_rows - count
            cur_err = abs(cols / rows - aspect)
            next_err = abs(next_cols / next_rows - aspect)
            if next_waste <= cur_waste + 2 and next_err <= cur_err + 0.08:
                cols, rows = next_cols, next_rows
            else:
                break
    while cols * rows < count:
        if cols / rows < aspect:
            cols += 1
        else:
            rows += 1
    return {"cols": cols, "rows": rows, "slots": cols * rows, "n": count, "packed": bool(packed), "waste": cols * rows - count}


def slot_pos(i: int, grid: dict, weave: str) -> tuple[int, int]:
    cols, rows = grid["cols"], grid["rows"]
    n = max(0, int(i))
    if weave == "columns":
        return (n // rows) % cols, n % rows
    if weave == "boustrophedon":
        row = (n // cols) % rows
        raw = n % cols
        return (cols - 1 - raw if row % 2 else raw), row
    if weave == "spiral":
        coords = spiral_coords(cols, rows)
        c, r = coords[n]
        return c, r
    return n % cols, (n // cols) % rows


def main() -> int:
    errors: list[str] = []

    def check(cond: bool, msg: str) -> None:
        if not cond:
            errors.append(msg)

    data = json.loads(CORPUS.read_text())
    posts = data["posts"]
    check(len(posts) == 4966, f"n_posts {len(posts)}")
    check(posts[0]["q"] == 1 and posts[-1]["q"] == 4966, "q range")

    spec = cell_spec("byte", 64)
    check(spec["cols"] == 8 and spec["rows"] == 8, f"byte 64 {spec}")
    check(cell_xy(0, spec) == (0, 0), "byte origin")
    check(cell_xy(7, spec) == (7, 0), "byte row0 end")
    check(cell_xy(8, spec) == (0, 1), "byte row1")

    spec = cell_spec("notebook", 32)
    check(spec["cols"] == 32 and spec["rows"] == 1, f"notebook {spec}")

    spec = cell_spec("fish", 8)
    check(spec["cols"] == 8 and spec["rows"] == 14, f"fish pad {spec}")
    spec = cell_spec("cross", 8)
    check(spec["cols"] == 10 and spec["rows"] == 10, f"cross pad {spec}")

    spec = cell_spec("column", 16)
    check(cell_xy(0, spec) == (0, 0) and cell_xy(1, spec) == (0, 1), f"column {cell_xy(1, spec)}")
    check(cell_xy(2, spec) == (1, 0), f"column next {cell_xy(2, spec)}")

    spec = cell_spec("boustrophedon", 16)
    check(cell_xy(8, spec) == (7, 1), f"boustro {cell_xy(8, spec)}")
    check(cell_xy(15, spec) == (0, 1), f"boustro end {cell_xy(15, spec)}")

    spec = cell_spec("weeks", 7)
    check(spec["cols"] == 7 and spec["rows"] == 1, f"weeks {spec}")

    spec = cell_spec("spiral", 9)
    check(spec["cols"] == 3 and spec["rows"] == 3, f"spiral spec {spec}")
    check(cell_xy(0, spec) == (0, 0), "spiral start")
    check(cell_xy(3, spec) == (2, 1), f"spiral 3 {cell_xy(3, spec)}")
    check(cell_xy(8, spec) == (1, 1), f"spiral center {cell_xy(8, spec)}")

    g = fit_grid(4966, 1200, 800)
    check(g["slots"] >= 4966, f"fit slots {g}")
    check(g["cols"] * g["rows"] >= 4966, "fit product")
    occupied = set()
    for i in range(4966):
        occupied.add(slot_pos(i, g, "raster"))
    check(len(occupied) == 4966, f"raster unique {len(occupied)}")

    occupied = set()
    for i in range(4966):
        occupied.add(slot_pos(i, g, "boustrophedon"))
    check(len(occupied) == 4966, f"boustro unique {len(occupied)}")

    occupied = set()
    for i in range(min(4966, g["slots"])):
        occupied.add(slot_pos(i, g, "spiral"))
    check(len(occupied) == 4966, f"spiral unique {len(occupied)}")

    occupied = set()
    for i in range(4966):
        occupied.add(slot_pos(i, g, "columns"))
    check(len(occupied) == 4966, f"columns unique {len(occupied)}")

    qs = [p["q"] for p in posts]
    check(qs == list(range(1, 4967)), "sequential q")

    css = (ROOT / "css" / "page.css").read_text()
    html = (ROOT / "index.html").read_text()
    js = (ROOT / "js" / "page.js").read_text()
    toast_map = [
        ("sq0", "#901131"),
        ("sq1", "#319011"),
        ("bar0", "#113190"),
        ("bar1", "#903111"),
        ("cell", "#901171"),
    ]
    for name, hexv in toast_map:
        check(hexv in css, f"css missing {hexv}")
        check(hexv in js, f"js missing {hexv}")
        check(hexv in html, f"html missing {hexv}")
        check(f"--toast-{name}" in css, f"css var --toast-{name}")
    check('option value="toast"' in html, "toast paint option")
    check('option value="filled"' in html, "filled frame paint option")
    check("function toastInk" in js, "toastInk maps glyph code to hex")
    check("toastOn()" in js and "ebsSpectrum()" in js, "toast is not spectrum walk")
    check("TOAST_INK" in js and "TOAST_CELL" in js, "toast ink + cell")
    check("function filledOn" in js and "function toastInkOn" in js, "filled frame is an EBS paint")
    check("filledOn() || tiny" in js, "filled frame blits packed bitmap")
    check('id="filled-frame"' not in html, "no filled-frame checkbox")
    check('parts.push("fill=1")' not in js, "filled frame is paint=filled, not fill=1")

    spec = cell_spec("fish", 8)
    check(spec["rows"] == 14, f"fish pad {spec}")
    spec = cell_spec("fish", 8, True)
    check(spec["rows"] == 1 and spec["packed"], f"fish packed {spec}")
    spec = cell_spec("cross", 8)
    check(spec["rows"] == 10, f"cross pad {spec}")
    spec = cell_spec("cross", 8, True)
    check(spec["rows"] == 1, f"cross packed {spec}")
    g0 = fit_grid(4966, 1200, 800, False)
    gp = fit_grid(4966, 1200, 800, True)
    check(gp["waste"] <= g0["waste"], f"packed waste {gp['waste']} vs {g0['waste']}")
    check(gp["slots"] >= 4966, "packed slots")
    html = (ROOT / "index.html").read_text()
    js = (ROOT / "js" / "page.js").read_text()
    check('id="hide-empty"' in html, "hide empty checkbox")
    check("hideEmpty" in js and "cellRect" in (ROOT / "js" / "layouts.js").read_text(), "hide empty wiring")
    blank = [p for p in posts if not str(p.get("text") or "").strip()]
    check(len(blank) == 231, f"blank posts {len(blank)}")
    blank_q = {p["q"] for p in blank}
    check(544 in blank_q and 550 in blank_q, "544 and 550 are solid/blank")
    check('id="hide-solid"' in html, "hide solid checkbox")
    check("hideSolid" in js and "isSolidPost" in js, "hide solid wiring")

    p3414 = next(p for p in posts if p["q"] == 3414)
    check(p3414["date"] == "2019-07-11", f"3414 date {p3414['date']}")
    check((p3414["hh"], p3414["mm"], p3414["ss"]) == (0, 25, 45), "3414 stamp")
    check(p3414["spoke"] == 41 and p3414["hops"] == 6 and p3414["next"] == 711, "3414 loop")
    text_3414 = str(p3414.get("text") or "")
    check("Only Anons can fully appreciate" in text_3414, "3414 c1 text")
    check("[Wheels up]" in text_3414, "3414 wheels up")
    glyphs_3414 = encode_triple_text(p3414, posts)
    check(len(glyphs_3414) == 1624, f"3414 glyphs {len(glyphs_3414)}")
    spec_3414 = cell_spec("cross", len(glyphs_3414))
    check(spec_3414["cols"] == 10 and spec_3414["rows"] == 163, f"3414 cell {spec_3414}")
    kinds = {g for g in glyphs_3414}
    check(kinds == {0, 1, 2, 3}, f"3414 four inks {kinds}")
    check(glyphs_3414.count(1) > 0 and glyphs_3414.count(3) > 0, "3414 extra-bit fills")
    check('value="3414"' in html, "default selected 3414")
    check('value="ebs" selected' in html, "default ebs theme")
    check('value="toast" selected' in html, "default toast paint")
    check('["meaning", "spectrum", "toast", "filled"]' in js, "paint ids include filled")
    check('value="cross" selected' in html, "default cross cell")
    check('value="triple-text" selected' in html, "default triple-text tape")
    check('id="hide-empty" type="checkbox" checked' in html, "default hide empty")
    check('id="hide-solid" type="checkbox" checked' in html, "default hide solid")
    check('id="gaps" type="checkbox" checked' not in html, "default gaps off")
    check('selected: 3414' in js and 'cell: "cross"' in js and 'tape: "triple-text"' in js, "js defaults match 3414")
    check('theme: "ebs"' in js and 'ebsPaint: "toast"' in js, "js default ebs toast")
    check("gaps: false" in js and "hideEmpty: true" in js and "hideSolid: true" in js, "js default hide empty/solid, no gaps")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print("OK")
    print(f"fit 1200x800 -> {g['cols']}x{g['rows']} ({g['slots']} slots)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

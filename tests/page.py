#!/usr/bin/env python3
"""Freeze fit / weave / Drew cell packing for the :8558 four-symbol page."""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORPUS = ROOT / "data" / "corpus.json"


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
    check("function toastInk" in js, "toastInk maps glyph code to hex")
    check("toastOn()" in js and "ebsSpectrum()" in js, "toast is not spectrum walk")
    check("TOAST_INK" in js and "TOAST_CELL" in js, "toast ink + cell")

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

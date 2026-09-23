#!/usr/bin/env python3
"""Peel / mute / shuffle math for the :8558 layering block."""
from __future__ import annotations

import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tests"))
from page import CORPUS, SPACE_BITS, ascii_to_bits, encode_triple_text  # noqa: E402

NAMES = ["sq0", "sq1", "bar0", "bar1"]
SEED = 421


def code_of(g) -> int:
    if isinstance(g, int):
        return g & 3
    return {"sq0": 0, "sq1": 1, "bar0": 2, "bar1": 3}.get(g, 0)


def unpack_index(g) -> dict:
    c = code_of(g)
    if c == 0:
        return {"c1": 0, "c2": 0, "c3": None}
    if c == 1:
        return {"c1": 0, "c2": 1, "c3": None}
    if c == 2:
        return {"c1": 1, "c2": None, "c3": 0}
    return {"c1": 1, "c2": None, "c3": 1}


def tape_aligned_plates(glyphs) -> dict:
    c1, c2, c3 = [], [], []
    for g in glyphs:
        u = unpack_index(g)
        c1.append(u["c1"])
        c2.append(u["c2"])
        c3.append(u["c3"])
    return {"c1": c1, "c2": c2, "c3": c3}


def split_aligned(glyphs) -> dict:
    c1, c2, c3 = [], [], []
    for g in glyphs:
        u = unpack_index(g)
        c1.append(u["c1"])
        if u["c1"] == 0:
            c2.append(u["c2"])
        else:
            c3.append(u["c3"])
    return {"c1": c1, "c2": c2, "c3": c3}


def stream_raster(bits, w: int, h: int) -> list[int]:
    n = max(0, int(w) * int(h))
    src = list(bits or [])
    out = []
    for i in range(n):
        if i >= len(src):
            out.append(-1)
        else:
            out.append(1 if src[i] else 0)
    return out


def mute_mask(glyphs, mute_map: dict) -> list[bool]:
    mute_map = mute_map or {}
    vis = []
    for g in glyphs:
        vis.append(not mute_map.get(NAMES[code_of(g)], False))
    return vis


def merge(c1: list[int], c2: list[int], c3: list[int]) -> tuple[list[int], int]:
    c1 = list(c1)
    pad = 0
    while True:
        zeros = sum(1 for x in c1 if not x)
        ones = sum(1 for x in c1 if x)
        if zeros >= len(c2) and ones >= len(c3):
            break
        c1.extend(SPACE_BITS)
        pad += 1
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
    return glyphs, pad


BR_RE = re.compile(r"<br\s*/?>", re.I)
P_RE = re.compile(r"</?(?:p|div)(?:\s[^>]*)?>", re.I)
TAG_RE = re.compile(r"<[^>]+>")
SPACE_NL_RE = re.compile(r"[ \t]+\n")
MULTI_NL_RE = re.compile(r"\n{3,}")
TEACHING_QUOTE = ">>612417\n\n(((Planned Parenthood)))"
TEACHING_QUOTE_RAW = '>>612417\n\n<span class="detected">(((Planned Parenthood)))</span>\n'


def clean_quote_text(raw) -> str:
    import html as html_mod

    s = "" if raw is None else str(raw)
    s = BR_RE.sub("\n", s)
    s = P_RE.sub("\n", s)
    s = TAG_RE.sub("", s)
    s = html_mod.unescape(s)
    s = s.replace("\r\n", "\n").replace("\r", "\n")
    s = SPACE_NL_RE.sub("\n", s)
    s = MULTI_NL_RE.sub("\n\n", s)
    return s.strip("\n")


def merge_clip(c1: list[int], c2: list[int], c3: list[int]) -> list[int]:
    glyphs: list[int] = []
    i2 = i3 = 0
    c2 = list(c2 or [])
    c3 = list(c3 or [])
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


def quote_stamp(hh: int, mm: int, has_q) -> str:
    n = int(hh) * 100 + int(mm)
    n12 = ((int(hh) + 12) % 24) * 100 + int(mm)
    a = str(n) if has_q(n) else "—"
    b = str(n12) if has_q(n12) else "—"
    return f"{int(hh):02d}{int(mm):02d}→{a}/{b}"


def quote_tape(text: str, nested: str = "", stamp: str = "") -> list[int]:
    t = clean_quote_text(text)
    if not t.strip():
        return [0]
    c1 = ascii_to_bits(t)
    c2 = ascii_to_bits(clean_quote_text(nested)) if nested else []
    c3 = ascii_to_bits(stamp) if stamp else []
    if not c2 and not c3:
        glyphs, pad = merge(c1, [], [])
        if pad != 0:
            raise AssertionError(f"quote tape padBytes {pad} (want 0)")
        return glyphs
    return merge_clip(c1, c2, c3)


def bits_to_ascii(bits: list[int]) -> str:
    n = len(bits) - (len(bits) % 8)
    out = []
    for i in range(0, n, 8):
        v = 0
        for k in range(8):
            v = (v << 1) | (bits[i + k] & 1)
        out.append(chr(v))
    return "".join(out)


def shuffle_glyphs(glyphs, seed: int = SEED) -> list:
    out = list(glyphs)
    a = seed & 0xFFFFFFFF

    def imul(x, y):
        prod = (x & 0xFFFFFFFF) * (y & 0xFFFFFFFF)
        prod &= 0xFFFFFFFF
        if prod >= 0x80000000:
            prod -= 0x100000000
        return prod

    def rnd():
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        if a >= 0x80000000:
            a -= 0x100000000
        t = imul(a ^ ((a & 0xFFFFFFFF) >> 15), 1 | a)
        t = (t + imul(t ^ ((t & 0xFFFFFFFF) >> 7), 61 | t)) ^ t
        t &= 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296.0

    for i in range(len(out) - 1, 0, -1):
        j = int(math.floor(rnd() * (i + 1)))
        out[i], out[j] = out[j], out[i]
    return out


def frame_spec(cell_kind: str) -> dict:
    if cell_kind == "fish":
        return {"id": "fish", "cols": 8, "rows": 14, "n": 112}
    if cell_kind == "cross":
        return {"id": "cross", "cols": 10, "rows": 10, "n": 100}
    return {"id": "byte", "cols": 8, "rows": 8, "n": 64}


def mean_frame(tapes, cols: int, rows: int) -> dict:
    n = int(cols) * int(rows)
    counts = [[0, 0, 0, 0] for _ in range(n)]
    contrib = [0] * n
    for tape in tapes:
        for i, g in enumerate(tape):
            if i >= n:
                break
            counts[i][code_of(g)] += 1
            contrib[i] += 1
    argmax = []
    strong = 0
    cells = 0
    for i in range(n):
        total = contrib[i]
        if not total:
            argmax.append(255)
            continue
        cells += 1
        best = max(range(4), key=lambda k: counts[i][k])
        argmax.append(best)
        if counts[i][best] / total >= 0.4:
            strong += 1
    return {
        "argmax": argmax,
        "score": (strong / cells) if cells else 0.0,
        "contrib": contrib,
        "counts": counts,
        "cells": cells,
    }


def diff_luma(a, b) -> list[int]:
    n = min(len(a), len(b))
    return [(int(a[i]) - int(b[i])) for i in range(n)]


def iou(a, b) -> float:
    n = min(len(a), len(b))
    inter = union = 0
    for i in range(n):
        if a[i] in (-1, None) or b[i] in (-1, None):
            continue
        aa = 1 if a[i] else 0
        bb = 1 if b[i] else 0
        if aa or bb:
            union += 1
        if aa and bb:
            inter += 1
    return inter / union if union else 0.0


def main() -> int:
    errors: list[str] = []

    def check(ok: bool, msg: str) -> None:
        if not ok:
            errors.append(msg)

    teaching = json.loads((ROOT / "data" / "quads-teaching.json").read_text())
    fish = teaching["fish"]["bits"]
    cross = teaching["cross"]["bits"]
    check(len(fish) == 8 * 14, f"fish bits {len(fish)}")
    check(len(cross) == 10 * 10, f"cross bits {len(cross)}")
    slog = teaching["ascii"]
    glyphs, pad = merge(ascii_to_bits(slog), fish, cross)
    check(pad == teaching["padBytes"] == 3, f"padBytes {pad}")
    plates = tape_aligned_plates(glyphs)
    split = split_aligned(glyphs)
    check(len(plates["c1"]) == len(glyphs), "aligned length")
    for i, g in enumerate(glyphs):
        u = unpack_index(g)
        if u["c1"] == 1:
            check(plates["c2"][i] is None, f"C2 hole at bar {i}")
            check(plates["c3"][i] in (0, 1), f"C3 bit at bar {i}")
        else:
            check(plates["c3"][i] is None, f"C3 hole at square {i}")
            check(plates["c2"][i] in (0, 1), f"C2 bit at square {i}")
    rast_c2 = stream_raster(split["c2"], 8, 14)
    rast_c3 = stream_raster(split["c3"], 10, 10)
    check(rast_c2 == fish, "stream C2 is the fish")
    check(rast_c3 == cross, "stream C3 is the cross")
    decoded = bits_to_ascii(split["c1"])
    check(decoded == slog + "   ", f"C1 ascii {decoded!r}")

    c1_only = ascii_to_bits("Test.\nQ")
    g421 = [2 if b else 0 for b in c1_only]
    check(len(g421) == 56, f"421 c1-only {len(g421)}")
    check(bits_to_ascii(split_aligned(g421)["c1"]) == "Test.\nQ", "421 ascii")

    posts = json.loads(CORPUS.read_text())["posts"]
    p3414 = next(p for p in posts if p["q"] == 3414)
    g3414 = encode_triple_text(p3414, posts)
    check(len(g3414) == 1624, f"3414 glyphs {len(g3414)}")
    s3414 = split_aligned(g3414)
    zeros = sum(1 for x in s3414["c1"] if not x)
    ones = sum(1 for x in s3414["c1"] if x)
    check(len(s3414["c1"]) == 1624, "3414 c1")
    check(len(s3414["c2"]) == zeros, f"3414 c2 {len(s3414['c2'])} vs zeros {zeros}")
    check(len(s3414["c3"]) == ones, f"3414 c3 {len(s3414['c3'])} vs ones {ones}")
    check(zeros + ones == 1624, "3414 zeros+ones")

    mask = mute_mask(g3414, {"sq0": True})
    check(len(mask) == len(g3414), "mute length")
    check(all(mask[i] is False for i, g in enumerate(g3414) if g == 0), "sq0 muted")
    check(all(mask[i] is True for i, g in enumerate(g3414) if g != 0), "others visible")
    compacted = [g for g, v in zip(g3414, mask) if v]
    check(len(compacted) < len(g3414), "mute drops sq0")
    check(len(mask) == len(g3414), "mask does not compact")

    sh1 = shuffle_glyphs(g3414, SEED)
    sh2 = shuffle_glyphs(g3414, SEED)
    check(sh1 == sh2, "shuffle 421 deterministic")
    check(sorted(sh1) == sorted(g3414), "shuffle permutation")
    check(sh1 != list(g3414), "shuffle changes order")

    fish_ink = sum(1 for b in fish if b)
    cross_ink = sum(1 for b in cross if b)
    check(fish_ink > 10 and cross_ink > 10, "essay ink")
    sh_fish = stream_raster(shuffle_glyphs(fish, SEED), 8, 14)
    check(iou(fish, fish) == 1, "iou self")
    check(iou(fish, sh_fish) < 0.85, f"shuffled fish iou {iou(fish, sh_fish)}")
    both = 0
    red_only = 0
    blue_only = 0
    # add fixture: stream C2 vs C3 on their own grids; counts of pure inks
    red_only = fish_ink
    blue_only = cross_ink
    for i in range(min(len(fish), len(cross))):
        if fish[i] and cross[i]:
            both += 1
    check(red_only > 0 and blue_only > 0, "essay add: red and blue inks exist")
    check(both < min(red_only, blue_only), "fish and cross are not the same plate")

    spec = frame_spec("cross")
    check(spec["cols"] == 10 and spec["rows"] == 10, "cross frame 10x10")
    all_sq0 = [[0] * 100, [0] * 100, [0] * 100]
    mf = mean_frame(all_sq0, 10, 10)
    check(mf["argmax"] == [0] * 100, "mean all-sq0 argmax")
    check(mf["score"] == 1.0, f"mean all-sq0 score {mf['score']}")
    short = [[0, 1], [0], [2, 2, 2]]
    ms = mean_frame(short, 2, 2)
    check(ms["contrib"][0] == 3, "short tapes still count cell 0")
    check(ms["contrib"][1] == 2, "index 1 only from tapes that have it")
    check(ms["contrib"][2] == 1, "index 2 only from the long tape")
    check(ms["contrib"][3] == 0, "do not pad with sq0")
    check(ms["argmax"][3] == 255, "empty cell has no class")
    empty_skip = [[0], [1, 1, 1, 1]]
    # hideSolid caller drops the one-glyph empty-text tape
    mh = mean_frame([empty_skip[1]], 2, 2)
    check(mh["argmax"][0] == 1, "hideSolid skips the sq0 singleton")
    check(mean_frame([[0]], 2, 2)["argmax"][0] == 0, "empty-text contributes sq0 when kept")

    d0 = diff_luma([10, 20, 30], [10, 20, 30])
    check(d0 == [0, 0, 0], "diff identical is zero")
    d1 = diff_luma([10, 20], [8, 25])
    check(d1 == [2, -5], f"diff luma {d1}")
    ordered_mean = mean_frame([g3414[:100] for _ in range(3)], 10, 10)
    check(0 <= ordered_mean["score"] <= 1, "score range")
    check(ordered_mean["cells"] == 100, "3414 prefix fills the cross frame")

    html = (ROOT / "index.html").read_text()
    js = (ROOT / "js" / "page.js").read_text()
    layers = (ROOT / "js" / "layers.js").read_text()
    check('id="layer"' in html, "layering dropdown")
    check('value="peel" selected' in html.split('id="layer"')[1][:400], "layer default peel")
    check('layer: "peel"' in js, "js layer default peel")
    check("QuadLayers" in layers and "tapeAlignedPlates" in layers, "layers.js API")
    check("js/layers.js" in html, "layers.js script tag")
    check("function toastInk" in js, "toastInk retained")
    check('selected: 1' in js and 'cell: "fish"' in js, "launch q 1 fish")
    check('id="onpage"' in html, "on page dropdown")
    check('onPage: "under"' in js, "on page default under")
    check('value="under" selected' in html.split('id="onpage"')[1][:400], "on page html under")
    check('align: "stream"' in js and 'comp: "screen"' in js, "align stream composite screen")
    check('value="stream" selected' in html, "align html stream")
    check('value="screen" selected' in html, "composite html screen")
    check('swapC3C4: true' in js, "swap c3/c4 default on")
    check('id="swap-c34" type="checkbox" checked' in html, "swap c3/c4 html on")
    check('id="view-plates"' in html, "plates view switch")
    check('pageView: "tape"' in js, "squares view default tape")
    check("function pageSquaresPlates" in js, "pageSquaresPlates")
    check('data-view="plates"' in (ROOT / "css" / "page.css").read_text(), "plates view css")
    check("function drawLayeredTape" in js, "page-scale peel")
    check('id="mix"' in html, "mix slider")
    check("function meanFrame" in layers, "meanFrame")
    check("function diffLuma" in layers, "diffLuma")
    check("glyphAtlas" in js, "cached glyph atlas")
    check('id="quote"' in html, "initial post dropdown")
    check('value="over" selected' in html.split('id="quote"')[1][:500], "quote default over")
    check('quote: "over"' in js, "js quote default over")
    check('id="quote-tape"' in html, "quote tape dropdown")
    check('value="triple-text" selected' in html.split('id="quote-tape"')[1][:400], "quote tape default triple")
    check('id="plate-p4"' in html, "C4 plate checkbox")
    check('id="quote-c1"' in html, "quote C1 plate canvas")
    check('id="quote-mix"' in html, "quote mix canvas")
    check("INK_C4" in layers, "layers.js C4 ink")
    check("function mergeClip" in layers, "mergeClip")
    check("function quoteStamp" in layers, "quoteStamp")
    check("function cleanQuoteText" in layers, "cleanQuoteText")
    check("function quoteTape" in layers, "quoteTape")
    check("function nestedBits" in layers, "nestedBits")
    check('id="tab-stack"' in html, "stack tab")
    check('id="stack-peek"' in html, "stack peek canvas")
    check('id="stack-combo"' in html, "stack combo canvas")
    check("function nestedPlateField" in js, "nestedPlateField")
    check("paintMix([" in js.split("function paintPlates")[1][:1800], "inspector mix uses the same C1/C2/C3 fields as the tiles")
    check('if (cellKind === "cross") return { w: 10, h: 10 }' in layers, "cross streamSize is the 10×10 frame")
    check('if (cellKind === "fish") return { w: 8, h: 14 }' in layers, "fish streamSize is the 8×14 frame")
    check("function paintStackViews" in js, "paintStackViews")
    check("function paintStackCombo" in js, "paintStackCombo")
    check("function clearQuoteInspector" in js, "clearQuoteInspector")
    check(clean_quote_text(TEACHING_QUOTE_RAW) == TEACHING_QUOTE, "909 clean freeze")
    g909 = quote_tape(TEACHING_QUOTE_RAW)
    check(len(g909) == 272, f"909 glyphs {len(g909)}")
    check(bits_to_ascii(split_aligned(g909)["c1"]) == TEACHING_QUOTE, "909 round-trip")
    check(quote_tape("") == [0], "empty quote is sq0")
    check(set(g909) <= {0, 2}, "c1-only is sq0/bar0")
    nested_909 = "Just in: Planned Parenthood cuts ties with Women's March regional leader over Farrakhan support."
    stamp_909 = quote_stamp(12, 34, lambda n: n in {1234, 34})
    check(stamp_909 == "1234→1234/34", f"909 stamp {stamp_909}")
    g909t = quote_tape(TEACHING_QUOTE, nested_909, stamp_909)
    check(len(g909t) == 272, f"909 triple glyphs {len(g909t)}")
    check(set(g909t) == {0, 1, 2, 3}, f"909 triple classes {set(g909t)}")
    check(bits_to_ascii(split_aligned(g909t)["c1"]) == TEACHING_QUOTE, "909 triple C1 round-trip")
    check(merge_clip(ascii_to_bits("A"), [], []) == quote_tape("A"), "clip empty extras = c1-only")
    check("(((" in TEACHING_QUOTE and "Planned Parenthood" in TEACHING_QUOTE, "parens stay ASCII")
    check("scheduleMixDraw" in js, "mix slider does not rebuild atlas")
    check('value="stack">Stack</option>' in html, "stack is live")
    check('id="swap-c34"' in html, "swap C3/C4")
    check("figC4.hidden = state.layer !== \"peel\"" in js or "figC4.hidden = state.layer !== 'peel'" in js, "C4 plate shows in peel without quote")
    check("quoteOn() && state.layer === \"peel\"" not in js, "C4 plate no longer gated on Initial post")
    check('option value="yolk"' in html, "yolk paint")
    check("YOLK_INK" in js and "#909011" in js, "yolk bar1 #909011")
    check('value="diff">Diff</option>' in html, "diff is live")
    check("teachingGlyphs" not in js.split("function meanTapes")[1][:800], "essay not in corpus mean")
    check('return "spoke"' in js.split("function siblingOrder")[1][:500], "q/ts sibling is spoke")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print("OK")
    print(f"teaching glyphs {len(glyphs)} pad {pad} fish-ink {fish_ink} cross-ink {cross_ink}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

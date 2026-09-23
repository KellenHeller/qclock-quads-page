#!/usr/bin/env python3
"""Sidecar freeze for the :8558 initial-post layer (Q0 / Q1)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tests"))
from layers import (  # noqa: E402
    TEACHING_QUOTE,
    TEACHING_QUOTE_RAW,
    ascii_to_bits,
    bits_to_ascii,
    clean_quote_text,
    quote_stamp,
    quote_tape,
    split_aligned,
)

SIDECAR = ROOT / "data" / "initial-posts.json"
LAYERS_JS = ROOT / "js" / "layers.js"
HTML = ROOT / "index.html"


def main() -> int:
    errors: list[str] = []

    def check(ok: bool, msg: str) -> None:
        if not ok:
            errors.append(msg)

    check(SIDECAR.is_file(), "data/initial-posts.json exists")
    check((ROOT / "js" / "quads.js").is_file(), "quads.js present")
    check((ROOT / "data" / "corpus.json").is_file(), "corpus.json present")
    check("function cleanQuoteText" in LAYERS_JS.read_text(), "layers.js cleanQuoteText")
    check("function quoteTape" in LAYERS_JS.read_text(), "layers.js quoteTape")
    check("function mergeClip" in LAYERS_JS.read_text(), "layers.js mergeClip")
    check("function quoteStamp" in LAYERS_JS.read_text(), "layers.js quoteStamp")
    check("function nestedBits" in LAYERS_JS.read_text(), "layers.js nestedBits")
    check("INK_C4" in LAYERS_JS.read_text(), "layers.js INK_C4")
    html = HTML.read_text()
    js = (ROOT / "js" / "page.js").read_text()
    check('id="quote"' in html, "quote control")
    check('value="over" selected' in html.split('id="quote"')[1][:500], "quote default over")
    check('id="quote-peek"' in html, "quote peek canvas")
    check('id="quote-tape"' in html, "quote tape control")
    check('id="plate-p4"' in html, "C4 checkbox")
    check('id="quote-c4"' in html, "quote C4 canvas")
    check('id="quote-mix"' in html, "quote mix canvas")
    check('id="tab-stack"' in html, "right stack tab")
    check('id="stack-peek"' in html, "stack selected+initial canvas")
    check('id="stack-mix"' in html, "stack plates canvas")
    check('id="stack-combo"' in html, "stack combo canvas")
    check("function nestedPlateField" in js, "nested C2 is its own plate")
    check("function clearQuoteInspector" in js, "clear quote canvases on miss")
    check("function paintStackViews" in js, "stack tab painter")
    check("function paintStackCombo" in js, "stack combo painter")
    check('rtab=stack' in js, "stack tab hash")

    data = json.loads(SIDECAR.read_text())
    meta = data.get("meta") or {}
    posts = data.get("posts") or {}
    check(meta.get("n") == 4966, f"meta.n {meta.get('n')}")
    check(meta.get("n_with") == 1475, f"n_with {meta.get('n_with')}")
    check(meta.get("n_empty_first") == 54, f"n_empty_first {meta.get('n_empty_first')}")
    check(meta.get("n_nested") == 752, f"n_nested {meta.get('n_nested')}")
    check(len(posts) == 1475, f"posts keys {len(posts)}")
    check("3414" not in posts, "3414 omitted")
    check("421" not in posts, "421 omitted")
    check("533" not in posts, "533 omitted")
    row884 = posts.get("884")
    check(bool(row884), "884 present")
    if row884:
        nested884 = ((row884.get("refs") or [{}])[0].get("nested") or {}).get("text") or ""
        check(not nested884.strip(), "884 has no nested board post")

    row = posts.get("909")
    check(bool(row), "909 present")
    refs = (row or {}).get("refs") or []
    check(len(refs) >= 1, "909 has refs")
    if refs:
        check(str(refs[0].get("id")) == "612799", f"909 id {refs[0].get('id')}")
        check(refs[0].get("text") == TEACHING_QUOTE, f"909 text {refs[0].get('text')!r}")
        check("<span" not in (refs[0].get("text") or ""), "909 no span")
        nested = refs[0].get("nested") or {}
        check(str(nested.get("id")) == "612417", f"909 nested id {nested.get('id')}")
        check("Planned Parenthood cuts ties" in (nested.get("text") or ""), "909 nested stored")
        nested_bits = ascii_to_bits(clean_quote_text(nested.get("text") or ""))
        check(sum(1 for b in nested_bits if b) > 0, "909 nested C2 plate has ink")

    span_n = 0
    for rec in posts.values():
        for r in rec.get("refs") or []:
            if "<span" in (r.get("text") or ""):
                span_n += 1
    check(span_n == 0, f"span leftovers {span_n}")

    check(clean_quote_text(TEACHING_QUOTE_RAW) == TEACHING_QUOTE, "clean freeze")
    glyphs = quote_tape(TEACHING_QUOTE_RAW)
    check(len(glyphs) == 272, f"909 glyphs {len(glyphs)}")
    check(bits_to_ascii(split_aligned(glyphs)["c1"]) == TEACHING_QUOTE, "909 ascii round-trip")
    check(quote_tape("") == [0], "empty -> sq0")
    check(quote_tape("   ") == [0], "blank -> sq0")

    nested = ((row or {}).get("refs") or [{}])[0].get("nested") or {}
    stamp = quote_stamp(12, 34, lambda n: n in {1234, 34})
    g909t = quote_tape(TEACHING_QUOTE, nested.get("text") or "", stamp)
    check(len(g909t) == 272, f"909 triple glyphs {len(g909t)}")
    check(set(g909t) == {0, 1, 2, 3}, f"909 triple classes {sorted(set(g909t))}")
    check(bits_to_ascii(split_aligned(g909t)["c1"]) == TEACHING_QUOTE, "909 triple ascii")
    check(stamp == "1234→1234/34", f"909 stamp {stamp}")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print("OK")
    print(
        f"sidecar n_with={meta.get('n_with')} empty_first={meta.get('n_empty_first')} "
        f"nested={meta.get('n_nested')} 909 glyphs=272"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

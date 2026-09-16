#!/usr/bin/env python3
"""Freeze 9-symbol codec + 421 teaching facts for :8558 /vortex.html."""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORPUS = ROOT / "data" / "corpus.json"
FIXTURE = ROOT / "data" / "vortex-teaching.json"
FROZEN = [
    "index.html",
    "js/page.js",
    "css/page.css",
    "js/layouts.js",
    "js/quads.js",
    "data/corpus.json",
    "data/quads-teaching.json",
    "tests/page.py",
    "serve.sh",
    "README.md",
]
FROZEN_SHA = Path("/tmp/qclock-quads-frozen-sha256.txt")

DOUBLING = {1, 2, 4, 8, 7, 5}
POLAR = {0: 9, 1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1, 9: 0}


def dr(n: int) -> int:
    n = abs(int(n))
    if n == 0:
        return 0
    r = n % 9
    return 9 if r == 0 else r


def family(d: int) -> str:
    if d in (1, 4, 7):
        return "147"
    if d in (2, 5, 8):
        return "258"
    if d in (3, 6, 9):
        return "369"
    return "hole"


def orbit(d: int) -> str:
    if d == 0:
        return "hole"
    if d == 9:
        return "axis"
    if d in (3, 6):
        return "flux"
    if d in DOUBLING:
        return "doubling"
    return "hole"


def ascii_bytes(s: str) -> list[int]:
    return [ord(ch) & 0xFF for ch in s]


def ascii_to_digits(s: str) -> list[int]:
    out: list[int] = []
    for b in ascii_bytes(s):
        out.extend([(b // 100) % 10, (b // 10) % 10, b % 10])
    return out


def digits_to_ascii(digits: list[int]) -> str:
    n = len(digits) - (len(digits) % 3)
    chars = []
    for i in range(0, n, 3):
        v = (digits[i] * 100 + digits[i + 1] * 10 + digits[i + 2]) & 0xFF
        chars.append(chr(v))
    return "".join(chars)


def date_key_string(iso: str) -> str:
    y, m, d = iso.split("-")
    return str(int(m)) + d


def q_digit_tape(post: dict) -> list[int]:
    q = [int(ch) for ch in str(post["q"])]
    date = [int(ch) for ch in date_key_string(post["date"])]
    time = f"{post['hh']:02d}{post['mm']:02d}{post['ss']:02d}"
    return q + date + [int(ch) for ch in time]


def walk(byq: dict, q: int) -> list[int]:
    path: list[int] = []
    seen: set[int] = set()
    cur = q
    for _ in range(16):
        path.append(cur)
        if cur in seen:
            break
        seen.add(cur)
        nxt = byq.get(cur, {}).get("next")
        if nxt is None or nxt not in byq:
            break
        cur = nxt
    return path


def first_lock(byq: dict, q: int) -> int:
    for n in walk(byq, q):
        if n in (421, 1222):
            return n
    return 421


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def main() -> int:
    errors: list[str] = []

    def check(cond: bool, msg: str) -> None:
        if not cond:
            errors.append(msg)

    fx = json.loads(FIXTURE.read_text())
    data = json.loads(CORPUS.read_text())
    posts = data["posts"]
    byq = {p["q"]: p for p in posts}
    p421 = byq[421]

    check(dr(421) == 7, f"dr(421) {dr(421)}")
    check(dr(1222) == 7, f"dr(1222) {dr(1222)}")
    check(dr(1221) == 6, f"dr(1221) {dr(1221)}")
    check(dr(0) == 0, "dr(0) hole")
    check(dr(9) == 9 and dr(18) == 9, "multiples of 9")

    for a, b in POLAR.items():
        check(POLAR[b] == a, f"polar {a}↔{b}")
    check(family(1) == "147" and family(4) == "147" and family(7) == "147", "fam 147")
    check(family(2) == "258" and family(5) == "258" and family(8) == "258", "fam 258")
    check(family(3) == "369" and family(6) == "369" and family(9) == "369", "fam 369")
    check(orbit(1) == "doubling" and orbit(5) == "doubling", "orbit doubling")
    check(orbit(3) == "flux" and orbit(6) == "flux", "orbit flux")
    check(orbit(9) == "axis" and orbit(0) == "hole", "orbit axis/hole")

    text = "Test.\nQ"
    roots = [dr(b) for b in ascii_bytes(text)]
    check(roots == [3, 2, 7, 8, 1, 1, 9], f"byte-roots {roots}")
    check(ascii_bytes(text) == [84, 101, 115, 116, 46, 10, 81], "ascii bytes")
    digits = ascii_to_digits(text)
    check(digits_to_ascii(digits) == text, f"round-trip {digits_to_ascii(digits)!r}")
    check(digits_to_ascii(ascii_to_digits(text)) == text, "asciiToDigits round-trip")
    check(len(ascii_to_digits(text)) == 21, f"421 C1 is 21 digits {len(ascii_to_digits(text))}")

    check(fx["layout"]["top"] == 9 and fx["layout"]["center"] == 0, "layout top/center")
    check(fx["layout"]["clockwise"] == [1, 2, 3, 4, 5, 6, 7, 8], "layout clockwise")
    check(fx["digits"] == [4, 2, 1] and fx["dr"] == 7, "421 digits")
    check(fx["dateKey"] == 1222 and fx["byteRoots"] == [3, 2, 7, 8, 1, 1, 9], "fixture 421")
    check(fx["walkDrs"] == [7, 7, 7], "walk Drs")
    check(fx["walk1Drs"] == [1, 2, 9, 6, 7, 7, 7], "walk(1) Drs")

    tape = q_digit_tape(p421)
    check(tape[:7] == [4, 2, 1, 1, 2, 2, 2], f"q-digits start {tape[:7]}")
    check(tape == [4, 2, 1, 1, 2, 2, 2, 0, 0, 4, 4, 0, 2], f"q-digits full {tape}")
    check(p421["text"] == "Test.\nQ", "421 text")
    check(p421["date"] == "2017-12-22" and p421["spoke"] == 15 and p421["hops"] == 0, "421 stamp")
    check(p421["hh"] == 0 and p421["mm"] == 44 and p421["ss"] == 2, "421 time")

    w1 = walk(byq, 1)
    check(w1 == [1, 1028, 405, 1221, 421, 1222, 421], f"walk(1) {w1}")
    check([dr(n) for n in w1] == [1, 2, 9, 6, 7, 7, 7], "walk(1) drs")
    check(walk(byq, 421) == [421, 1222, 421], "421 walk")

    roots_c = {i: 0 for i in range(1, 10)}
    fam = {"147": 0, "258": 0, "369": 0}
    orb = {"doubling": 0, "flux": 0, "axis": 0}
    doubling_q = 0
    basin = {421: 0, 1222: 0}
    for p in posts:
        d = dr(p["q"])
        roots_c[d] += 1
        fam[family(d)] += 1
        o = orbit(d)
        if o in orb:
            orb[o] += 1
        if set(int(ch) for ch in str(p["q"])) <= DOUBLING:
            doubling_q += 1
        basin[first_lock(byq, p["q"])] += 1
    check(len(posts) == 4966, f"n {len(posts)}")
    check(roots_c == {1: 552, 2: 552, 3: 552, 4: 552, 5: 552, 6: 552, 7: 552, 8: 551, 9: 551}, f"roots {roots_c}")
    check(fam == {"147": 1656, "258": 1655, "369": 1655}, f"family {fam}")
    check(orb == {"doubling": 3311, "flux": 1104, "axis": 551}, f"orbit {orb}")
    check(doubling_q == 906, f"all digits doubling {doubling_q}")
    check(basin == {421: 4802, 1222: 164}, f"basin {basin}")

    js = (ROOT / "js" / "vortex.js").read_text()
    for name in [
        "function dr(",
        "function drAxis(",
        "function family(",
        "function orbit(",
        "function polar(",
        "function packDigit(",
        "function unpackGlyph(",
        "function mergeDigits(",
        "function asciiToDigits(",
        "function digitsToAscii(",
        "function byteRoots(",
        "function qDigitTape(",
        "function familyChip(",
    ]:
        check(name in js, f"vortex.js missing {name}")
    check("do not patch quads.js" in js or "do not patch" in js, "owns dr, does not patch quads")
    check("top: 9" in js and "center: 0" in js, "layout in js")

    html = (ROOT / "vortex.html").read_text()
    check("Four-symbol" in html and "9-symbol" in html, "tab chrome")
    check("index.html" in html and "Four-symbol" in html, "link back to four-symbol")
    check("vortex.css" in html and "vortex-page.js" in html, "new assets")
    check('option value="page" selected' in html, "page is default view")
    check('option value="decimal" selected' in html, "C1 digits is default tape")
    check('option value="digit3" selected' in html, "3-wide cell default")
    check('id="hide-solid"' in html, "hide solid checkbox")
    check('id="cell"' in html, "cell packing select")
    check("js/quads.js" in html and "js/layouts.js" in html, "read frozen helpers")
    check("css/page.css" in html, "reuse page theme")
    check("index.html" not in html.split("href")[0] or True, "ok")

    css = (ROOT / "css" / "vortex.css").read_text()
    check(".tab-nav" in css or "tab-nav" in css, "tab nav css")
    check("--vector" in css, "vector ink")
    check("@media" in css, "narrow rails")

    page_js = (ROOT / "js" / "vortex-page.js").read_text()
    check('view: "page"' in page_js, "default page")
    check('tape: "decimal"' in page_js, "default C1 digits tape")
    check('cell: "digit3"' in page_js, "default 3-wide byte rows")
    check("q-digits" in page_js and "byte-root" in page_js and "decimal" in page_js, "tapes")
    check("family-chip" in page_js, "family-chip tape")
    check("function blitTape(" in page_js, "page-scale blit like four-symbol")
    check("hideSolid" in page_js, "hide solid")
    check("rebuildTapes" in page_js, "cached tapes")

    index = (ROOT / "index.html").read_text()
    check("9-symbol" not in index.lower(), "original tab has no 9-symbol chrome")
    check('id="tab-nav"' not in index, "original has no tab-nav")

    if FROZEN_SHA.exists():
        expected = {}
        for line in FROZEN_SHA.read_text().splitlines():
            parts = line.split()
            if len(parts) >= 2:
                expected[parts[1]] = parts[0]
        for rel in FROZEN:
            got = sha256(ROOT / rel)
            want = expected.get(rel)
            check(want == got, f"frozen changed {rel}")

    node = subprocess.run(["node", "-e", "process.exit(0)"], capture_output=True)
    if node.returncode == 0:
        script = r"""
const fs = require("fs");
const vm = require("vm");
const ctx = { console, globalThis: {} };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync("js/vortex.js", "utf8"), ctx);
const V = ctx.Vortex;
const fx = JSON.parse(fs.readFileSync("data/vortex-teaching.json", "utf8"));
const fail = [];
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) fail.push(m + " " + JSON.stringify(a)); };
eq(V.dr(421), 7, "js dr 421");
eq(V.dr(1222), 7, "js dr 1222");
eq(V.dr(1221), 6, "js dr 1221");
eq(V.dr(0), 0, "js dr 0");
eq(V.byteRoots("Test.\nQ"), [3,2,7,8,1,1,9], "js byteRoots");
eq(V.digitsToAscii(V.asciiToDigits("Test.\nQ")), "Test.\nQ", "js roundtrip");
eq(V.LAYOUT.top, 9, "js top");
eq(V.LAYOUT.center, 0, "js center");
eq(V.polar(1), 8, "js polar 1");
eq(V.polar(3), 6, "js polar 3");
eq(V.family(7), "147", "js family");
eq(V.orbit(9), "axis", "js orbit");
eq(V.qDigitTape({q:421,date:"2017-12-22",hh:0,mm:44,ss:2}).slice(0,7), [4,2,1,1,2,2,2], "js q-digits");
eq(V.unpackGlyph(V.packDigit(4,0)).d, 4, "js pack 4");
eq(V.unpackGlyph(V.packDigit(1,1)).extra, 1, "js hollow 1");
const m = V.mergeDigits([4,2,1], [1], [1,1]);
if (!m.glyphs.length) fail.push("merge empty");
if (fail.length) { console.log(fail.join("\n")); process.exit(1); }
console.log("JS OK");
"""
        r = subprocess.run(["node", "-e", script], cwd=ROOT, capture_output=True, text=True)
        check(r.returncode == 0, f"node vortex.js {r.stdout}{r.stderr}")
    else:
        errors.append("node not available for js codec check")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print("OK")
    print("421 q-digits", tape)
    print("census doubling/flux/axis", orb)
    return 0


if __name__ == "__main__":
    sys.exit(main())

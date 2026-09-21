#!/usr/bin/env python3
"""Q0: join qalerts posts.json to corpus; write data/initial-posts.json.

Read-only on replica. HTML-stripped first-quote (+ nested stored, unused until Q6).
"""
from __future__ import annotations

import hashlib
import html
import json
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
CORPUS = ROOT / "data" / "corpus.json"
POSTS_JSON = Path("/home/luke/qclock-research/data/posts.json")
OUT = ROOT / "data" / "initial-posts.json"
NY = ZoneInfo("America/New_York")
UTC = timezone.utc
BR_RE = re.compile(r"<br\s*/?>", re.I)
P_RE = re.compile(r"</?(?:p|div)(?:\s[^>]*)?>", re.I)
TAG_RE = re.compile(r"<[^>]+>")
SPACE_NL_RE = re.compile(r"[ \t]+\n")
MULTI_NL_RE = re.compile(r"\n{3,}")
TEACHING_Q = 909
TEACHING_ID = "612799"
TEACHING_TEXT = ">>612417\n\n(((Planned Parenthood)))"


def ny_of(ts: int) -> datetime:
    return datetime.fromtimestamp(int(ts), tz=UTC).astimezone(NY)


def civil(ts: int) -> dict:
    dt = ny_of(ts)
    return {
        "est_iso": dt.date().isoformat(),
        "est_hms": dt.strftime("%H:%M:%S"),
        "tzname": dt.tzname(),
    }


def clean_quote_text(raw) -> str:
    s = "" if raw is None else str(raw)
    s = BR_RE.sub("\n", s)
    s = P_RE.sub("\n", s)
    s = TAG_RE.sub("", s)
    s = html.unescape(s)
    s = s.replace("\r\n", "\n").replace("\r", "\n")
    s = SPACE_NL_RE.sub("\n", s)
    s = MULTI_NL_RE.sub("\n\n", s)
    return s.strip("\n")


def decode_text(s) -> str:
    if s is None:
        return ""
    return html.unescape(str(s))


def text_key(s: str) -> str:
    t = decode_text(s).strip()
    if t.endswith("…"):
        t = t[:-1].rstrip()
    return t[:80]


def pick_raw(pool: list[dict], corpus_text: str) -> dict:
    if len(pool) == 1:
        return pool.pop(0)
    want = text_key(corpus_text)
    for i, item in enumerate(pool):
        got = text_key(item.get("text") or "")
        if got == want or got.startswith(want):
            return pool.pop(i)
        if want and want[:40] and got.startswith(want[:40]):
            return pool.pop(i)
    return pool.pop(0)


def nest_row(ref: dict) -> dict | None:
    nested = ref.get("references") or []
    if not nested or not isinstance(nested[0], dict):
        return None
    n = nested[0]
    ts = n.get("timestamp")
    row = {
        "id": n.get("id"),
        "name": n.get("name"),
        "text": clean_quote_text(n.get("text")),
    }
    if ts is not None:
        try:
            row["ts"] = int(ts)
        except (TypeError, ValueError):
            pass
    return row


def ref_row(ref: dict) -> dict:
    ts = int(ref["timestamp"])
    c = civil(ts)
    row = {
        "id": ref.get("id"),
        "name": ref.get("name"),
        "userId": ref.get("userId"),
        "ts": ts,
        "est_iso": c["est_iso"],
        "est_hms": c["est_hms"],
        "tzname": c["tzname"],
        "text": clean_quote_text(ref.get("text")),
    }
    nested = nest_row(ref)
    if nested:
        row["nested"] = nested
    return row


def main() -> int:
    corpus = json.loads(CORPUS.read_text())
    raw_posts = json.loads(POSTS_JSON.read_text())
    by_key: dict[tuple, list] = defaultdict(list)
    for p in raw_posts:
        by_key[(int(p["timestamp"]), p["source"])].append(p)

    built = datetime.now(tz=UTC).astimezone(NY).isoformat(timespec="seconds")
    posts_out: dict[str, dict] = {}
    unmatched = 0
    n_empty_first = 0
    n_nested = 0

    for p in corpus["posts"]:
        key = (int(p["ts"]), p["src"])
        pool = by_key.get(key)
        if not pool:
            unmatched += 1
            continue
        raw = pick_raw(pool, p.get("text") or "")
        refs_raw = raw.get("references") or []
        if not refs_raw:
            continue
        refs = [ref_row(r) for r in refs_raw]
        if not (refs[0].get("text") or "").strip():
            n_empty_first += 1
        if refs[0].get("nested"):
            n_nested += 1
        posts_out[str(p["q"])] = {
            "q": p["q"],
            "id": raw.get("id"),
            "refs": refs,
        }

    leftover = sum(len(v) for v in by_key.values())
    if unmatched or leftover or len(corpus["posts"]) != 4966:
        print(
            f"FAIL unmatched={unmatched} leftover={leftover} corpus={len(corpus['posts'])}",
            file=sys.stderr,
        )
        return 1

    teach = posts_out.get(str(TEACHING_Q))
    if not teach or not teach["refs"]:
        print("FAIL teaching 909 missing", file=sys.stderr)
        return 1
    got_text = teach["refs"][0].get("text")
    got_id = str(teach["refs"][0].get("id"))
    if got_id != TEACHING_ID or got_text != TEACHING_TEXT:
        print(f"FAIL 909 freeze id={got_id!r} text={got_text!r}", file=sys.stderr)
        return 1

    index = {
        "meta": {
            "n": 4966,
            "n_with": len(posts_out),
            "n_empty_first": n_empty_first,
            "n_nested": n_nested,
            "tz": "America/New_York",
            "posts_json_bytes": POSTS_JSON.stat().st_size,
            "corpus_md5": hashlib.md5(CORPUS.read_bytes()).hexdigest(),
            "built": built,
            "teaching_q": TEACHING_Q,
            "teaching_id": TEACHING_ID,
            "teaching_text": TEACHING_TEXT,
        },
        "posts": posts_out,
    }
    OUT.write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")))
    print(
        f"OK wrote {OUT} n_with={len(posts_out)} empty_first={n_empty_first} "
        f"nested={n_nested} bytes={OUT.stat().st_size}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

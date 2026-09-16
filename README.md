# Four-symbol page

Each of the 4,966 Q posts is packed as its own Drew/Rodney four-symbol rectangle. All rectangles fit on a single page.

Independent packing of this corpus — not a claim that Q wrote quads.

**Live:** [ogdonny.github.io/qclock-quads-page](https://ogdonny.github.io/qclock-quads-page/)

Default view (hash is written on load):

`#q=3414&order=q&weave=raster&cell=cross&tape=triple-text&chips=spoke-hops&color=off&theme=ebs&paint=toast&gaps=0&hide=1&solid=1`

| Control | Default |
|---|---|
| Order | Sequential q |
| Weave | Raster L→R, T→B |
| Selected | **#3414** |
| Cell | Cross frame 10×10 (3414 packs as **10×163**) |
| Tape | Triple-text (LOOP + stamp) |
| Chips | spoke-hops |
| Theme | EBS (please stand by) |
| EBS paint | **Toast** |
| Color | Off (glyph ink) |
| Cell gaps | off |
| Hide empty slots | on |
| Hide solid squares | on (231 empty-text posts omitted) |

Toast four-symbol inks:

| Glyph | Hex |
|---|---|
| sq0 | `#901131` |
| sq1 | `#319011` |
| bar0 | `#113190` |
| bar1 | `#903111` |
| cell | `#901171` |

Square / bar = Code 1 (ASCII). Fill on squares = Code 2. Fill on bars = Code 3. Same codec as the :8765 replica.

## Run locally

```bash
python3 -m http.server 8558 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8558/`.

```bash
python3 tests/page.py
```

## Toggles

**Page order:** sequential q, timestamp, replica date, spoke, hops, time face, date×minute, spoke 15 first, lock basin, AM/PM, even/odd q, LOOP depth, walk-first-visit.

**Page weave:** raster, boustrophedon, spiral, columns.

**Cell packing:** 8-wide byte rows, 32-wide notebook, column-major, boustrophedon, square spiral, weeks (7), nearest square, 8×14 fish frame, 10×10 cross frame.

**Tape:** C1 ASCII (full post), triple-text (LOOP + stamp), head 8 bytes, field chip (`spoke-hops` / `ampm-lock` / `even-q` / `timehash`).

**Theme:** Phosphor, Volt, Magma, Ion, EBS (meaning / spectrum / toast), Paper, Oak.

**Hide empty slots:** leftover page cells and padded tape cells omitted. Hash `hide=1`.

**Hide solid squares:** empty-text posts (image-only / blank, e.g. 544 and 550) omitted. Hash `solid=1`.

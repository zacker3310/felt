# Equipment and room research

Read-only audit for [[.buildloop/intent/T6|intent T6]], 2026-11-04. Findings, not decisions: the decisions are in [[.buildloop/spec/T6|spec T6]].

**Caveat:** the session's web search budget ran out, so five queries never ran: TV ball sets, the Crucible, Joy arenas, carom halls and rec rooms. Racks, chalk, bridges and most room detail are therefore JUDGMENT. `index.html` shifted about 6 lines during the survey, so I cite functions, not lines.

## Part 1: the code
- **Shared across games:** `look()` never reads the game. All nine wear one cloth, rail, cue and chalk, and pool kinds share a ball set. Snooker, carom and bumper keep fixed balls. `paintTableJob` branches on `TABLE` only for shape and marks.
- **Room:** `v3RoomTex` caches one room, a pool hall with a back bar, racks, sconces and neighbouring tables. The 2D "room" is `pageColor` plus a radial glow.
- **Cues:** `CUE_LEN` is 1.47 and `cueR` is a single 12.8 to 29.2 mm taper. `cueParts` has fixed offsets, so length, joint and ferrule can't vary.
  - The bumper cue is as long as the pool cue.
  - `v3Cue` draws colour bands only, so points and wrap patterns vanish in 3D.
- **Rails and hardware:**
  - `RAILS` is wood grain only (no leather or lacquer).
  - `paintPocketCaps` hard-codes leather and nickel.
  - `paintSights` is pearl diamonds or nothing.
  - The 3D body is a box; there are no legs.
  - `napTile` is one cached tile, so worsted and napped cloth look the same.
- **Balls:** `PAINT` is a base plus axis caps. It can do stripes, spots and bands, not an S-curve swirl.
- **Pinned by `cosmetics-check`:** `ALL_LOOKS`, `own === 26`, the hard-coded cloth list, 3:1 for overlays and byte-identical physics.
- **Existing error:** `BALLSETS.tv` keeps purple 4 and maroon 7. TV sets use pink and a lighter brown or tan [a].

## Part 2: research corrections
- **Joy Q8:** dimensions, diamond solid-wood legs and Strachan 6811 are VERIFIED [b]. The leather is on the "outer mouth", not the whole rail [b]. The opening is listed at 85 mm [b]; compare `POCKET_STYLES.heyball` but don't change physics.
- **UNITY:** pink and blue, Yin-Yang concept, balls credited to Dynaspheres, not Aramith (KNBB, search snippet only; the page returned 404) [c]. The mandatory date is UNVERIFIED, and so is which ball wears which colour.
- **Snooker joint:** 12 or 16 in from the butt [d]. Peradon's is about 16 in, with a 42 in shaft [e].
- **Crucible cloth:** No. 10 is named at the World Championship [f]. 6811 is the ranking-event cloth (search snippet) [f].
- **Carom:** tip 11.8 to 12 mm, not 11.5 [g]. The 5 to 8 mm ferrule is UNVERIFIED; "shorter" is all I could confirm [d].
- **Bumper cue:** 48 in, one-piece hardwood [h]. Some sets use 36 in [i].
- **Hexes:** no manufacturer page I reached publishes any. All hexes are JUDGMENT, matched to colourway names.

## Recommendations
Contrast is my estimate on the lit bed (`CL.lamp` at 0.09 alpha); confirm it with `cosmetics-check`.

| Game | Cloth (ovMin, illegal) | White / illegal | Rail, pockets | Balls | Room |
|---|---|---|---|---|---|
| 8 | existing green | 3.31 / 3.21 | walnut, nickel | classic | hall |
| 9 | Tournament Blue [j] `#1f5fa8` (.72, `#ffe27a`) | 3.53 / 4.07 | black lacquer | corrected tv | arena |
| 10 | Electric Blue [j] `#1566b8` (.78, `#ffe27a`) | 3.56 / 3.72 | ebony | corrected tv, measles | arena |
| 14.1 | Spruce [j] `#134a44` (.60, `#ffa597`) | 3.90 / 4.02 | walnut, pearl diamonds | vintage | hall |
| Rotation | Wine [j] `#8c1f25` (.66, `#ffe27a`) | 4.14 / 5.84 | cherry | classic | hall |
| Snooker | 6811 green [f] `#1f6b3a` (.66, `#ffe27a`) | 3.24 / 4.07 | oak, no sights, brass | yellow to black | Crucible |
| Chinese 8 | same green (cloth colour unverified) | same | black leather mouths, wood | original pink/blue | Joy arena |
| Carom | existing `blue`; Delsa Blue exists [k] | 3.82 / 5.06 | dark wood, no caps | white, yellow, red; dotted white option [l] | hall |
| Bumper | Olive [j] `#4f6030` (.76, `#ffe27a`) | 3.90 / 4.22 | walnut veneer | red, white; marked ball ringed in the other colour [m] | rec room |

**Contrast warnings**
- `#ffa597` fails on the snooker green at 2.75, so use `#ffe27a`.
- Camel cloth failed: white can't reach 3:1 at full opacity.
- Red bumper cloth hides the red balls, so I rejected it.
- Balls on cloth also fail 3:1 today. Snooker blue is about 1.1 on the current green and 1.07 on the proposed one. Pink is 1.86 on the proposed green, the UNITY-style blue 1.13, carom red 1.52 on blue.
- `rim` covers only near-black balls on dark cloths. Extend it per ball.

**Cue specs** (metres or mm)

| Cue | Length | Tip | Ferrule | Joint from tip | Butt | Finish | Source |
|---|---|---|---|---|---|---|---|
| Pool | 1.47 | 12.4 | 22, phenolic | 0.735 | 31 | points, Irish linen or leather | V [d][g], J tip |
| Snooker | 1.473 | 9.5 to 10 | brass, 20 J | 1.067 | 30 J | ash, ebony splice, no wrap, flat-sided butt | V [d][e] |
| Carom | 1.425 | 12 | 6 J | 0.705 | 32 | 22 mm collar, no wrap, rubber bumper | V [g][n] |
| Chinese 8 | 1.473 | 11.5 | 20 J, carbon | 1.067 J | 30 J | ash, rosewood splice, veneers | V [o] |
| Bumper | 1.219 | 12 J | 15 J | none | 28 J | plain one-piece hardwood | V [h] |

**Materials, VERIFIED**
- 860 is nap-free worsted, while snooker cloth has a directional nap running from baulk to the black's end [j][p].
- Carom cloth is no-nap wool on an electrically heated table, 3.0 x 1.5 m [l].
- Chinese 8-ball uses snooker-like rounded pockets, 2¼ in balls and napped cloth [q][r].
- Swan and spider rests are real snooker gear [p].

**Avoid:** a pale 2 on grey cloth blended in under TV lights, per forum reports on the Dynaspheres Titan set [s]. That is anecdote, but it applies to `grey`.

**Rooms** (all JUDGMENT except Crucible geometry)
- **Crucible:** thrust stage, audience on three sides, 980 seats, nobody over 20 m away [t]. Paint black, low dim seating close in, no neighbouring tables.
- **Arena:** black surround, long canopy, seat tiers as bokeh.
- **Joy arena:** arena plus a warmer stage wash and a clay-free neutral backdrop.
- **Carom hall:** rows of tables under strip light, pale walls.
- **Rec room:** knotty pine panels, low ceiling, one hanging lamp.

Racks, chalk, bridges (all JUDGMENT):
- wood triangle for snooker
- none for carom
- green chalk for snooker
- blue chalk for pool

## Renderer additions, by return
1. **Per-game looks (about 30 lines, highest return).** Add `GAME_LOOK[kind]` read by `look()`, plus the kind in `lookSig` and `v3Key`. Add an `auto` setting so saves and career items still win. Route snooker and carom balls through `useBalls`. This is mostly data, and it covers every row above.
2. **Room by key (about 60 lines).** Parameterise `v3PaintWall` and key `v3RoomTex`. Have `v3RoomGeo` return an empty `near` for arenas. Arenas are cheap because they mostly delete features. Vary the radial in `paintTableJob`. Watch `V3.roomMs`.
3. **Cue geometry (about 50 lines).** Add `geo` to `CUES`, and make `cueR` and `cueParts` read it. In `v3Cue`, raise `S` and colour vertices by angle so splices and points show in 3D. Also update `drawCue` and `cueWrap`.
4. **Rail and hardware materials (about 40 lines).** Add `mat` and `metal` to `RAILS`. Extend `paintRails` (sheen, no grain for leather), `paintPocketCaps` (brass) and `paintSights` (`diamond`, `dot`, `none`). Add diamond legs last; they need geometry in `v3Geo`.

Tests must update `ALL_LOOKS`, the `own` count and the cloth list.

## Sources
- a: https://en.wikipedia.org/wiki/Billiard_ball
- b: https://www.cuesportsyorkshire.co.uk/product-page/heyball-table
- c: https://www.knbb.nl/node/35104
- d: https://en.wikipedia.org/wiki/Cue_stick
- e: https://www.decathlon.co.uk/p/mp/peradon-york-3-4-snooker-cue/a2af3f48-a6c4-4e2c-a01c-26435f1e8ba6/c27 (snippet of a Peradon listing; this exact page returned 403, so the specs are unconfirmed for it)
- f: https://wsptextiles.com/?p=485 (snippet; exact page unconfirmed)
- g: https://longonicues.com/longoni-specifications/longoni-cues-specifications
- h: https://gophersport.com/atomic-bumper-pool-table-pool-cue
- i: https://www.kohls.com/product/prd-8578084/48-in-pool-table-with-full-ball-set-and-cue-sticks-for-kids-and-adults.jsp
- j: https://www.simoniscloth.com/?p=1204
- k: https://www.ebay.de/itm/116129545931
- l: https://en.wikipedia.org/wiki/Carom_billiards
- m: https://en.wikipedia.org/wiki/Bumper_pool
- n: https://billiard.city/products/longoni-ferrara-carom-cue-gray-w-e71-maple-shaft-no-wrap (snippet)
- o: https://www.woodscues.com/products/3-4-ash-chinese-8-ball-pool-cue-9009
- p: https://en.wikipedia.org/wiki/Snooker
- q: https://en.wikipedia.org/wiki/Chinese_eight-ball
- r: https://www.homeleisuredirect.com/blog/pool/complete-guide-to-chinese-8-ball.html
- s: https://forums.azbilliards.com/threads/dynaspheres-and-wnt-launch-major-partnership-as-the-new-balls-of-the-tour.587213/
- t: https://en.wikipedia.org/wiki/Crucible_Theatre

# Trick shot and career research

For [[.buildloop/intent/T6|intent T6]], 2026-11-04. Findings, not decisions: the decisions are in [[.buildloop/spec/T6|spec T6]].

**Sources**
- W: https://docs.wixstatic.com/ugd/3837b8_6844bb907d4644c09a04e4ed4f9ded5a.pdf. Same file id as your link; wpa-apd.org itself returns 404.
- B: https://wpbsa.com/?p=74852
- N: https://worldnineballtour.com/world-rankings/
- F: https://drdavepoolinfo.com/faq/rating/fargorate/
- D: https://en.wikipedia.org/wiki/Dirt_4

V = VERIFIED, followed by the source (code and sim are runs against this repo). J = JUDGMENT.

**Not verified:** search budget ran out and pages were blocked. That leaves Trick Shot Magic's format, Joy Masters, UMB qualifying detail, BCA and "repetition is the common pitfall" unsourced. APA and VNEA read on Wikipedia, unused below.

## Part A: trick shots

**Today (V code)**
- 14 classics plus 9 jump/masse shots, with `level` on the jump group only.
- Stars are 3, 2 or 1 at try 1, tries 2-3, or later.
- `trickTries` never resets, so one early miss caps a shot's stars permanently. This is the main weakness.
- Any scratch fails, while WPA allows scratches by default (V W).
- There are no disciplines and no run or total score. The daily shot uses classics only.
- A new shot costs about 1 minute per table setting by the solver's own estimate, across 4 settings. Solutions are pasted by hand, and any physics change means re-solving.
- `jboot` and `jknievel` carry real names, so rename them (J).

**WPA 2025 (V W)**
- Disciplines: Trick & Fancy, Special Arts, Draw Shots, Follow Shots, Bank / Kick Shots, Stroke Shots, Jump Shots, Masse Shots.
- Each difficulty 6-10 is one chosen shot, giving 40 shots in all.
- Three attempts score full value, minus 1, minus 2, else 0. Each shot can be made only once.
- A full intentional stroke counts as an attempt. Mirror images are allowed; 90-degree rotations are not.
- Lead correction: the shot is "The 92° Cut", and its value and the other three names check out. The Pinball Shot needs a cue stick, rack and chalk, so it is out.

**Proposed structure (J)**
- Seven disciplines: drop Special Arts, whose sampled shots need re-hits and moving balls (V W).
- Each discipline has slots 6-10 with WPA attempt scoring, worth 40 each, 280 overall.
- Add a `scratchOk` challenge field.
- Free practice stays unlimited and unscored.
- New key `felt.trickScore.v2`, holding `{ pts: { id: best } }`.
- Migration reads `felt.tricks` once: 3 stars becomes full value, 2 becomes minus 1, 1 becomes minus 2. It never lowers a score.
- Keep writing the old keys, because solo-check pins them. Leave `felt.trickTries.v1` as lifetime stats only.

**Candidates**
- Coordinates are (length, width) fractions. P2 = (1,0), P5 = (1,1), P3 = (0,1). "lip n" is n radii from the mouth.
- I ran a reduced sweep on 9r only (V sim). "M/N" is makes / neighbours of 17, so the jump and masse counts are not comparable to AC2's 20 makes and 5 of 63. Other table settings are untested.

| Shot | Layout and line | M/N |
|---|---|---|
| Rail First, Bank 6 | cue (.8,.5); 1 lip P2 2; 2 (.9,.25); rail, then 1, miss 2 | 506/17 |
| Cross Corner, Bank 6 | cue (.55,.5); 1 (.78,.14); bank into P5 | 66/9 |
| Three-Rail Kick, Bank 7 | cue (.3,.3); 1 lip P2 2; 2 (.62,.17); 3+ rails first | 256/17 |
| Five-Rail Kick, Bank 9 | same layout; 5+ rails | 34/15 |
| Long Stop, Stroke 8 | 1 lip P2 8; cue 40 radii back on line; stop within 8 cm | 7/14 |
| Corner Pair, Follow 9 | cue (.62,.5); 1 lip P2 1.6; 2 lip P5 1.6; follow on | 13/11 |
| Bend Back, Draw 8 | cue (.3,.5); 1 (.55,.32) into P1 or P2; draw into 2, lip P5 2 | 5/4 |
| Side Draw, Draw 7 | cue (.5,.55); 1 (.5,.2) into P1; 2 lip P3 2 | 2/3 |
| Close Hop, Jump 7 | 1 lip P2 10; cue 18 radii out, cut 20 degrees; 2 at quarter line | 8/16 |
| Jump Kick, Jump 9 | cue (.3,.35); frozen wall of three toward (.5,1); rail, then 1, lip P2 2 | 34/17 |
| Double Hop, Jump 10 | 1 lip P2 6; cue 40 out, cut 10 degrees; balls at .3 and .62 of line | 2/12 |
| Gate Masse, Masse 8 | 1 lip P2 4; cue 24 out; pair at .3, offset one radius each side | 28/14 |
| Long Masse, Masse 10 | 1 lip P2 4; cue 50 out; 2 mid-line | 56/15 |

Needs rework:
- Thin margins, so move the balls: Side Draw, Double Hop, Bend Back.
- Found only by the wrong route, so tighten the check: frozen-pair Split (4/1), Diagonal Draw (5/3), Ring Draw (10/8), Boomerang Masse (98/17).
- Dropped: Frozen Rail Cut (the 92° Cut's idea) and Three-Corner Tour, each 0 makes. Double Bank passes too trivially to keep.

## Part B: career

**Today (V code)**
- 43 generated series, about 50 events a season, 12 tiers, 5 circuits.
- 52-week points, with local reset each season. Promotion runs on form or a title, and tiers 8 and 10 need a tour card.
- Two sponsors at once, plus challenges, exhibitions, a cosmetic shop, 11 drills and a Hall of Fame.
- Screens: slots, create, hub, calendar, event, bracket, rankings, stats, records, recap, sponsors, shop, rivals, player, news, practice, options.

**Ten-season sims (V sim)**
- Five runs used three player strengths, with model matches or assumed rack wins of 72% or 88%, plus a sixth run declining challenges. None of this was live play. Save was about 90 KB at season 10.
- Every season's calendar names are identical (49/49).
- Nobody was relegated. The 72% run from tier 1 was promoted 10 times in 10 seasons.
- The top rival can be lopsided: 128-0 with auto-accepted challenges, 25-2 without.
- The shop totals 26,100 credits. The 72% run ended season 4 with 40,741 and finished at 512,398.
- The model player passed the shop total by season 8.

**Ranked changes.** All are additive. Add `upgrade(S)` in `load`, since no upgrade step exists today. Keep `S.aw` at 6 fields with discipline indices append-only, leave `genPlayer` streams alone, and keep seed 99's `dbfcdfc7`.

1. **Season-end screen (`cvAdvance`, new `PAGES.review`).**
   - Rollover shows only a status line. Show the `S.arch` row, ranks, the tier verdict and next season's targets (J).
   - Save: none.
   - Check: a career-check page test sees it once per rollover and after reload.
2. **Stakes (`rollSeason`, `finalize`).**
   - From tier 8, keep your card through a rolling two-year money list, else go to the qualifier. The model is 127 places, top 64 (V B) and WNT's two-year cycle (V N).
   - End a title's automatic promotion above tier 7.
   - Save: new `S.ml`, kept compact.
   - Check: a cold tier 9 player loses their card, and the save stays under 260 KB.
3. **Calendar variety (`instEvent`).**
   - Per-season host city, prestige swings and one-off events, using a new seed name and no new draws from `genSeries`.
   - Save: ids stable, `S.ser` untouched.
   - Check: two seasons differ, a pre-change save loads, the fingerprint holds.
4. **Tour-card bug (`Career.me`, `PAGES.hub`).**
   - `me()` overwrites `card` with `cardOf`, so the page cannot read the tour card.
   - Seed 23 stayed at tier 9 for two seasons with 3 titles each, likely for this reason (not traced).
   - Expose `tourCard` and add a hub row.
   - Save: none. Check: career2 asserts the number.
5. **Rivals (`rivalScore`, `rivalList`, `matchOffer`).**
   - Rank by closeness and tier gap, retire dead rivalries, and cap challenges per season (J).
   - Save: `S.h2h` unchanged.
   - Check: a 25-2 opponent is not the top rival.
6. **Sponsors (`sponsorOffers`, `closeContract`).**
   - The retainer's rep factor caps at 300 and rep never falls, so it stops mattering by season 2 (V sim).
   - Scale on the last 26 weeks and add renewals. Raising a profile to attract sponsors is Dirt 4's model (V D); "recent results" stays J.
   - Save: optional fields on contracts.
   - Check: same tier, cold form offers less.
7. **Performance rating (`bookMatch`, `nextMatch`).**
   - The career shows AI ratings up to 89 while the 72% run's skills average 53.
   - Add a rack-based `S.me.fr` and an odds line. `playModel`'s 2:1 sits at 7.6 rating points (V code), so multiply by about 13 for Fargo's 100 points (V F).
   - Check: 2:1 at 100 points.
8. **Money sink (`SHOP`, page shop).**
   - Append cosmetic prestige tiers and venue ownership that hosts your own event (J). `effect` stays `'none'`.
   - Save: `S.inv` additive.
   - Check: cosmetics-check and `pay()` accounting.
9. **Press and invitation lists (`news`, `eligibility`).**
   - Template lines from `S.arch` and `S.h2h`. Add a one-year invitation list like WNT's Mosconi and Masters lists (V N).
   - Save: news shape unchanged, derived from `S.ml`.
   - Check: a season produces a rival headline.

Scripts: `/private/tmp/claude-501/-Users-zacker-dev-felt/26553d1b-8626-47bf-9525-5c7f186d0436/scratchpad/aps-sim/career.cjs`, `/private/tmp/claude-501/-Users-zacker-dev-felt/26553d1b-8626-47bf-9525-5c7f186d0436/scratchpad/aps-sim/career2.cjs`, `/private/tmp/claude-501/-Users-zacker-dev-felt/26553d1b-8626-47bf-9525-5c7f186d0436/scratchpad/aps-sim/shots.cjs`. Nothing in the repo was edited.

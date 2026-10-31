# Spec: T5 jump and massé trick shots

**id:** T5   **status:** accepted
Extends `.buildloop/spec/T2.3-solo.md` (trick shots). The owner asked for "a bunch of trick shots now that involve
jumping like the famous Massie in a boot". This records what the research found, what was built from it, and what was
adapted or left out.

## Research

Web search only: the session's network allowed search results but not page fetches (azbilliards.com, trickshottim.com,
en.wikipedia.org and billiards.colostate.edu all failed to resolve), so everything below is from search-result text
and should be read as such.

- **"Massie in a boot" is Mike Massey's boot shot.** Mike Massey ("Tennessee Tarzan", ESPN Trick Shot Magic champion
  2000, 2001, 2003 and 2004, BCA Hall of Fame 2005, Artistic Pool Hall of Fame 2024) won his third World Snooker
  Trickshots title with a closing shot that sent the cue ball through the air into a cowboy boot about 15 feet away.
  A fan report of a live show also names "the boot shot" in his routine. No source found gave its full setup.
  Sources: https://azbilliards.com/?p=33748 (AzBilliards, "Massey Takes Third Trickshots Title"),
  https://forums.azbilliards.com/threads/mr-mike-massey.16277/post-175600, https://en.wikipedia.org/wiki/Mike_Massey.
- **Massey's other named shots.** "Massey's Zigzag", invented for the ESPN trick shot events, is listed as a bank and
  kick shot, not a massé (https://www.trickshottim.com/shot_tutorials/massey_s_zigzag). His book is
  "Mike Massey's World of Trick Shots"; a forum post recalls him playing a jump massé straight back.
- **WPA Artistic Pool.** Eight disciplines (trick and fancy, special arts, draw, follow, bank and kick, stroke, jump,
  massé), each with shots at degrees of difficulty 6 to 10. The 2024 program's examples include Jump 4B "The Evel
  Knievel Shot" and Massé 4A "The Jump Massé"; the older program's massé list includes the Vertical Jump Massé, the
  Out of the Rack Massé (the cue ball escapes a rack), a rebound massé and the Mingaud Massé (a sharp turn round a
  piece of chalk). Sources: https://www.wpa-apd.org/_files/ugd/3837b8_822bb38b1b5b447d9740a4c5934c3a48.pdf,
  https://trickshottim.com/learn/15-pro-masse-pool-trick-shots, https://en.wikipedia.org/wiki/Artistic_billiards.
- **The Evel Knievel shot.** Brian "Superman" Pauley's version: the cue ball leaps a row of seven balls (the stuntman's
  cars), then a ball drops in a side and another in a corner. https://www.mcdermottcue.com/blog/category/videos/brian-superman-pauley-trick-shots/
- **Mingaud.** Captain Francois Mingaud, credited with the leather cue tip, the first professional exhibition player
  (Byrne's Treasury of Trick Shots); the Mingaud massé carries his name. https://pooltableportfolio.com/blogs/magazine/shot-anatomy-the-masse-shot-a-historical-technical-analysis
- **Rail and escape massés.** Trick-shot tutorials describe a massé along the short rail round one blocker (and a
  longer-rail version round two), and the escape massé: the cue ball sandwiched between the rail and an object ball,
  massed out without moving it. https://www.trickshottim.com/shot_tutorials/escape_masse,
  https://trickshottim.com/learn/seven-beginner-masse-trick-shot-video-tutorials
- **Florian "Venom" Kohler.** Three-time WPA world jump champion and Guinness record holder (highest jump shot on a
  moving ball, 86 cm; most balls potted into the side over an obstacle in a minute). His "coin in the glass" jumps a
  coin off the cushion into a glass. https://www.guinnessworldrecords.com/news/2017/4/pool-trick-shot-tutorial-billiards-pro-florian-kohler-shows-you-how-to-execute-r-469517
- **Dr Dave Alciatore.** His jump-shot resource (billiards.colostate.edu, the jump FAQ and "Jump Shots Made Simple",
  Billiards Digest Oct 2023) is the source of the sim's slate restitution (E_SLATE 0.5, sim 1a); his VEPS trick and
  proposition shots (NV B.87 to B.93) are listed in Billiards Digest May 2011. https://billiards.colostate.edu/bd_articles/2011/may11.pdf

## Props the sim cannot model

The sim has balls, cloth, cushions and pockets only. Left out or adapted:

| Shot | Prop | Here |
|---|---|---|
| Massey's boot shot | a cowboy boot on the floor | Adapted: Massey's Boot. The marked corner is the boot; two guard balls stand one behind the other in front of its mouth, so only a cue ball in flight gets in, touching nothing. |
| Jump over a cue on the rails (WPA jump shots) | a cue laid across the rails | Adapted: Over the Wall, a wall of three frozen balls across the line. |
| Evel Knievel | none (balls only) | Kept: a row of four balls on the line (seven does not fit a 7 ft table's flight); one object ball, not two. |
| Mingaud massé | a piece of chalk to turn round | Adapted: a ball on the line in place of the chalk. |
| Out of the Rack massé | a rack | Left out (the rack is a prop; the escape massé keeps the idea). |
| Coin in the glass | a coin, a glass | Left out: no coins, no glasses. |
| Jump massé (WPA 4A) | none | Left out: in this sim a massé jumped high enough to clear a ball lands with too little curve left for a margin. |

## The pack

Group `'jump'` in `TRICKS` (sim 1h), after the 14 classics, listed under its own head "Jump and Massé". Each has a
level (easy, medium, hard: from the solver's margin and the shot's demand), an elevation for the hint, in whole degrees
as the pad sets it, and a sweep (the solver's elevations and tips). `jumped(r, n)` reads `r.over`, `curveWhy` refuses a
curve that went over its blocker or off a rail first (`r.kick`).

| id | Title | What | Level |
|---|---|---|---|
| jhop | Jump Shot | jump one blocker, pot the 1 in the corner | easy |
| jwall | Over the Wall | jump a frozen wall of three | medium |
| jknievel | Evel Knievel | clear a row of four in one jump | hard |
| jbank | Jump and Bank | jump the 2, bank the 1 in any pocket | hard |
| jswerve | Half-Ball Swerve | swerve round a ball covering half the 1, no rail first | hard |
| jmingaud | Mingaud Massé | massé round a ball on the line, no rail first | medium |
| jrail | Rail Massé | out round a ball frozen to the rail and back along it | easy |
| jescape | Escape Massé | out from between the rail and the 2 without moving it | easy |
| jboot | Massey's Boot | the cue ball in flight into the corner, over two guards | medium |

The boot shot is the only goal that pots the cue ball (`cueIn`): its own pocket is no scratch; any other is.

## Contract additions

- **Sim (1h).** Challenge fields `group`, `level`, `elev`, `sweep { e, tips }`, `cueIn`; helpers `cut(p, k, deg, d)` and
  `rail(fx, gap)`; `TRICK_GROUPS`, `trickGroupOf`, `TRICK_LEVELS`, `trickHint(c)` ("Raise the cue to about N°.").
  `TRICK_SOLS` entries of the group carry a fifth field, the elevation in degrees; `trickSol` turns it into `spin.e`.
  The daily shot draws from the classics only (`DAILY_TRICKS`).
- **Solver.** `tools/trick-solver.cjs` searches a challenge with a sweep over every angle (1 deg), power (0.2 to 1 by
  0.04), its elevations and tips, counts the makes, ranks by neighbours (0.1 deg, 0.02 power, 1 deg) and writes the
  margins to `tests/trick-solutions.json`'s `margin` table. The classics' search, and their stored solutions, are
  unchanged.
- **Page (5s).** The list's groups (`.tgroup`, a `.ghead` over a `.tgrid`), the level on each card, the hint in the
  start banner and the pause menu, and the elevation tip (`#elevTip`): the first jump or massé challenge ever opened,
  once, stored as `felt.elevTip.v1` `{ v: 1, seen }`; `tests/lib.cjs` marks it seen unless `firstRun: true`.
  `felt.elevTip`, `felt.airNow` (the roll's ball heights) report it.

## Acceptance

AC1. 8 to 12 challenges, named for the real shots where public, each graded, each with a one-line goal and an elevation
hint | jumptricks-check
AC2. Every one has a stored solution on all four table settings, found by the solver, that makes it, fails level,
and has at least 20 makes in the sweep and 5 of 63 neighbours making it | jumptricks-check
AC3. Through the live page each stored solution equals simulateShot byte for byte; Show me works; stars by tries;
the tip shows once | jumptricks-check
AC4. The classics, their stored solutions and the daily rotation byte-identical | jumptricks-check, solo-check
AC5. All suites, lint 0, no em dashes, Title Case, 44 px, 4.5:1.

# Spec: T4 career engine (persistent multi-season career, logic and persistence)

**id:** T4-career   **status:** accepted (engine wave; the screens are the UI stream's)
Extends `.buildloop/spec/T2.1.md`: the career engine is a second DOM-free region, owned by this
stream, loaded with the sim by `tests/sim.cjs`. The 6d ladder (`felt.career.v1`) keeps working
until the UI stream replaces it.

## Summary

`// #region career` ... `// #endregion career` sits right after the sim region in
`<script id="game">`. It defines one global, `Career`, a closure over the live career `S` (the
exact object that is saved). It uses the sim's `rng` (mulberry32) and `CPU_LEVELS`; no DOM, no
clock, no `Math.random`. Every chance is `rng(seedOf(seed, ...names))`, so a career is a pure
function of its seed and the player's actions, whatever is read in between and however often it
is saved and loaded. Time moves only in `Career.advance` (and `rest`).

## Requirements

R1. Profile: name, nick, nationality, hometown, avatar `{ ini, col }`, hand, preferred cue (a shop
    cue id), preferred discipline, style, difficulty, start (`novice | amateur | skilled | pro`),
    age. `editProfile` changes only `S.profile` (start and age stay; it throws if anything else
    changed). Untrusted input falls back field by field (`cleanProfile`).
R2. Population: 300 active AI from `genPlayer(seed, id)`: 18 nationalities with built-in name and
    city lists (names distinct), age, peak and retirement ages, talent, archetype (9), preferred
    discipline, attributes `acc cb brk safe bank tac agg con pres` (1-99) that follow an age curve.
    Stored per player only: `S.pop.m[id] = { t tier, d debut season (later generations), x retired
    season, w, l, ti titles, fi finals, lg legacy, tl [[season, series, tier]] }`.
R3. `aiProfileOf(player | id | attrs, difficulty)` -> `{ breadth, aimNoise (rad), powerNoise,
    safetyBias, riskTolerance, positionWeight, bankWeight, hillNoise, breakChoice { power, style },
    level }`; `levelOf(knobs)` -> the nearest `CPU_LEVELS` key (log aim noise, breadth as a tiebreak),
    so `cpuSearch(g, seed, level)` works today. Exposed as `Career.aiProfileOf` / `Career.levelOf`
    (the page's 6d already has a `levelOf`).
R4. Tiers 1-12 (`Career.TIERS`): Local Amateur, Club Player, League Regular (local circuit), City
    Contender, Regional Competitor (regional), National Qualifier, National Contender (national),
    Tour Rookie, Touring Pro (pro), International Pro, World Elite (international), Hall of Fame
    (Legacy). Season end: up on a title at or above your tier, or the top 15% of your tier by form
    (points per ranking event played, at least 3) with a winning record; down on the bottom 40% by
    form with under 40% wins (4+ matches), or a season without a match at tier 4+. Tiers 8 and 10
    need the tour card from the tier 7 / tier 9 qualifier. Tier 12 only by the Hall of Fame. AI:
    the same form measure (or a rating far outside the tier band) proposes a move; the tier quotas
    `44 38 34 30 28 26 24 22 20 18 16` are then filled from the top.
R5. Formats: `single`, `double` (losers bracket, grand final with reset), `rr`, `groups` (snake
    seeded groups, top two to a knockout where winners meet other groups' runners-up), `league`
    (double round robin, weekly), `series` (best of N legs), `qualifier` (knockout to N places).
    Kinds: open, league, qualifier, championship, major, invitational, finals, challenge,
    exhibition. Seeding by circuit points then rating; byes to the top seeds.
R6. Event data (calendar): `{ id 'season.series.edition', ser, ed, name, city, venue, nat, kind,
    fmt, tier, circ, disc, pres (prestige 40-100), start, end, dl (deadline), fee, trav, purse,
    size, race, pts, groups?, slots?, card?, tgt?, legs?, opp?, req { min, max, qual?, top? },
    rules }`. `rules` is the shape the rules stream will consume:
    `{ game: '8'|'9'|'10'|'straight'|'rotation'|'snooker'|'carom'|'bumper', ruleset (Career.RULESETS id),
    call: { require: 'off'|'8ball'|'official'|'all', detail: 'ball'|'pocket'|'rails'|'strict' },
    race, table ('7'|'9'|'compact'|'full'|'carom'|'octagon'), pockets ('generous'|'regulation'),
    custom? (label) }`. Calls: tiers 1-2 relaxed (8-ball: the 8 only), leagues from tier 3 call
    everything, tier 6+ pool official, straight pool always called, snooker/carom/bumper `off`,
    the tier 11 elite invitational `all/strict` and labelled custom.
R7. Calendar: 43 series generated once (`S.ser`), instanced every season (`S.cal`, about 50
    events): weeks 2-48, second editions half a season later, leagues ten weekly nights from weeks
    3-10, qualifiers 3 weeks before their target, card qualifiers weeks 40-43, finals week 50,
    weeks 51-52 off. Occupancy `occ(ev)` (a league: its match nights); entering refuses a clash.
R8. Time: `advance(days | 'week' | 'season' | 'event' | { days })` steps a day at a time: season
    rollover, the weekly tick (retainers, contract ends, offer expiry, rank history, rival and
    exhibition invitations), draws of events that start, AI matches due by today (model, seeded by
    event and match), finished events. It stops on a due match of the player's (or forfeits it
    with `{ forfeit: true }`). Results, once in `S.es[id].r`, are never recomputed.
R9. Rankings: awards `[id, circ, disc index, pts, global week, season]` at each event's end.
    Circuits 1-4 count 52 weeks; local (0) counts the current season only; `'d:<disc>'` 52 weeks
    over every circuit; `'season'`. Movement against a week ago, history, best ranks, `toDefend`.
R10. Rivals: `S.h2h[id] = [won, lost, finals won, finals lost, upsets, upset by, close, streak,
    last season]`; rivalry score; objectives for the top three (cooldown 8 weeks); a challenge
    invitation when a rivalry is hot.
R11. Skills `aim power brk pos spin banks safety tactics pressure` grow slowly from matches and
    drills; they drive the model in auto-resolved matches. In live play they change only what
    `assist()` returns (`SKILL_EFFECTS`): guide length, auto aim, bank guide, safety hint and
    execution jitter (aim, power, break, spin, hill multiplier). Simulation purity (default on for
    hard and pro, or `experienced`) makes `assist()` neutral: skills are record only.
R12. Economy (credits only): fees, travel, purses paid by place (shares normalised to the places
    filled; the payouts add up to the purse exactly), sponsors (offers with objectives, 26 or 52
    weeks, weekly retainer, rewards, a bonus for all met; two at once, one per category), rivalry
    rewards, a cosmetics-only shop (`effect: 'none'`). Every credit goes through `pay()`;
    `money = start + prize + spons + refund + reward - fee - travel - shop`.
R13. Stats with explicit denominators (`{ n, d, pct }`): matches, W/L, racks, titles, finals,
    events, prize, break and run (of breaks), legal break (of breaks), runout (of racks reported),
    shot accuracy, called shot, safety; fouls, scratches, streaks; overall and per discipline. A
    report's racks count only if they agree with the score; shots are clamped (made <= tried).
R14. Long term: aging, AI retirement (retire age, or a slide at the bottom), a new generation to
    keep 300 active, the Hall of Fame (legacy 1500: titles weigh tier squared by prestige),
    the player's retirement with a recap; a retired slot is read only; a new career in a new slot.
R15. Persistence (below). Storage after ten auto-played seasons: one save about 125 KB, the whole
    store (save, backup, index) under 260 KB.

## Persistence

- `felt.careers.v1`: `{ v: 1, n (slot counter), slots: [{ id, name, nick, season, week, tier,
  tierName, retired, hof, seq, bytes }], active, v1 (the slot migrated from v1) }`. Six slots.
- `felt.career.v2.<id>`: `'F2|' + fnv1a32(json).toString(36) + '|' + json.length + '|' + json`.
  `.tmp` and `.bak` beside it.
- Save: write `.tmp`, read it back; copy the current main (if valid) to `.bak`; write main, read it
  back and unpack it; drop `.tmp`. Any failure leaves the last good save as main.
- Load: main, else `.tmp`, else `.bak` (checksum, length, JSON and `validate` shape), restoring
  main from what loaded and saying so (`recovered`).
- Migration: `migrate(profile, o)` copies `felt.career.v1` to `felt.career.v1.bak` (once), never
  touches v1, makes a slot: tier 2 at five players beaten, 3 at all eight; reputation 12 per player
  beaten + 2 per match won; credits 25 per beaten; the record as `S.legacy` (`stats().legacy`).
  Idempotent. `Career.boot(localStorage)` (page section 7) makes the backup at boot.
- Autosave: `reportMatch` and `advance` save at the player's match, event and season boundaries
  (`setAutosave(false)` stops it); `autosave(kind)` for the UI.

## API (`Career`)

`useStore(store)`, `boot(store)`, `setAutosave(on)`, `create(profile, { seed, slot, save })`,
`load(id)`, `save()`, `autosave(kind)`, `listSlots()`, `deleteSlot(id)`, `migrate(profile, { seed, force })`,
`close()`, `loaded`, `id`, `profile()`, `editProfile(patch)`, `now()`, `me()`, `calendar()`,
`availableEvents()`, `event(id)`, `eligibility(id)`, `enter(id)`, `withdraw(id)`, `nextMatch()`,
`reportMatch({ score, racks?, shots?, forfeit?, event?, match? })`, `simMatch()`, `advance(to, { forfeit })`,
`rest(days)`, `schedule()`, `bracket(id)`, `standings(id)`, `rankings(circuit, { top })`,
`rankHistory()`, `toDefend(weeks)`, `rivals()`, `headToHead(id)`, `objectives()`, `stats(disc?)`,
`records()`, `sponsors()`, `offers()`, `accept(id)`, `decline(id)`, `shop()`, `buy(id)`, `equip(id)`,
`practice(drillId, score)`, `assist()`, `setOptions({ purity, variance })`, `ledger()`, `news()`,
`player(id)`, `population({ all })`, `aiProfileOf`, `levelOf`, `retire()`, `recap()`, `snapshot()`,
`digest()`, data tables (`TIERS`, `CIRCUITS`, `GAMES`, `RULESETS`, `FORMATS`, `SKILLS`,
`SKILL_EFFECTS`, `DRILLS`, `SHOP`, ...), and `lib` (pure pieces for tests: `makeBracket`,
`runBracket`, `placings`, `standings`, `playModel`, `payouts`, `pack`, `unpack`, `validate`, ...).

`nextMatch()` -> `{ event, eventName, match, round, final, day, opponent (card), ai (knobs), level,
race, rules, breaker (0: the player breaks first), h2h }`. The page plays it and calls
`reportMatch({ score: [mine, theirs], racks: [{ won, broke, legal, bnr, runout }], shots: { att,
pot, calls, callsOk, safe, safeOk, fouls, scratches } })`; `score` is in `rules.race` units.

## Acceptance criteria

AC1. `node tests/run-all.cjs --only career2-check` passes (determinism, profile, population, knobs,
     every format, calendar data, registration, accounting, time, rankings, seasons, sponsors,
     practice and shop, stats, rivals, Hall of Fame, retirement, ten seasons with save and load
     after every event, migration, corruption, slots, the page boot) in under 60 s.
AC2. `npm run lint` 0 findings; the region contains no clock, unseeded randomness, DOM or localStorage use.
AC3. `career-check` (the 6d ladder) still passes.

## Ordering surface

persistence: the write order of `.tmp`, `.bak`, main (each read back) is the atomicity argument;
state-machine: event `{}` -> `{ en }` -> drawn `{ f, r }` -> `{ done }` (or `{ x }` cancelled).

## Deferred

The screens (UI stream). Wiring `rules` to the rules stream's RULESETS and called-shot API, and
the 10-ball / straight / rotation games (`GAMES[d].live` is false for them). AI-to-AI rivalries
(only the player's head to head is kept). Fatigue and travel time.

## Rejected alternatives

Storing the population (300 records each save): the seed regenerates them. Storing every match
of past seasons: a season's brackets go at rollover, champions and summaries stay. Keeping
`levelOf` as a top-level name: it collides with the 6d ladder's `levelOf`.

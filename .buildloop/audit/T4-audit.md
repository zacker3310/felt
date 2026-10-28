# T4 audit: felt against the overhaul brief

Base: `claude/funny-hawking-dq4ysj` at 22c6d4f (build 2026-10-28a), `index.html` 9038 lines, 15 suites,
1216/1216 checks green, lint clean. Audited by reading every section of `index.html` (sim 1a-1l, audio,
view and camera, render, play, solo, HUD, lesson, tutorials, career, boot) and every suite, then measuring
the sim in Node and driving the page in Chromium at 440x956, 375x667, 956x440 (touch, dpr 2-3) and
1280x800 (mouse). Scripts and screenshots of the session were kept out of the repo; the checks that
matter are now `tests/audit-check.cjs` and `tests/stress-check.cjs`.

Owner streams: **audit-fix** (this stream), **rules** (stream A: rules engine, variants, called shots),
**career** (stream B: career engine, persistence of career), **ai**, **ui**, **settings**, **perf**,
**later** (not scheduled). Status: **fixed** (with its regression check), **open**, **verified** (measured
and fine, kept for the record), **design** (a choice for the owner, not a defect).

## 1. Findings, by priority

P0 critical correctness, P1 essential, P2 important, P3 should, P4 polish, P5 note.

No P0 was found: no crash, no corrupted save, no broken game flow, no physics integrity failure
(no NaN, no tunnelling, no ball left inside a cushion, determinism exact) in any of the runs below.

| # | Pri | Area | Finding | Evidence (repro, measurement) | Owner | Status |
|---|---|---|---|---|---|---|
| F1 | P1 | render/frame timing | One exception inside a frame stopped the game for good: `frame()` re-queued `requestAnimationFrame` only as its last statement, so any throw (a canvas call with a bad value, a stale DOM node) froze the table mid-roll with no way out but a reload. | Make `draw` throw once mid-roll: base build stays `rolling` forever (`{"thrown":1,"state":"rolling"}`). Found a live trigger while testing: `drawFx` drew `arc` with a negative radius whenever an effect's age went negative (`IndexSizeError`), which a frame clock that ran backwards produces. | audit-fix | fixed: `frame()` wraps `frameBody()` and always asks for the next frame, the error still goes to the console; `dtMs` clamped to [0, 50]; effect age clamped to [0, 1]. `audit-check` A1 |
| F2 | P2 | frame timing | The live roll ran slow on high-refresh screens: steps per frame were `Math.round(dt / SIM_DT)` per frame with no carry, so 144 Hz gave 8 steps for 8.33 (4% slow motion), 90 Hz 2.5%, 165 Hz 3.7%. Results were unaffected (fixed steps), only the pace. | 144 frames at 1000/144 ms: base advances 0.960 s of sim, fixed 1.000 s. | audit-fix | fixed: `simSteps()` carries the fraction. `audit-check` A2 |
| F3 | P2 | exploit, persistence | The daily shot's "first try counts" could be dodged: the day was scored in `settleSolo`, so pausing mid-roll and quitting (or Restart) left the day unscored and the next try was a fresh first try. | Daily, shoot, pause while rolling, Quit, Daily again: base `scored: true` again, `dailyRec.last` null. | audit-fix | fixed: scored when the try is struck (`shoot`), the make recorded at rest (`daily.live`). `audit-check` A3 |
| F4 | P3 | persistence | A daily record whose `last` day lies in the future (a clock set forward then back, a bad record) froze the streak on show (`streakNow` 500) and made every later day unscorable until that date (`gap <= 0` returned early). | `{"last":"2099-01-01","streak":500}`: base shows 500 and never scores. | audit-fix | fixed: a future `last` is no streak; scoring starts a new streak of 1, the best kept. `audit-check` A4 |
| F5 | P2 | exploit, stats, career | Restart or Quit while losing records nothing: a game vs the CPU abandoned mid-rack never counts as a loss (win streak and per-level record farmable), and a career rack can be restarted from the pause menu with no penalty. | Pause, Restart in any CPU game: `felt.record` unchanged; in a career match `careerRack()` replays the rack, `career.score` unchanged. | career | open: needs a forfeit rule (abandon = loss, or only after N shots) decided with the owner |
| F6 | P2 | rules | Missing rules for the existing pool games: 8-ball legal break (four balls to a rail, else re-rack or opponent's option), three-foul rule and stalemate in 8-ball, 9-ball push-out after the break, WPA options after a break foul, jumped balls (the sim's escape fail-safe pots an escaped ball into the nearest pocket, `stepTable`, though 2340 stress shots and 600 max-power breaks produced none), 8 on the break options. Snooker (in code comments): free ball, miss rule, put back in. | `judge()` 1e; `judgeSnooker()` comment "Not implemented (yet)". | rules | open |
| F7 | P2 | a11y | A keyboard-only or switch user cannot play: no key may shoot (owner's rule, enforced by play-check) and the bar needs a pointer drag. Aim, english and ball in hand all work from the keyboard. | `keydown` handler, section 5: "No key ever shoots". | settings | design: an accessibility setting (off by default) could let Space/Enter on a focused power bar shoot at the marked power without breaking the owner's rule for everyone else |
| F8 | P3 | ai | CPU levels differ only in search breadth and aim/power noise; no archetypes, no bank or combination pots proposed (only found by accident through safeties/kicks), coasting estimate after 4 s of simulation (`CPU_T`). Hard thinks long: in Node (desktop) 8-ball max 440 ms, snooker 843 ms, carom 372 ms per shot; on a phone expect 3-5x, spread over frames in 12 ms slices so no jank but a visible wait. | `cpuSearch` 1f; `CPU_LEVELS`; measured with `cpuShot` over whole CPU-vs-CPU games. | ai, perf | open |
| F9 | P3 | physics | A ball whose speed falls under `STOP_V` with no cloth slip has its side spin zeroed in that step: a stationary ball cannot spin in place. Visual mostly, but a ball later struck while spinning would throw differently. | `newBall`, `wz = 30`, no velocity: `stepTable` returns rest on the first step. | later (physics) | open: changing it moves the trick and tutorial solutions (re-solve with the tools) |
| F10 | P3 | physics calibration | Side spin decays at a constant 8 rad/s^2 (`SPIN_DECAY`): full english at 3 m/s (157 rad/s) would last 20 s. pooltool's default spinning friction gives about 38 rad/s^2. Worth a measured calibration pass, with the trick solutions re-solved after. | `SPIN_DECAY`, 1a. | later (physics) | open |
| F11 | P3 | lifecycle | No `visibilitychange` handling: a hidden tab is simply frozen by the browser (state is safe, the 50 ms frame cap stops a jump), but the game does not pause itself and the audio context is never suspended. | grep: no `visibilitychange` in the page. | ui | open |
| F12 | P3 | exploit | Trick shots' "three stars on the first try" restart from zero attempts whenever a challenge is reopened from the list, so three stars are always one reopen away; the daily's Show me before the first try reveals the solution and the first try still counts. | `startTrick(id)` without `again` makes a new session; `showMe` sets `demo`. | ui | design |
| F13 | P3 | perf | The frame cap (`dtMs` at most 50 ms) means a device under 20 fps plays the roll slower than real time. Measured at dpr 3 with 22 snooker balls in headless Chromium: median 16.7 ms, p95 16.8 ms (60 fps); memory over 200 practice shots stays bounded (7.4 MB to 10.3 MB, undo capped at 60). | perf probe (rAF intervals, `performance.memory`). | perf | verified, keep watching on real phones |
| F14 | P4 | audio | `finish()` plays the win sting when the CPU wins too (the sheet's mood is "quiet" but the sound is the same). | `finish()`, section 5. | ui | open |
| F15 | P4 | persistence | `DAY_RE` accepts impossible dates (`2026-13-45`), which `Date.UTC` wraps. Harmless after F4. | `loadDaily`. | audit-fix | fixed: `realDay()` drops a date that names no real day. `audit-check` A5 |
| F16 | P5 | render | The last banner ("Player 2 to shoot") stays visible, dimmed, behind the pause sheet in landscape. | 956x440 pause screenshot. | ui | open |
| V1 | - | physics | Ball-ball head on, rolling ball at 2 m/s: momentum kept to 4e-5, cue ball keeps 0.062 m/s (restitution 0.94), object 1.938 m/s. | measured | - | verified |
| V2 | - | physics | Cushion: rebound speed ratio 0.80 at 0.5 m/s, 0.83 at 1, 0.82 at 2, 0.79 at 3, 0.73 at 5, 0.70 at 8 m/s (rolling ball square into the rail): falls with speed as measured cushions do. | measured | - | verified |
| V3 | - | physics | Slide to roll: a centre hit at 2.75 m/s rolls at 0.7143 of its speed after 0.948 m and 0.4017 s; theory 5/7, 12 v^2 / (49 mu g) = 0.948 m, 2 v / (7 mu g) = 0.4015 s. | measured | - | verified |
| V4 | - | physics | Throw on a 30 degree cut: 2.6 deg at 0.53 m/s, 1.25 deg at 1.27 m/s, 0.3 deg at 3.7 m/s (Alciatore's ball-ball friction fit); squirt 1.49 deg at full side. | measured | - | verified |
| V5 | - | physics | Tunnelling and escape: 600 random max-power (0.9-1.0) breaks with random spin on 7 and 9 ft, and 2340 mixed shots across all nine table setups: no escape, no NaN, no overlap at rest, longest roll 11.1 s, top speed 8.43 m/s. Pocket capture straight in: corners from 1 to 8 m/s, along the rail 0.5 to 6 m/s, sides 0.5 to 8 m/s. | measured, now `stress-check` | - | verified |
| V6 | - | determinism | Same shot, same JSON after any table change; CPU games replay identically from their seeds; live roll equals `simulateShot` (play-check). Frame rate only changes pacing (F2). | `stress-check`, play-check | - | verified |
| V7 | - | game flow | Pause mid-roll then quit then a new game; start() while rolling; replay during the CPU's turn; pause while the CPU thinks then Restart; a rotation in the middle of an armed bar pull (cancels, nothing fires); forceWin mid-roll; 30 rapid taps across every sheet: always a known state, no console error. | browser probes, now `stress-check` | - | verified |
| V8 | - | persistence | Thirteen kinds of corrupt record in all eight keys (bad JSON, wrong types, other versions, prototype pollution, huge names, out-of-range numbers), a storage that throws on every access and a full storage: boots, every screen and game works, nothing reaches the console, no pollution. | now `stress-check` | - | verified |
| V9 | - | mobile layout | All five games and all sheets at the four viewports: no page scroll, controls and table on screen, targets 44 px. | browser sweep | - | verified |
| V10 | - | termination | CPU against CPU: 206 racks (8 and 9 easy and medium, both bumper tables, one-cushion carom, snooker) all end, longest 132 shots; hard level ends too (10 games). | now `stress-check` | - | verified |

## 2. Gap analysis against the brief

### Physics (realistic deterministic physics)
- **Exists:** fixed 1/1200 s step, full spin vector per ball, closed-form slide to roll (`cloth`), rolling resistance per table (`POOL_PHYS`, `SNOOKER_PHYS`, `CAROM_PHYS`, `physOf`), restitution falling with impact speed and nose height (`rail`, `noseSlip`), cut and spin throw (`hitBalls`), squirt (`strike`), WPA-faced jaws, shelves, lips, side-pocket skim, rounded snooker jaws (`roundJaws`), escape fail-safe, rest detection, 60 s timeout. Verified above (V1-V6).
- **Partial:** spin decay constant and stationary spin (F9, F10); cue elevation absent, so no masse and no swerve beyond squirt.
- **Missing:** jumped balls, ball-cloth nap, cushion height variation, cue-tip miscue (only `TIP_MAX` caps the offset).
- **Limits of the 2D top-down model, decided:** *Masse* is feasible without a new dimension: the cloth model already curves any ball whose spin has a component about its line of travel (measured: 1.5 m/s with 80 rad/s about the travel axis bends 0.33 m over a metre). A cue-elevation input (0-60 deg) feeding `strike` with that spin component (and less forward speed) gives true masse curves through the existing physics. *Jump shots* need a vertical state: a ballistic z (height, vz) for an airborne ball, skipped by `hitBalls` while above a ball's height and landing with a bounce, would be a contained addition but touches every collision; propose behind a flag after masse, never by default in 8/9-ball. Ball hop on the break and cushion "climb" are out of scope.

### Rules engine (8, 9, 10-ball, 14.1, rotation, practice, tricks; push-outs, three-foul, re-spots, safeties, stalemates)
- **Exists:** `judge` for 8 and 9 (open table, groups, kitchen rule with `crossed`, 8 spotted on the break, 9 re-spotted on a foul, three fouls in 9-ball with `twoFouls`), `judgeBumper`, `judgeSnooker` (frames, re-spotted black, concession), `judgeCarom` (one and three cushion), `practiceJudge`, `trickJudge`, `tutJudge`; `judge` never mutates.
- **Partial:** see F6. Safeties are played by the CPU but there is no "called safety".
- **Missing:** 10-ball, straight pool 14.1, rotation, push-out, break legality, 8-ball three-foul and stalemate, called shots, a modular rule-set table (rules are `if` chains per kind). All stream A.

### Called-shot system
- **Missing entirely** (no call UI, no `judge` input for a called ball and pocket; `TUT_SOLS` and trick `pocket` only mark pockets on the canvas). Stream A. The canvas already marks a pocket (`drawSolo`, the hint ring), which the call UI can reuse.

### Career
- **Exists:** an eight-player ladder in three tiers (`CAREER`, 6d), races, rack and match sheets, `felt.career.v1` with validation.
- **Missing:** seasons, tournaments, brackets, rankings, population with attributes and archetypes, rivalries, calendar, economy, sponsors, stats and records beyond `careerRec`, legacy, multiple slots, forfeits (F5). Stream B.

### AI
- **Exists:** simulate-and-score search per game (`cpuSearch`, `cpuBumper`, `cpuCarom`, snooker variant), aim correction from measured throw, ball-in-hand search, safeties and kicks, safety-loop breaker (`cpuDryCost`), deterministic seeds, three levels.
- **Partial:** levels are breadth and noise only (F8); position play is a one-shot lookahead on hard.
- **Missing:** archetypes (safety player, shot maker, banker), multi-shot planning (run-out patterns), bank and combo proposals, pressure or form. Stream ai.

### Game modes
- **Exists:** quick play (five games, two players or CPU), career ladder, practice (four layouts, undo, edit, ball in hand), 14 trick shots with stars, the daily shot, lesson, five tutorials, local two-player.
- **Missing:** tournament mode, challenges beyond tricks, AI exhibition (CPU vs CPU spectating: the engine plays it fine, `stress-check` proves termination; it needs only the page to drive both turns), online play (out of scope, offline by design).

### Settings, menus, HUD
- **Exists:** guide, auto aim, camera, sound, haptics, cloth, table size, pockets, bumper and snooker tables, carom race and cushions, names, CPU level; home, setup, stats, how to play, pause, game over, career sheets; HUD chips, scoreboard, callouts, replay.
- **Missing:** controls settings (power sensitivity, wheel rate, left-handed layout), graphics (quality, reduced effects), audio volumes, accessibility settings (F7, colour-blind ball marks, text size), career settings (rules locks), a versioned settings schema with migration (only `camV` is a version stamp). Stream settings.

### Mobile UX
- **Exists and verified:** one-screen layouts either way up, 44 px targets, measured contrast, aim feel tuned and pinned (`aim-check`), bar-only shooting, iOS sizing fixes.
- **Open:** F11 (auto-pause when hidden), F16.

### Audio, animation, accessibility
- **Exists:** synthesised audio bus with limiter, haptics, reduced motion honoured in CSS and `reducedMotion()`, live region for the status line, canvas label.
- **Open:** F7 (keyboard play), F14, no spoken description of the table state.

### Persistence
- **Exists and verified:** eight keys, each loader validating field by field, try/catch round every access (V8), round trips exact (`stress-check`).
- **Missing:** a schema registry with migrations (each record is `v: 1` and anything else is dropped, not migrated), multiple career slots, export/import, a backup of the previous good record before overwrite. Streams career and settings; a shared `store` helper (versioned read, migrate, write with fallback) would serve both.

### QA, stress, performance
- **Now:** 17 suites. `audit-check` (one regression per audit fix) and `stress-check` (2340 shots on nine table setups, 206 CPU racks, determinism, storage round trips and corruption, rapid navigation and a no-shot table fuzz). Measured perf in F13 and F8.
- **Missing:** perf budgets as tests on a throttled CPU, long-session (thousands of shots) memory test in the page, a crash reporter (errors now reach the console and the loop survives, F1).

## 3. What the next waves should take

1. Stream A: F6 and the called-shot system; keep `judge(g, r)` pure and add each rule with a rules-check case.
2. Stream B: F5 (forfeit rule) with the career engine, and the shared versioned store.
3. ai: archetypes and bank/combo proposals (F8), with think-time budgets per level.
4. settings and ui: F7, F11, F14, F16, controls and accessibility settings.
5. later (physics): F9 and F10 together with masse (cue elevation), then re-solve tricks and tutorials.

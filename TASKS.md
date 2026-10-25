# Tasks

Indicators: `I`ntent `S`pec `P`lan `B`uild `V`erify `D`eploy `W`atch
`-` skipped, `!` stage failed.

## Phase 1: v1

- [x] T1.1: 8-ball and 9-ball, physics from puttX, two players or CPU, one offline page   [ISPBVD-]
  - `index.html` - the game: sim region (physics, rules, CPU), render, input, HUD
  - `tests/physics-check.cjs` - physics contract; plus rules, ai, boot, play suites
  - Verification: `npm test` exits 0

## Phase 2: overhaul

- [x] T2.1: overhaul: real spin physics and pockets, CPU levels, table art, phone layout and touch controls, audio   [ISPBV--]
  - `.buildloop/spec/T2.1.md` - five streams (physics, CPU, canvas, DOM/UX, audio) and their contract
  - `tests/render-check.cjs` - new; every suite extended
  - Verification: `npm test` exits 0, `npm run lint` 0 findings

- [x] T2.2: bigger balls (7 ft table, slimmer rails), pixel-perfect pockets, 1:1 aim sweep + fine wheel + loupe, bar-only shooting, auto aim, game-ball halo, red cloth, iOS home-screen app + icon   [ISPBV--]
  - `.buildloop/spec/T2.2.md`; `manifest.webmanifest`, `sw.js`, `icons/`, `tools/make-icons.cjs`, `tests/pwa-check.cjs`

## Phase 3: modes

- [x] T3.0: bumper pool, practice, trick shots (14, solver-checked), real side pockets   [I-PBV--]
  - octagon bumper table and classic side pockets (reference image) in progress
- [ ] T3.1: POV stroke challenge: 3D down-the-cue view, puttX-style stroke where a crooked stroke misses   [IP-----]
  - `.buildloop/intent/T3.1.md`, `.buildloop/plan/T3.1.md` (planned, not started; needs puttX's stroke code)

## Later (not started)

- Push-out in 9-ball, called pockets in 8-ball (10-ball), bank and combination shots for the CPU, masse,
  three-cushion carom, snooker (needs a zoom/follow camera first).

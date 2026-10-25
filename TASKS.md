# Tasks

Indicators: `I`ntent `S`pec `P`lan `B`uild `V`erify `D`eploy `W`atch
`-` skipped, `!` stage failed.

## Phase 1: v1

- [x] T1.1: 8-ball and 9-ball, physics from puttX, two players or CPU, one offline page   [ISPBVD-]
  - `index.html` - the game: sim region (physics, rules, CPU), render, input, HUD
  - `tests/physics-check.cjs` - physics contract; plus rules, ai, boot, play suites
  - Verification: `npm test` exits 0

## Phase 2: overhaul

- [ ] T2.1: overhaul: real spin physics and pockets, CPU levels, table art, phone layout and touch controls, audio   [ISPB---]
  - `.buildloop/spec/T2.1.md` - five streams (physics, CPU, canvas, DOM/UX, audio) and their contract
  - `tests/render-check.cjs` - new; every suite extended
  - Verification: `npm test` exits 0, `npm run lint` 0 findings

## Later (not started)

- Push-out in 9-ball, called pockets in 8-ball, bank and combination shots for the CPU, masse.

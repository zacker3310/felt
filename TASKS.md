# Tasks

Indicators: `I`ntent `S`pec `P`lan `B`uild `V`erify `D`eploy `W`atch
`-` skipped, `!` stage failed.

## Phase 1: v1

- [x] T1.1: 8-ball and 9-ball, physics from puttX, two players or CPU, one offline page   [ISPBVD-]
  - `index.html` - the game: sim region (physics, rules, CPU), render, input, HUD
  - `tests/physics-check.cjs` - physics contract; plus rules, ai, boot, play suites
  - Verification: `npm test` exits 0

## Later (not started)

- Side english, a difficulty setting for the CPU, push-out in 9-ball, called pockets in 8-ball.
- Hosting on GitHub Pages (needs Zac's go-ahead).

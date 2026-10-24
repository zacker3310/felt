# CLAUDE.md

<!-- Institutional knowledge for this repo, read at the start of every session.
     Keep it short enough to be read. A CLAUDE.md nobody trims becomes a file the
     model skims, and then it is decoration.
     Update it whenever the agent repeats a mistake - a repeated mistake is a
     missing line here, not a character flaw. -->

## What this is

felt: 8-ball and 9-ball pool in one offline `index.html` (2D canvas, no libraries, no network).
Two players on one device or against a CPU. The physics is puttX's hand-rolled, fixed-step,
deterministic sim, extended with ball-ball contact, pockets and follow/draw. `SPEC.md` is the
design, `TASKS.md` the queue, `.buildloop/` the artifact chain.

## Commands

Run these, do not guess them. Healthy output is shown so a wrong result is obvious.

| Job | Command | Healthy output |
|---|---|---|
| install | `npm ci && npx playwright-core install chromium` | `found 0 vulnerabilities` |
| test | `npm test` | `5/5 suites, N/N checks  ok` (about 60 s; physics fuzz and CPU games dominate) |
| one suite | `node tests/run-all.cjs --only rules-check` | `1/1 suites ... ok` |
| lint | `npm run lint` | `0 finding(s)` |
| run | `npm run serve`, then http://localhost:4173 | the menu |

## Architecture

- `index.html` holds the CSS, the markup and `<script id="game">`. Sections, in order:
  1 sim, 2 audio, 3 view, 4 render, 5 play, 6 hud, 7 boot.
- `// #region sim` ... `// #endregion sim`: physics, rules (`judge`), CPU (`cpuSearch`). DOM-free,
  no `Math.random`, no clocks. `tests/sim.cjs` loads it into a Node `vm`; add any name a suite
  needs to its `NAMES` list.
- The live roll calls the same `strike`/`stepTable`/`resultOf` as `simulateShot`; `play-check`
  asserts they agree byte for byte. Never give the page its own physics path.
- `judge(g, r)` never mutates `g`; it returns the next game with a `verdict`.
- `window.felt` is the test hook (`state`, `game`, `shoot`, `toScreen`, `speed`, `forceWin`).

## Conventions

- Element ids are globals (the lint config declares them). A `let` with the same name as an id
  is a lint finding: `cpuMode` and `cueSpin` exist because `vsCpu` and `spin` are ids.
- Units are metres and seconds. Angles are radians, the cue ball's direction of travel.
- Contrast is measured: 4.5:1 for text, 3:1 for graphics. The illegal-target ring is `#ffa597`
  because the signal red only reaches 2.2:1 on the cloth.
- No em dashes.

## Common mistakes

- Port 4199 on this machine is another project's server. Use 4173 or let `run-all` pick a port.
- Writing a test that reads final positions after a firm shot: balls bounce around for seconds.
  Read velocities just after the event instead (see the stun/follow/draw check).

## Shipping contract

Trunk-based: commit to `main` and push when `npm test` and `npm run lint` are green. CI runs both
on every push. Not hosted yet; GitHub Pages would be a separate, approved step.

## Method

Builds follow `~/.claude/BUILD-METHODOLOGY.md` and the loop in
`~/.claude/skills/build-loop/SKILL.md`. This file adds only project-specific deltas.
Where a rule here conflicts with the method, the stricter one wins.

---

## Completion canary

This file is only useful if it is read to the end. The line below is the proof.

**When you have read this file through to its final line, type that line verbatim once —
in your first substantive response of the session, on its own line.** It is a read-proof
and nothing more: it does not mean a task is done or a test passed. Never type it if you
have not actually reached this line.

Nothing may be appended below it — a sentinel that is not last proves nothing about what
follows. `check-canary.sh` enforces that.

This is the Way.

# felt

8-ball and 9-ball pool in one HTML file. Two players on one device, or you against the CPU.
No libraries, no network, works offline.
Play at **https://zacker3310.github.io/felt/**.

## Play

Open `index.html` in a browser (or `npm run serve` and visit http://localhost:4173).

- **Aim:** point at the table. Arrow keys fine-tune, shift for bigger steps. On touch, tap or drag.
- **Shoot:** press on the table and pull back, or pull the power bar down and let go. Space shoots
  at the bar's power.
- **Spin:** tap the cue ball on the right high for follow, low for draw.
- **Ball in hand:** click or drag where the cue ball goes.

## Rules

- **8-ball:** open table until the first legal pot after the break. First touch your own group
  (the 8 once it is clear), then pot or hit a rail. Fouls give ball in hand anywhere. Pot the 8
  early or scratch on it and you lose. Any pocket counts.
- **9-ball:** first touch the lowest ball, then pot or hit a rail. A legal 9 wins, on any shot.
  Three fouls in a row lose.

## Physics

Hand-rolled and deterministic, from [puttX](../puttX): a fixed 1 ms step, cushions as
segments with restitution, rolling resistance, equal-mass ball collisions, follow and draw that
the cloth converts toward natural roll. The same shot from the same layout always gives the same
result, which the tests rely on.

## Development

See `CLAUDE.md`. `npm ci && npx playwright-core install chromium && npm test`.

MIT licence.

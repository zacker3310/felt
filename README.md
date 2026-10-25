# felt

8-ball and 9-ball pool in one HTML file. Two players on one device, or you against a CPU at
three levels. No libraries, no network, works offline.
Play at **https://zacker3310.github.io/felt/**.

## Play

Open `index.html` in a browser (or `npm run serve` and visit http://localhost:4173).

- **Aim:** point with the mouse, or tap where the cue ball should go. Drag across the line to
  fine-tune; start further from the cue ball for finer steps. Arrow keys aim (shift coarse, alt
  fine).
- **Shoot:** drag back along the line, away from the target, and let go: the further, the
  harder. Slide back to the start to cancel. Or drag the power bar. Space shoots at the marked
  power; up and down set it.
- **English:** move the tip on the cue-ball pad: high for follow, low for draw, the sides for
  side english. Double tap or `R` to centre.
- **Ball in hand:** drag anywhere to slide the cue ball, or tap a spot.
- **Pause:** the pause button or Esc. The game waits.

## Rules

- **8-ball:** open table until the first legal pot after the break. First touch your own group
  (the 8 once it is clear), then pot or hit a rail. Fouls give ball in hand anywhere. Pot the 8
  early or scratch on it and you lose. The 8 on the break is spotted and the breaker continues.
  Any pocket counts.
- **9-ball:** first touch the lowest ball, then pot or hit a rail. A legal 9 wins, on any shot.
  Three fouls in a row lose.
- Ball in hand behind the head string (after a break scratch) must play out of the kitchen.

## Physics

Hand-rolled, fixed-step (1/1200 s) and deterministic. Every ball carries linear and angular
velocity: the cue tip's offset sets follow, draw and side english (with squirt); the cloth turns
slide into roll; ball-ball contact throws the object ball by cut and english; cushions take
english and send it off at a new angle. Pockets have angled jaws at WPA facings, so a poor hit
rattles out. The same shot from the same layout always gives the same result, which the tests
rely on.

## CPU

It plays by simulation: candidate pots into every mouth, a ladder of powers and spins, position
for the next shot, safeties when nothing is on. Easy, medium and hard differ in search breadth
and aim noise; hard beats medium in about 17 games of 20.

## Development

See `CLAUDE.md`. `npm ci && npx playwright-core install chromium && npm test`.

MIT licence.

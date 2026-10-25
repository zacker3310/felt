# felt

8-ball and 9-ball pool in one HTML file. Two players on one device, or you against a CPU at
three levels. No libraries, no network, works offline.
Play at **https://zacker3310.github.io/felt/**.

## Play

On an iPhone: open the link in Safari, Share, **Add to Home Screen**. It runs full screen and
offline. Or open `index.html` in any browser (or `npm run serve`, http://localhost:4173).

- **Aim:** tap where the cue ball should go, or drag anywhere on the table: the cue follows your
  finger round the ball. The ridged wheel fine-tunes (a magnifier shows the contact). Auto aim
  points at the easiest shot when your turn starts (menu).
- **Shoot:** pull the power bar and let go. It is the only way to shoot. Slide back or off it to
  cancel.
- **English:** move the tip on the cue-ball pad: high follow, low draw, sides for side english.
  Double tap to centre.
- **Ball in hand:** drag or tap to place; tap the ball to pick it up again.
- **Menu:** 7 ft or 9 ft table, green or red cloth, aim guide, auto aim, sound, CPU level.

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

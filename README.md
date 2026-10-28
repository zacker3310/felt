# felt

8-ball, 9-ball, 10-ball, straight pool, rotation, bumper pool, three-cushion and snooker in one HTML file. Two players on one device, or you against a CPU at
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

## Menu

- **Home:** Play again (your last setup, in one line), then the three games as tiles, each with
  its rack drawn on your cloth. Below them the solo row: Practice, Trick shots (your stars) and
  the Daily shot (your day streak). Stats, Settings and How to play sit at the bottom (top right
  in landscape). It fits one screen either way up.
- **Setup:** tap a game. Pick two players (type your names if you like) or one of three CPU
  opponents: Rookie (easy), Regular (medium) or Hustler (hard), each with your record against
  them. Then only that game's table options: 7 ft bar or 9 ft pro and regulation or generous
  pockets for pool, the octagon or the rectangle for bumper pool. Break.
- **Settings:** cloth (green or red), aim guide, auto aim, sound.
- **Daily shot:** one trick shot a day, the same for everyone that day. Your first try counts:
  play on consecutive days and the streak grows. Retries are practice.
- **Stats:** games played per game, wins and losses against each CPU opponent, two-player games,
  your run of wins against the CPU, trick stars and the daily streak. Kept on the device.
- **Pause:** the players and the balls down, Resume, then Restart, Quit to home, Settings and
  How to play. Esc (or a sheet's back button) closes any sheet.

## Rules

- **8-ball:** open table until the first legal pot after the break. First touch your own group
  (the 8 once it is clear), then pot or hit a rail. Fouls give ball in hand anywhere. Pot the 8
  early or scratch on it and you lose. The 8 on the break is spotted and the breaker continues.
  Any pocket counts.
- **9-ball:** first touch the lowest ball, then pot or hit a rail. A legal 9 wins, on any shot.
  Three fouls in a row lose.
- Ball in hand behind the head string (after a break scratch) must play out of the kitchen.
- **Rulesets:** each game plays one ruleset from a registry, chosen in its setup: felt's house
  rules (above) or WPA. WPA 8-ball calls every shot that is not obvious (the 8 always with its
  pocket), needs four balls to the cushions on a break that pots nothing (else the incoming player
  takes the table or has it re-racked), and lets the breaker spot or re-rack an 8 on the break.
  WPA 9-ball adds the push-out after the break (the opponent may hand it back). A house stalemate
  rule re-racks after six dry innings in a row (8 and 9-ball, off by default).
- **10-ball (WPA):** lowest ball first, call every shot, obvious or not (a house option calls
  the obvious ones for you). A legal break pots a ball or drives four to the cushions. The 10 wins
  only when called; on the break or early it is spotted. Push-out after the break. A ball down on
  a missed call: the opponent shoots or hands it back. Three fouls lose.
- **Straight pool (14.1 continuous, WPA):** any ball, called with its pocket, a point each (balls
  that drop with it count too). The break calls a ball or drives two balls and the cue ball to the
  cushions (else -2 and the opponent's choice). With one ball left the other 14 are re-racked; the
  break ball and cue ball stay unless in the rack (then the head spot, or ball in hand behind the
  line). Fouls -1; three in a row -15 more and a new break. Race to 25, 50, 100 or 150; the best run
  is kept.
- **Rotation (61):** lowest ball first; every ball potted on a legal shot scores its number. 61
  wins. Fouls: no score, the balls spotted, ball in hand.
- **Called shots:** Settings, Gameplay: Off, 8-ball only, Official rules (each ruleset's own),
  All shots, or Career rules; the call names the ball, ball and pocket, or (custom) the shot type
  too. Tap a ball, then a pocket; an obvious shot is called from the aim where the rules allow it
  ("Calling: 6 in top left corner, tap to change"); the Safety chip declares a safety. The power
  bar says Call your shot and will not arm while a needed call is missing. A missed call is not a
  foul: the turn ends (14.1 spots what dropped; 10-ball gives the opponent the choice). A career
  event or tournament plays its own locked rules, whatever the settings say.

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

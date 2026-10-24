/* ai-check (Node): the CPU. It pots a hanging ball, places the cue ball legally when it has
   ball in hand, returns well-formed shots, and two CPUs finish a whole game of each kind. */
'use strict';
const { check, done } = require('./lib.cjs');
const { loadSim } = require('./sim.cjs');
const S = loadSim();

/* 1. a 9 hanging over the corner pocket, cue ball behind it on the line */
{
  const g = S.newGame('9');
  g.breakShot = false; g.inHand = null;
  for (const b of g.balls) if (b.n > 0 && b.n !== 9) b.on = false;
  const nine = g.balls.find(b => b.n === 9);
  nine.x = S.TL - 0.09; nine.y = S.TW - 0.09;
  g.balls[0].x = S.TL - 0.6; g.balls[0].y = S.TW - 0.55;
  const s = S.cpuShot(g, 1);
  const r = S.simulateShot(g.balls, s);
  const after = S.judge(g, r);
  check('CPU pots a hanging 9 and wins', after.winner === 0, JSON.stringify({ s, potted: r.potted }));
}

/* 2. full games, CPU against CPU */
function play(kind, seed) {
  let g = S.newGame(kind), shots = 0, malformed = 0, illegalPlace = 0;
  while (g.winner === null && shots < 300) {
    const s = S.cpuShot(g, seed + shots);
    if (!(Number.isFinite(s.angle) && s.power >= 0 && s.power <= 1 && s.spin >= -1 && s.spin <= 1)) malformed++;
    if (g.inHand) {
      if (!s.place || !S.canPlace(g, s.place[0], s.place[1])) { illegalPlace++; break; }
      g = S.placeCue(g, s.place[0], s.place[1]);
    }
    g = S.judge(g, S.simulateShot(g.balls, s));
    shots++;
  }
  return { winner: g.winner, shots, malformed, illegalPlace };
}
for (const kind of ['8', '9']) {
  const r = play(kind, 100);
  check(`CPU vs CPU finishes a game of ${kind}-ball`, r.winner === 0 || r.winner === 1, JSON.stringify(r));
  check(`CPU shots in ${kind}-ball are well formed and placements legal`, r.malformed === 0 && r.illegalPlace === 0, JSON.stringify(r));
}

/* 3. ball in hand in a crowded kitchen still finds a legal spot */
{
  const g = S.newGame('8');
  g.breakShot = false; g.inHand = 'kitchen'; g.balls[0].on = false;
  const spots = [[S.HEAD_X - 0.05, 0.25], [S.HEAD_X - 0.05, 0.45], [S.HEAD_X - 0.05, S.TW / 2], [S.HEAD_X - 0.05, 0.82], [S.HEAD_X - 0.05, 1.02],
    [S.HEAD_X - 0.3, 0.25], [S.HEAD_X - 0.3, 0.45], [S.HEAD_X - 0.3, S.TW / 2], [S.HEAD_X - 0.3, 0.82], [S.HEAD_X - 0.3, 1.02]];
  spots.forEach((p, i) => Object.assign(g.balls[i + 1], { x: p[0], y: p[1] }));
  const s = S.cpuShot(g, 3);
  check('CPU finds a legal kitchen spot when the usual ones are taken', !!s.place && S.canPlace(g, s.place[0], s.place[1]), JSON.stringify(s.place));
}

/* 4. same seed, same shot */
{
  const g = S.newGame('8');
  check('cpuShot is deterministic for a seed', JSON.stringify(S.cpuShot(g, 5)) === JSON.stringify(S.cpuShot(g, 5)));
}

done();

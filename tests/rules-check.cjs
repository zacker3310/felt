/* rules-check (Node): 8-ball and 9-ball judging, one case per rule in the spec, plus cue
   placement and re-spotting. Results are built by hand so each case isolates one rule. */
'use strict';
const { check, done } = require('./lib.cjs');
const { loadSim } = require('./sim.cjs');
const S = loadSim();
const R = S.BALL_R;

/* a fake shot result: the game's balls, with `potted` taken off the table */
function res(g, { first = null, rail = true, potted = [] } = {}) {
  const balls = g.balls.map(b => Object.assign({}, b, { vx: 0, vy: 0, on: b.on && !potted.includes(b.n) }));
  return { balls, first, railAfter: rail, potted, end: 'rest' };
}
/* a game past the break, with only the listed object balls left on the table */
function midGame(kind, left, over = {}) {
  const g = S.newGame(kind);
  g.breakShot = false; g.inHand = null;
  for (const b of g.balls) if (b.n > 0 && !left.includes(b.n)) b.on = false;
  return Object.assign(g, over);
}
const on = (g, n) => g.balls.find(b => b.n === n).on;

/* ---- 8-ball ---- */
{
  const g = S.newGame('8');
  check('8: a new game breaks from the kitchen, table open', g.inHand === 'kitchen' && g.open && g.breakShot && g.turn === 0);
  const a = S.judge(g, res(g, { first: 1 }));
  check('8: dry legal break passes the turn, table stays open', a.turn === 1 && a.open && !a.verdict.foul && a.inHand === null);
  const b = S.judge(g, res(g, { first: 1, potted: [3] }));
  check('8: potting on the break keeps the turn, table stays open', b.turn === 0 && b.open && b.groups[0] === null);
  const c = S.judge(g, res(g, { first: 1, potted: [0] }));
  check('8: break scratch is a foul with ball in hand in the kitchen', c.turn === 1 && c.verdict.foul && c.inHand === 'kitchen' && !on(c, 0));
  const d = S.judge(g, res(g, { first: 1, potted: [8] }));
  check('8: the 8 on the break is re-spotted, no loss', d.winner === null && on(d, 8));
}
{
  const g = midGame('8', [1, 2, 9, 10, 8]);
  const a = S.judge(g, res(g, { first: 9, potted: [10] }));
  check('8: first legal pot on an open table sets the groups', a.groups[0] === 'stripes' && a.groups[1] === 'solids' && !a.open && a.turn === 0);
  const b = S.judge(g, res(g, { first: 8 }));
  check('8: hitting the 8 first on an open table is a foul', b.verdict.foul && b.turn === 1 && b.inHand === 'table');
  check('8: open table targets every object ball but the 8', JSON.stringify(S.legalTargets(g)) === JSON.stringify([1, 2, 9, 10]));
}
{
  const g = midGame('8', [1, 2, 9, 10, 8], { open: false, groups: ['solids', 'stripes'] });
  check('8: solids target their own group', JSON.stringify(S.legalTargets(g)) === JSON.stringify([1, 2]));
  const a = S.judge(g, res(g, { first: 9, potted: [1] }));
  check('8: wrong ball first is a foul, ball in hand anywhere, pot does not keep the turn', a.verdict.foul && a.turn === 1 && a.inHand === 'table' && !on(a, 1));
  const b = S.judge(g, res(g, { first: 1, rail: false }));
  check('8: no pot and no rail after contact is a foul', b.verdict.foul && b.turn === 1);
  const c = S.judge(g, res(g, { first: null, rail: false }));
  check('8: no contact is a foul', c.verdict.foul && c.turn === 1);
  const d = S.judge(g, res(g, { first: 1, potted: [2] }));
  check('8: a legal pot of your own ball keeps the turn', !d.verdict.foul && d.turn === 0);
  const e = S.judge(g, res(g, { first: 1, potted: [9] }));
  check('8: potting only an opponent ball passes the turn', !e.verdict.foul && e.turn === 1);
  const f = S.judge(g, res(g, { first: 1, potted: [8] }));
  check('8: the 8 before your group is clear loses', f.winner === 1);
}
{
  const g = midGame('8', [9, 10, 8], { open: false, groups: ['solids', 'stripes'] });
  check('8: a cleared group targets the 8', JSON.stringify(S.legalTargets(g)) === JSON.stringify([8]));
  const a = S.judge(g, res(g, { first: 8, potted: [8] }));
  check('8: the 8 with your group clear wins', a.winner === 0);
  const b = S.judge(g, res(g, { first: 8, potted: [8, 0] }));
  check('8: scratching on the 8 loses', b.winner === 1);
}

{
  const g = midGame('8', [7, 9, 10, 8], { open: false, groups: ['solids', 'stripes'] });
  const a = S.judge(g, res(g, { first: 7, potted: [7, 8] }));
  check('8: the 8 on the same shot as your last ball loses', a.winner === 1, JSON.stringify(a.verdict));
}

/* ---- 9-ball ---- */
{
  const g = S.newGame('9');
  check('9: the 1 is on the foot spot', Math.abs(g.balls.find(b => b.n === 1).x - S.FOOT[0]) < 1e-9);
  const a = S.judge(g, res(g, { first: 1, potted: [9] }));
  check('9: the 9 on the break wins', a.winner === 0);
}
{
  const g = midGame('9', [3, 5, 9]);
  check('9: the target is the lowest ball on the table', JSON.stringify(S.legalTargets(g)) === JSON.stringify([3]));
  const a = S.judge(g, res(g, { first: 5 }));
  check('9: hitting a higher ball first is a foul with ball in hand', a.verdict.foul && a.turn === 1 && a.inHand === 'table');
  const b = S.judge(g, res(g, { first: 3, potted: [9] }));
  check('9: a combination on the 9 wins', b.winner === 0);
  const c = S.judge(g, res(g, { first: 5, potted: [9] }));
  check('9: the 9 on a foul is re-spotted and does not win', c.winner === null && on(c, 9) && c.turn === 1);
  const d = S.judge(g, res(g, { first: 3, potted: [5] }));
  check('9: a legal pot keeps the turn', !d.verdict.foul && d.turn === 0);
  let h = g;
  for (let i = 0; i < 2; i++) { h = S.judge(h, res(h, { first: null })); h = S.judge(h, res(h, { first: 3 })); }
  check('9: two fouls in a row do not lose', h.winner === null && h.fouls[0] === 2, JSON.stringify(h.fouls));
  const lost = S.judge(h, res(h, { first: null }));
  check('9: three fouls in a row lose', lost.winner === 1);
  const reset = S.judge(h, res(h, { first: 3 }));
  check('9: a legal shot resets the foul count', reset.fouls[0] === 0);
}

/* ---- placement and spotting ---- */
{
  const g = S.newGame('8');
  check('kitchen placement allowed behind the head string', S.canPlace(g, S.HEAD_X - 0.05, S.TW / 2));
  check('kitchen placement refused past the head string', !S.canPlace(g, S.HEAD_X + 0.05, S.TW / 2));
  const f = midGame('8', [1], { inHand: 'table' });
  const one = f.balls.find(b => b.n === 1);
  check('placement refused on top of a ball', !S.canPlace(f, one.x + R, one.y));
  check('placement refused off the cloth', !S.canPlace(f, -0.01, 0.5) && !S.canPlace(f, 1, S.TW - R / 2));
  const p = S.placeCue(f, 1.0, 0.4);
  check('placeCue puts the cue ball there', p.balls[0].on && p.balls[0].x === 1.0 && p.balls[0].y === 0.4);
  const crowd = [S.newBall(0, 0.5, 0.5), S.newBall(1, S.FOOT[0], S.FOOT[1])];
  crowd.push(S.newBall(9, 0, 0)); crowd[2].on = false;
  S.spot(crowd, 9);
  const nine = crowd[2];
  check('spot: an occupied foot spot puts the ball behind it, touching nothing',
    nine.on && nine.x > S.FOOT[0] && Math.hypot(nine.x - crowd[1].x, nine.y - crowd[1].y) >= 2 * R - 1e-9, JSON.stringify(nine));
}

done();

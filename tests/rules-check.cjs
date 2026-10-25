/* rules-check (Node): 8-ball, 9-ball and bumper pool judging, one case per rule in the spec, plus cue
   placement and re-spotting. Results are built by hand so each case isolates one rule. The
   cases that hang on the bed (foot spot, head string, placement, re-spotting) run on both the
   7 ft and the 9 ft table. */
'use strict';
const { check, done } = require('./lib.cjs'), check0 = check;
const { loadSim } = require('./sim.cjs');
const S = loadSim();
const R = S.BALL_R;

/* a fake shot result: the game's balls, with `potted` taken off the table. `crossed` (the cue
   ball reached the head string before or at first contact) is left out unless a case sets it,
   which exercises judge's fallback for results without the field. */
function res(g, { first = null, rail = true, potted = [], crossed } = {}) {
  const balls = g.balls.map(b => Object.assign({}, b, { vx: 0, vy: 0, on: b.on && !potted.includes(b.n) }));
  return Object.assign({ balls, first, railAfter: rail, potted, end: 'rest' }, crossed === undefined ? {} : { crossed });
}
/* a game past the break, with only the listed object balls left on the table */
function midGame(kind, left, over = {}) {
  const g = S.newGame(kind);
  g.breakShot = false; g.inHand = null;
  for (const b of g.balls) if (b.n > 0 && !left.includes(b.n)) b.on = false;
  return Object.assign(g, over);
}
const on = (g, n) => g.balls.find(b => b.n === n).on;
/* run body(tag) once per table size, then go back to the default 7 ft table */
const eachTable = body => { for (const size of ['7', '9']) { S.setTable(size); body(`${size} ft: `); } S.setTable('7'); };

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
eachTable(T => {
  const g = S.newGame('9'), one = g.balls.find(b => b.n === 1);
  check(T + '9: the 1 is on the foot spot, three quarters down the table', Math.abs(one.x - S.FOOT[0]) < 1e-9 && Math.abs(one.x - 0.75 * S.TL) < 1e-9 && one.y === S.TW / 2);
});
{
  const g = S.newGame('9');
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
  /* the warning: the verdict that hands the table to a player on two fouls says so */
  let w = g, flags = [];
  for (const first of [null, 3, null, 3]) { w = S.judge(w, res(w, { first })); flags.push(w.verdict.twoFouls); }
  check('9: verdict.twoFouls is set exactly when the player to shoot is on two fouls', JSON.stringify(flags) === '[false,false,false,true]' && w.turn === 0 && w.fouls[0] === 2, JSON.stringify(flags));
  const e8 = midGame('8', [1, 9, 8]);
  check('8: verdict.twoFouls is never set in 8-ball', S.judge(e8, res(e8, { first: null })).verdict.twoFouls === false);
}

/* ---- rules tightened in T2.1 ---- */
{
  const g = S.newGame('8');
  const a = S.judge(g, res(g, { first: 1, potted: [8] }));
  check('8: the 8 on a legal break is spotted and the breaker shoots again', a.turn === 0 && !a.verdict.foul && a.verdict.keep && on(a, 8) && a.open);
  const b = S.judge(g, res(g, { first: 1, potted: [8, 0] }));
  check('8: the 8 and the cue ball on the break: 8 spotted, foul, ball in hand in the kitchen', b.winner === null && on(b, 8) && b.verdict.foul && b.turn === 1 && b.inHand === 'kitchen');
  const snap = JSON.stringify(g);
  S.judge(g, res(g, { first: 1, potted: [3, 0] }));
  check('judge does not mutate the game it is given', JSON.stringify(g) === snap);
  const m = midGame('9', [3, 5, 9]);
  const d1 = S.judge(m, res(m, { first: 3 })), d2 = S.judge(d1, res(d1, { first: 3 })), d3 = S.judge(d2, res(d2, { first: 3, potted: [5] }));
  check('game.dry counts shots in a row with nothing potted', g.dry === 0 && d1.dry === 1 && d2.dry === 2 && d3.dry === 0, JSON.stringify([d1.dry, d2.dry, d3.dry]));
}
eachTable(T => {
  /* after a break scratch: in hand behind the head string, a ball behind it is not on */
  const g = midGame('8', [1, 2, 9], { inHand: 'kitchen' });
  Object.assign(g.balls.find(b => b.n === 1), { x: S.HEAD_X - 0.3, y: 0.3 });
  Object.assign(g.balls.find(b => b.n === 2), { x: S.HEAD_X + 0.6, y: 0.6 });
  const a = S.judge(g, res(g, { first: 1, crossed: false }));
  check(T + '8: in hand in the kitchen, hitting a ball behind the head string first is a foul', a.verdict.foul && a.turn === 1 && a.inHand === 'table', JSON.stringify(a.verdict));
  const b = S.judge(g, res(g, { first: 2, crossed: true }));
  check(T + '8: in hand in the kitchen, a ball past the head string is fine', !b.verdict.foul && b.turn === 1 && b.inHand === null);
  /* the rule is crossing, not where the ball sits: a bank off the foot rail onto the 1 is legal */
  const c = S.judge(g, res(g, { first: 1, crossed: true }));
  check(T + '8: in hand in the kitchen, the cue ball crossing the string first makes a ball behind it fair', !c.verdict.foul && c.turn === 1, JSON.stringify(c.verdict));
  /* a ball whose centre is past the string is fair even if the cue ball touches it before its own centre gets there */
  const d = S.judge(g, res(g, { first: 2, crossed: false }));
  check(T + '8: in hand in the kitchen, a ball past the head string is fair without the cue ball crossing', !d.verdict.foul, JSON.stringify(d.verdict));
  const e = S.judge(g, res(g, { first: 1 }));
  check(T + '8: a result without `crossed` is judged on the first ball\'s position', e.verdict.foul === a.verdict.foul && !!e.verdict.foul);
  const f = midGame('8', [1, 2, 9], { inHand: 'table' });
  Object.assign(f.balls.find(b => b.n === 1), { x: S.HEAD_X - 0.3, y: 0.3 });
  check(T + '8: ball in hand anywhere: the head string does not matter', !S.judge(f, res(f, { first: 1, crossed: false })).verdict.foul);
});
{
  /* the kitchen rule cannot force a foul: when no legal ball lies past the head string, any is on */
  const g = midGame('9', [1, 9], { inHand: 'kitchen' });
  Object.assign(g.balls.find(b => b.n === 1), { x: 0.3, y: 0.3 });
  const a = S.judge(g, res(g, { first: 1, crossed: false }));
  check('9: in hand in the kitchen with the ball on behind the line, hitting it is legal', !a.verdict.foul, JSON.stringify(a.verdict));
  const f = midGame('9', [3, 5, 9]);
  const b = S.judge(f, res(f, { first: 5, potted: [9] }));
  check('9: a 9 spotted after a foul is not reported as potted', on(b, 9) && !b.verdict.potted.includes(9), JSON.stringify(b.verdict));
}
{
  const g = midGame('8', [1, 2, 9, 10, 8]);
  const a = S.judge(g, res(g, { first: 2, potted: [10, 1] }));
  check('8: both groups down on the deciding shot: the first ball down sets the groups', a.groups[0] === 'stripes' && a.turn === 0 && !a.open);
}
{
  const g = S.newGame('9');
  const a = S.judge(g, res(g, { first: 2, potted: [5] }));
  check('9: the break must hit the 1 first', a.verdict.foul && a.turn === 1);
  const m = midGame('9', [3, 5, 9]);
  const b = S.judge(m, res(m, { first: 3, potted: [3, 0] }));
  check('9: a scratch with a legal pot is a foul, the pot stays down, the turn passes', b.verdict.foul && b.turn === 1 && b.inHand === 'table' && !on(b, 3) && b.fouls[0] === 1);
}
/* ---- placement and spotting, both tables ---- */
eachTable(T => {
  const g = midGame('9', [3], { inHand: 'table' });
  check(T + 'placement refused in a pocket mouth', S.POCKET_AIM.every(p => !S.canPlace(g, p[0], p[1])));
  check(T + 'placement refused against a cushion', !S.canPlace(g, S.TL / 3, S.BALL_R * 0.6) && !S.canPlace(g, S.TL - S.BALL_R * 0.6, S.TW / 3));
  check(T + 'placement allowed in the open, up to a radius off the cushion nose', S.canPlace(g, S.TL / 3, S.TW / 3) && S.canPlace(g, S.TL / 3, S.BALL_R + 1e-6));
});
eachTable(T => {
  const g = S.newGame('8');
  check(T + 'kitchen placement allowed behind the head string', S.canPlace(g, S.HEAD_X - 0.05, S.TW / 2));
  check(T + 'kitchen placement refused past the head string', !S.canPlace(g, S.HEAD_X + 0.05, S.TW / 2));
  const f = midGame('8', [1], { inHand: 'table' });
  const one = f.balls.find(b => b.n === 1);
  check(T + 'placement refused on top of a ball', !S.canPlace(f, one.x + R, one.y));
  check(T + 'placement refused off the cloth', !S.canPlace(f, -0.01, 0.5) && !S.canPlace(f, 1, S.TW - R / 2) && !S.canPlace(f, S.TL + 0.01, 0.5));
  const p = S.placeCue(f, 1.0, 0.4);
  check(T + 'placeCue puts the cue ball there', p.balls[0].on && p.balls[0].x === 1.0 && p.balls[0].y === 0.4);
  const crowd = [S.newBall(0, 0.5, 0.5), S.newBall(1, S.FOOT[0], S.FOOT[1])];
  crowd.push(S.newBall(9, 0, 0)); crowd[2].on = false;
  S.spot(crowd, 9);
  const nine = crowd[2];
  check(T + 'spot: an occupied foot spot puts the ball behind it, touching nothing',
    nine.on && nine.x > S.FOOT[0] && Math.hypot(nine.x - crowd[1].x, nine.y - crowd[1].y) >= 2 * R - 1e-9, JSON.stringify(nine));
  /* a full foot string: every spot from the foot spot to the foot rail is taken, so the ball
     goes the other way, in front of the spot, still on the long string and on the cloth */
  const wall = [S.newBall(0, 0.3, 0.3)];
  for (let x = S.FOOT[0], n = 1; x < S.TL - R; x += 2 * R, n++) wall.push(S.newBall(n < 9 ? n : n + 1, x, S.FOOT[1]));
  wall.push(Object.assign(S.newBall(9, 0, 0), { on: false }));
  S.spot(wall, 9);
  const w9 = wall[wall.length - 1];
  check(T + 'spot: a full foot string sends the ball in front of the foot spot', w9.on && w9.x < S.FOOT[0] && w9.x > R && w9.y === S.FOOT[1]
    && wall.every(b => b === w9 || Math.hypot(b.x - w9.x, b.y - w9.y) >= 2 * R - 1e-9), JSON.stringify({ x: w9.x, n: wall.length }));
});

/* ---- bumper pool: one case per rule (How to play and judgeBumper say the same), on both
   bumper tables (the rules do not change with the shape) ---- */
for (const shape of ['octagon', 'rect']) {
  S.setTable('bumper', shape);
  const check = (name, ok, info) => check0(shape === 'rect' ? name : name.replace(/^bumper/, 'bumper octagon'), ok, info);
  const g0 = S.newGame('bumper');
  const M = S.B_MARK, by = (g, n) => g.balls.find(b => b.n === n);
  /* a hand-built result: `potted` dropped in `cups` ({ n: cup index, -1 off the table }), cue = the struck ball */
  const bres = (g, { potted = [], cups = {}, cue = g.striker, move = {} } = {}) => {
    const balls = g.balls.map(b => Object.assign({}, b, move[b.n] ? { x: move[b.n][0], y: move[b.n][1] } : {}, { vx: 0, vy: 0, on: b.on && !potted.includes(b.n) }));
    return { balls, cue, first: null, railAfter: false, crossed: false, potted, pocketOf: cups, end: 'rest' };
  };
  const play = (over = {}) => Object.assign(S.newGame('bumper'), { opening: 0, openPot: [false, false] }, over);
  const left = (g, p) => g.balls.filter(b => b.on && (b.n >= 30 ? 1 : 0) === p).length;
  check('bumper: a new game is on the bumper table, 5 red and 5 white, red opens with the marked ball',
    S.TABLE === 'bumper' && S.BUMPER_SHAPE === shape && g0.balls.length === 10 && g0.opening === 1 && g0.turn === 0 && g0.striker === M[0] && S.POCKETS.length === 2 && S.BUMPERS.length === 12 && g0.inHand === null);
  check('bumper: the starting balls are on free spots (clear of posts, cups and each other)', g0.balls.every(b => S.bumperFree(g0.balls, b.x, b.y, b.n)));
  /* 1. the opening */
  const a = S.judge(g0, bres(g0));
  check('bumper opening: after red, white plays its opening shot with its marked ball', a.turn === 1 && a.opening === 2 && a.striker === M[1] && !a.verdict.foul);
  const red = S.judge(g0, bres(g0, { potted: [M[0]], cups: { [M[0]]: 1 } }));
  const b2 = S.judge(red, bres(red));
  check('bumper opening: red potted its marked ball, white did not: red shoots, the opening is over', red.turn === 1 && b2.turn === 0 && b2.opening === 0 && !by(b2, M[0]).on);
  const w2 = S.judge(a, bres(a, { potted: [M[1]], cups: { [M[1]]: 0 } }));
  check('bumper opening: only white potted: white shoots', w2.turn === 1 && w2.opening === 0 && w2.verdict.keep);
  const both = S.judge(red, bres(red, { potted: [M[1]], cups: { [M[1]]: 0 } }));
  check('bumper opening: both potted: red (first) shoots', both.turn === 0);
  const near = S.judge(a, bres(a, { move: { [M[1]]: [0.4, S.TW / 2 + 0.2] } }));
  const far = S.judge(a, bres(a, { move: { [M[1]]: [S.TL - 0.05, 0.05] } }));
  check('bumper opening: neither potted: the marked ball nearer its far cup shoots first', near.turn === 1 && far.turn === 0, JSON.stringify([near.turn, far.turn]));
  const wf = S.judge(a, bres(a, { potted: [M[1]], cups: { [M[1]]: 1 } }));
  check("bumper opening: a foul on white's opening gives red the table", wf.verdict.foul && wf.turn === 0 && by(wf, M[1]).on);
  /* red fouls on the opening by potting a white: white's marked ball drops as the penalty, so
     white's opening shot is with any of its balls (not a foul for a ball that is not there) */
  const rf = S.judge(g0, bres(g0, { potted: [33], cups: { 33: 0 } }));
  const wo = S.judge(rf, bres(rf, { cue: rf.striker }));
  check("bumper opening: after red's foul drops white's marked ball, white opens with another of its own, no foul",
    rf.verdict.dropped === M[1] && rf.opening === 2 && rf.striker > M[1] && JSON.stringify(S.bumperStrikers(rf)) === JSON.stringify([32, 34, 35]) && !wo.verdict.foul && wo.opening === 0, JSON.stringify({ s: rf.striker, f: wo.verdict.foul }));
  const um = S.judge(g0, bres(g0, { cue: 22 }));
  check('bumper opening: striking any ball but the marked one is a foul', !!um.verdict.foul && /opening/.test(um.verdict.foul));
  /* 2. pots and the turn */
  const g = play();
  const k1 = S.judge(g, bres(g, { potted: [M[0]], cups: { [M[0]]: 1 } }));
  check('bumper: the marked ball in the far cup stays down and keeps the turn', !k1.verdict.foul && k1.turn === 0 && !by(k1, M[0]).on && left(k1, 0) === 4 && k1.verdict.potted[0] === M[0]);
  const k2 = S.judge(k1, bres(k1, { cue: 23, potted: [23], cups: { 23: 1 } }));
  check('bumper: after the marked ball, an unmarked one in the far cup keeps the turn', !k2.verdict.foul && k2.turn === 0 && left(k2, 0) === 3);
  const dry = S.judge(g, bres(g));
  check('bumper: nothing potted passes the turn, and the next striker is a ball of theirs', !dry.verdict.foul && dry.turn === 1 && dry.striker === M[1]);
  const order = S.judge(g, bres(g, { potted: [M[0], 22], cups: { [M[0]]: 1, 22: 1 } }));
  check('bumper: the marked ball and then an unmarked one on the same shot is legal', !order.verdict.foul && left(order, 0) === 3 && order.turn === 0);
  /* 3-4. the fouls and what follows */
  const early = S.judge(g, bres(g, { cue: 22, potted: [22], cups: { 22: 1 } }));
  check('bumper foul: an unmarked ball before the marked one comes back, the turn passes, white drops its marked ball',
    /unmarked/.test(early.verdict.foul) && by(early, 22).on && early.turn === 1 && early.verdict.dropped === M[1] && !by(early, M[1]).on && left(early, 1) === 4);
  check('bumper foul: a returned ball stands on a free spot', S.bumperFree(early.balls, by(early, 22).x, by(early, 22).y, 22));
  const own = S.judge(g, bres(g, { potted: [M[0]], cups: { [M[0]]: 0 } }));
  check('bumper foul: your ball in your own cup comes back', /own cup/.test(own.verdict.foul) && by(own, M[0]).on && own.turn === 1 && left(own, 1) === 4);
  const opp = S.judge(g, bres(g, { potted: [33], cups: { 33: 0 } }));
  check("bumper foul: potting the opponent's ball counts for them, and they drop one more", /opponent/.test(opp.verdict.foul) && !by(opp, 33).on && left(opp, 1) === 3 && opp.verdict.gave[0] === 33 && opp.turn === 1);
  const off = S.judge(g, bres(g, { potted: [24], cups: { 24: -1 } }));
  check('bumper foul: a ball off the table comes back', /left the table/.test(off.verdict.foul) && by(off, 24).on && off.turn === 1);
  const wrong = S.judge(g, bres(g, { cue: 32 }));
  check("bumper foul: striking the opponent's ball", /not your own/.test(wrong.verdict.foul) && wrong.turn === 1);
  const undo = S.judge(g, bres(g, { potted: [M[0], 34], cups: { [M[0]]: 1, 34: 1 } }));
  check('bumper foul: your legal pot on a fouling shot comes back too', !!undo.verdict.foul && by(undo, M[0]).on && !by(undo, 34).on && undo.verdict.potted.length === 0);
  const pen = play();
  for (const n of [32, 33, 34, 35]) by(pen, n).on = false;
  const later = S.judge(pen, bres(pen));
  check('bumper foul: with the marked ball down, the penalty drops the ball furthest from their cup', (() => {
    const h = play(); by(h, M[1]).on = false;
    const j = S.judge(h, bres(h, { cue: 31 }));
    const T = S.POCKETS[0], d = n => Math.hypot(by(h, n).x - T[0], by(h, n).y - T[1]);
    return [32, 33, 34, 35].every(n => d(j.verdict.dropped) >= d(n)) && j.verdict.dropped !== null;
  })());
  /* 5. the win */
  const last = play();
  for (const n of [22, 23, 24, 25]) by(last, n).on = false;
  const win = S.judge(last, bres(last, { potted: [M[0]], cups: { [M[0]]: 1 } }));
  check('bumper: the fifth ball down wins', win.winner === 0 && /all five/.test(win.verdict.why) && later.winner === null);
  const gift = S.judge(pen, bres(pen, { potted: [M[0]], cups: { [M[0]]: 0 } }));
  check("bumper: a foul's penalty that finishes the opponent's set wins it for them", gift.winner === 1 && left(gift, 1) === 0);
  const snap = JSON.stringify(g);
  S.judge(g, bres(g, { potted: [M[0], 34], cups: { [M[0]]: 1, 34: 1 } }));
  check('bumper: judge never mutates the game', JSON.stringify(g) === snap);
  check('bumper: legal targets are every ball, strikers are your own (the marked one on the opening)',
    S.legalTargets(g).length === 10 && JSON.stringify(S.bumperStrikers(g)) === JSON.stringify([21, 22, 23, 24, 25]) && JSON.stringify(S.bumperStrikers(g0)) === '[21]');
  const back = S.newGame('8');
  check('bumper: a pool game after it is back on the pool table', S.TABLE === '7' && S.BUMPERS.length === 0 && S.POCKETS.length === 6 && back.balls.length === 16);
}

done();

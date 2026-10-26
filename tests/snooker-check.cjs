/* snooker-check: snooker (sim 1i, page 5k and 6s). Node: the tables (12 ft and the compact 10 ft:
   bed, baulk line, D, spots, the 52.5 mm ball and back to pool's 2 1/4 in after a switch, the
   WPBSA-sized mouths with rounded jaws), the rack, the pockets against pool's regulation ones
   (firm straight pots drop, a line half a ball off the mouth's middle rattles out where pool's
   takes it, and every acceptance window is narrower), a 400-shot fuzz, the rules (red then colour,
   re-spotting and the occupied-spot order, the colours in order, foul values, in-off and the D,
   the break, the frame's end, the re-spotted black, a concession, a best of three, the points left
   and snookers needed) and the CPU (hard pots more than easy). Page: the home tile, the setup
   sheet, the game (in hand in the D, the scoreboard, the live roll byte for byte equal to
   simulateShot, nothing but the bar shoots), the pause menu's Concede and the How to play tab. */
'use strict';
const { check, done, open, settled, smallTargets, lowContrast } = require('./lib.cjs');
const { loadSim } = require('./sim.cjs');
const S = loadSim();
const P = v => S.powerFor(v), DEG = Math.PI / 180;
const ball = (g, n) => g.balls.find(b => b.n === n);
/* a shot's result for judge: which ball the cue ball hit first and what went down (pocket 0) */
const res = (g, o = {}) => {
  const pot = o.potted || [];
  return { balls: g.balls.map(b => Object.assign({}, b, { on: b.on && !pot.includes(b.n) })), cue: 0, first: o.first === undefined ? null : o.first, potted: pot.slice(),
    pocketOf: Object.fromEntries(pot.map(n => [n, 0])), crossed: true };
};
const play = t => { const k = {}; while (S.stepTable(t)) { for (const h of t.hits) k[h[0]] = 1; t.hits.length = 0; } return k; };

/* 1. the tables */
for (const size of ['full', 'compact']) {
  S.setTable('snooker', size);
  const s = size === 'full' ? 1 : 5 / 6, T = `${size}: `, y = S.TW / 2, SP = S.SPOTS;
  check(T + `the bed is ${size === 'full' ? '3.569 x 1.778 m (12 ft)' : '5/6 of that (10 ft)'}, the ball 52.5 mm`, Math.abs(S.TL - 3.569 * s) < 1e-9 && Math.abs(S.TW - 1.778 * s) < 1e-9 && S.BALL_R === 0.02625 && S.TABLE === 'snooker',
    JSON.stringify([S.TL, S.TW, S.BALL_R]));
  check(T + 'baulk line 737 mm from the baulk cushion, the D 292 mm, scaled with the bed', Math.abs(S.HEAD_X - 0.737 * s) < 1e-9 && Math.abs(S.D_R - 0.292 * s) < 1e-9);
  check(T + 'spots: brown mid baulk line, yellow (right from baulk, y > TW/2) and green on the D, blue centre, pink midway to the top cushion, black 324 mm off it',
    SP[59][0] === S.HEAD_X && SP[59][1] === y && SP[57][0] === S.HEAD_X && Math.abs(SP[57][1] - (y + S.D_R)) < 1e-12 && Math.abs(SP[58][1] - (y - S.D_R)) < 1e-12
    && SP[60][0] === S.TL / 2 && Math.abs(SP[61][0] - (S.TL / 2 + S.TL) / 2) < 1e-12 && Math.abs(SP[62][0] - (S.TL - 0.324 * s)) < 1e-12 && [60, 61, 62].every(n => SP[n][1] === y), JSON.stringify(SP));
  check(T + 'the D: inside the half circle on the baulk side only', S.inD(S.HEAD_X - 0.1, y) && S.inD(S.HEAD_X, y + S.D_R) && !S.inD(S.HEAD_X + 0.01, y) && !S.inD(S.HEAD_X - S.D_R * 0.9, y + S.D_R * 0.6));
  /* mouths: the corner and middle jaw points 90 and 104 mm apart (86 and 100 mm or so where the
     rounded jaws meet the facings), every jaw rounded by a circle tangent to nose and facing */
  check(T + 'pockets: corner mouths 90 mm, middles 104 mm between the jaw points, the same on both sizes; twelve rounded jaws (30 and 22 mm)',
    S.CORNER_W === 0.09 && S.SIDE_W === 0.104 && S.JAW_ARCS.length === 12 && S.JAW_ARCS.filter(a => a[2] === 0.03).length === 8 && S.JAW_ARCS.filter(a => a[2] === 0.022).length === 4 && S.CUSH.length === 18);
  const tangent = S.JAW_ARCS.every(([cx, cy, r]) => {
    const d = S.CUSH.map(c => { const ex = c[2] - c[0], ey = c[3] - c[1], L2 = ex * ex + ey * ey, t = Math.max(0, Math.min(1, ((cx - c[0]) * ex + (cy - c[1]) * ey) / L2)); return Math.hypot(c[0] + ex * t - cx, c[1] + ey * t - cy); }).sort((a, b) => a - b);
    return Math.abs(d[0] - r) < 1e-9 && Math.abs(d[1] - r) < 1e-9;
  });
  check(T + 'each jaw circle meets its nose and its facing (the segments end where it touches them)', tangent);
  /* the rack */
  const g = S.newGame('snooker'), reds = g.balls.filter(b => S.isRed(b.n)), all = g.balls;
  let overlap = 0;
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y) < 2 * S.BALL_R) overlap++;
  const apex = reds.reduce((a, b) => b.x < a.x ? b : a), gap = Math.hypot(apex.x - SP[61][0], apex.y - SP[61][1]) - 2 * S.BALL_R;
  check(T + 'rack: 22 balls (cue, 15 reds, 6 colours on their spots), none touching, the apex red 0-2 mm off the pink, every red behind it',
    all.length === 22 && reds.length === 15 && overlap === 0 && gap > 0 && gap <= 0.002 && reds.every(b => b.x > SP[61][0]) && S.S_COLS.every(n => ball(g, n).x === SP[n][0] && ball(g, n).y === SP[n][1]),
    JSON.stringify({ overlap, gap }));
  check(T + 'a frame starts with the cue ball in hand in the D, on a red, 0-0, the break to come', g.inHand === 'D' && S.canPlace(g, ball(g, 0).x, ball(g, 0).y) && g.on === 'red' && g.breakShot && g.score.join() === '0,0' && g.turn === 0);
  check(T + 'in hand in the D: placement refused outside it, allowed in it', S.canPlace(g, S.HEAD_X - 0.12, y - 0.1) && !S.canPlace(g, S.HEAD_X + 0.05, y - 0.1) && !S.canPlace(g, S.HEAD_X - 0.05, y + S.D_R + 0.03));
}
S.setTable('7');
check('back on a pool table the ball is 2 1/4 in again, and the 7 ft geometry exactly as fresh', S.BALL_R === 0.028575 && S.TL === 1.981 && S.JAW_ARCS.length === 0 && Object.keys(S.SPOTS).length === 0 && S.newGame('8').balls.length === 16);
S.setTable('snooker', 'full');
check('setTable(\'snooker\') remembers its size; a pool game afterwards goes back to the last pool size', S.setTable('snooker') === 'snooker' && Math.abs(S.TL - 3.569) < 1e-9 && S.newGame('9') && S.TABLE === '7' && S.BALL_R === 0.028575);

/* 2. the pockets: lone balls rolled at them from 0.6 m, against the 7 ft table's regulation pockets */
{
  const roll = (k, a, off, v) => {
    const m = S.POCKET_AIM[k], ux = Math.cos(a), uy = Math.sin(a), t = S.strike(S.newTable([S.newBall(0, m[0] - ux * 0.6 - uy * off, m[1] - uy * 0.6 + ux * off)]), a, P(v), 0), kinds = play(t);
    return { pot: !t.balls[0].on, jaw: !!kinds.jaw, ball: t.balls[0] };
  };
  const LINES = { 'corner straight': [0, Math.atan2(-1, -1)], 'middle straight': [1, -Math.PI / 2], 'middle 30 deg': [1, -Math.PI / 2 + 30 * DEG], 'corner 15 deg off the rail': [0, Math.PI + 15 * DEG] };
  /* the width of the band of lines that drop, in ball widths, at soft, medium and firm pace */
  const windows = () => {
    const out = {};
    for (const [name, [k, a]] of Object.entries(LINES)) {
      let n = 0;
      for (const v of [0.8, 1.6, 3]) for (let o = -60; o <= 60; o += 2) if (roll(k, a, o / 1000, v).pot) n++;
      out[name] = +(n * 0.002 / 3 / (2 * S.BALL_R)).toFixed(2);
    }
    return out;
  };
  const sizes = {};
  for (const size of ['full', 'compact']) {
    S.setTable('snooker', size);
    const straight = [0, 2, 3, 5].every(k => roll(k, Math.atan2(k < 3 ? -1 : 1, k === 0 || k === 3 ? -1 : 1), 0, 1.6).pot) && [1, 4].every(k => roll(k, k === 1 ? -Math.PI / 2 : Math.PI / 2, 0, 1.6).pot);
    const firm = roll(0, LINES['corner straight'][1], 0, 3.5).pot && roll(1, -Math.PI / 2, 0, 3.5).pot;
    check(`${size}: a straight pot at medium pace (1.6 m/s) drops in all six pockets, and a firm one (3.5 m/s) in a corner and a middle`, straight && firm);
    const h = roll(0, LINES['corner straight'][1], S.BALL_R, 1.6);
    check(`${size}: a line half a ball wide of the corner's middle touches the rounded jaw and rattles out`, !h.pot && h.jaw && h.ball.x > 0 && h.ball.y > 0, JSON.stringify(h));
    const along = S.strike(S.newTable([S.newBall(0, 1.0, S.BALL_R + 0.0005)]), Math.PI, P(1.6), 0);
    play(along);
    check(`${size}: a ball rolling along the cushion into the corner drops`, along.potted.includes(0));
    sizes[size] = windows();
  }
  S.setTable('7'); S.setPockets('regulation');
  const h = roll(0, Math.atan2(-1, -1), S.BALL_R, 1.6);
  check('pool, 7 ft regulation: the same line, half a ball wide of the corner\'s middle, drops', h.pot, JSON.stringify(h));
  const pool = windows(), tighter = Object.keys(pool).filter(k => !(sizes.full[k] < pool[k] && sizes.compact[k] < pool[k]));
  check('snooker pockets take a narrower band of lines than pool\'s regulation pockets in every category (ball widths)', !tighter.length, JSON.stringify({ pool, snooker: sizes, tighter }));
}

/* 3. fuzz: 400 shots from play, both sizes: no NaN, nothing off the bed, no overlap */
for (const size of ['full', 'compact']) {
  S.setTable('snooker', size);
  const rnd = S.rng(size === 'full' ? 11 : 12);
  let bad = 0, out = 0, overl = 0, g = S.newGame('snooker');
  for (let i = 0; i < 200; i++) {
    if (i % 40 === 0) g = S.newGame('snooker');
    if (g.inHand || !ball(g, 0).on) g = S.placeCue(g, S.HEAD_X - 0.1, S.TW / 2 + (rnd() - 0.5) * 0.4);
    const r = S.simulateShot(g.balls, { angle: rnd() * 2 * Math.PI, power: rnd(), spin: { x: rnd() * 2 - 1, y: rnd() * 2 - 1 } });
    if (r.balls.some(b => !Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(b.vx))) bad++;
    if (r.balls.some(b => b.on && (b.x < -1e-6 || b.x > S.TL + 1e-6 || b.y < -1e-6 || b.y > S.TW + 1e-6)) || r.end !== 'rest') out++;
    const on = r.balls.filter(b => b.on);
    for (let a = 0; a < on.length; a++) for (let b = a + 1; b < on.length; b++) if (Math.hypot(on[a].x - on[b].x, on[a].y - on[b].y) < 2 * S.BALL_R - 1e-4) overl++;
    g = S.judge(g, r);
    if (g.winner !== null) g = S.newGame('snooker');
  }
  check(`${size}: fuzz, 200 shots (400 on both): no NaN, no ball off the bed or still rolling, no overlap`, !bad && !out && !overl, JSON.stringify({ bad, out, overl }));
}
const brk = () => JSON.stringify(S.simulateShot(S.newGame('snooker').balls, { angle: 0.02, power: 0.7, spin: { x: 0.3, y: -0.2 } }));
check('deterministic: the same shot, the same result', brk() === brk());

/* 4. the rules */
S.setTable('snooker', 'compact');
{
  const g0 = Object.assign(S.newGame('snooker'), { inHand: null, breakShot: false });
  const a = S.judge(g0, res(g0, { first: 45, potted: [45] }));
  check('a red potted scores 1, keeps the turn, and the player is on a colour', a.score.join() === '1,0' && a.turn === 0 && a.on === 'colour' && a.brk === 1 && !a.verdict.foul && JSON.stringify(S.legalTargets(a)) === JSON.stringify(S.S_COLS));
  const b = S.judge(a, res(a, { first: 61, potted: [61] }));
  check('then a colour (the first hit, auto-nominated): its value, re-spotted while reds remain, back on a red, the break 7', b.score.join() === '7,0' && b.on === 'red' && b.brk === 7 && ball(b, 61).on && ball(b, 61).x === S.SPOTS[61][0] && b.verdict.back.join() === '61' && b.high[0] === 7);
  const c = S.judge(a, res(a, { first: 62, potted: [61] }));
  check('on a colour: hitting the black and potting the pink is a foul worth 7, the pink comes back', c.verdict.foul && c.score.join() === '1,7' && c.turn === 1 && ball(c, 61).on && c.on === 'red' && c.brk === 0);
  const two = S.judge(g0, res(g0, { first: 41, potted: [41, 42] }));
  check('two reds on one shot score 2', two.score[0] === 2 && two.on === 'colour');
  const miss = S.judge(a, res(a, { first: 59 }));
  check('a colour hit but not potted: the turn passes with no foul, the next player on a red; the break of 1 ends', !miss.verdict.foul && miss.turn === 1 && miss.on === 'red' && miss.verdict.ended === 1 && miss.brk === 0);
  /* fouls: the value of the ball on or the highest ball involved, 4 at least, 7 at most */
  const pen = (g, o) => S.judge(g, res(g, o)).verdict.pen;
  check('foul values: a red missed 4, the brown first 4, the blue first 5, the black first 7, a red and the pink potted on a red 6, the yellow first when on the green (colours) 4',
    pen(g0, {}) === 4 && pen(g0, { first: 59 }) === 4 && pen(g0, { first: 60 }) === 5 && pen(g0, { first: 62 }) === 7 && pen(g0, { first: 41, potted: [41, 61] }) === 6
    && pen(Object.assign(S.copyGame(g0), { on: 58 }), { first: 57 }) === 4, JSON.stringify([pen(g0, {}), pen(g0, { first: 59 }), pen(g0, { first: 60 }), pen(g0, { first: 62 }), pen(g0, { first: 41, potted: [41, 61] })]));
  check('foul value: on the pink in the colours, missing it is 6', pen(Object.assign(S.copyGame(g0), { on: 61 }), {}) === 6);
  const io = S.judge(g0, res(g0, { first: 44, potted: [0] }));
  check('in-off: a foul of 4, the opponent has the cue ball in hand in the D, placeable only there', io.verdict.foul === 'in-off' && io.score.join() === '0,4' && io.turn === 1 && io.inHand === 'D'
    && S.canPlace(io, S.HEAD_X - 0.1, S.TW / 2) && !S.canPlace(io, S.HEAD_X + 0.3, S.TW / 2));
  const lies = S.judge(g0, res(g0, { first: 60 }));
  check('any other foul: the next player plays from where the cue ball lies', lies.verdict.foul && lies.inHand === null && lies.turn === 1);
  const fresh = S.newGame('snooker');
  const brkFoul = S.judge(fresh, res(fresh, { first: 59 })), brkOk = S.judge(fresh, res(fresh, { first: 55 }));
  check('the break must hit a red: the brown first is a foul, a red first is fair', brkFoul.verdict.foul && brkFoul.turn === 1 && !brkOk.verdict.foul && brkOk.turn === 1 && !brkOk.breakShot);
  /* re-spotting: own spot taken -> the highest free spot; all taken -> up the line toward the top cushion */
  const occ = S.copyGame(a);
  Object.assign(ball(occ, 41), { x: S.SPOTS[60][0] + 0.01, y: S.SPOTS[60][1] });
  Object.assign(ball(occ, 62), { x: S.SPOTS[62][0] - 0.2, y: S.SPOTS[62][1] + 0.2 });   /* the black played off its spot */
  const o1 = S.judge(occ, res(occ, { first: 60, potted: [60] }));
  check('a colour whose spot is taken goes on the highest-value free spot (the blue onto the black\'s, the black played off it)', ball(o1, 60).x === S.SPOTS[62][0] && ball(o1, 60).y === S.SPOTS[62][1], JSON.stringify([ball(o1, 60).x, ball(o1, 60).y]));
  const full = S.copyGame(a), extra = [41, 42, 43, 44, 46, 47];
  S.S_COLS.forEach((c, i) => { if (c !== 59) Object.assign(ball(full, extra[i]), { x: S.SPOTS[c][0], y: S.SPOTS[c][1] + 0.003 }); });
  Object.assign(ball(full, 48), { x: S.SPOTS[59][0] + 0.02, y: S.SPOTS[59][1] });
  const o2 = S.judge(full, res(full, { first: 59, potted: [59] })), bb = ball(o2, 59);
  check('every spot taken: the colour goes as near its own spot as it can, up the line toward the top cushion, touching nothing',
    bb.on && bb.y === S.SPOTS[59][1] && bb.x > S.SPOTS[59][0] && o2.balls.every(o => o === bb || !o.on || Math.hypot(o.x - bb.x, o.y - bb.y) >= 2 * S.BALL_R - 1e-12) && bb.x - ball(o2, 48).x < 2 * S.BALL_R + 0.001, JSON.stringify([bb.x, bb.y]));
  /* the colours in order */
  const last = S.copyGame(g0);
  for (const b of last.balls) if (S.isRed(b.n) && b.n !== 41) b.on = false;
  const l1 = S.judge(last, res(last, { first: 41, potted: [41] })), l2 = S.judge(l1, res(l1, { first: 62, potted: [62] }));
  check('the colour after the last red is re-spotted, then the colours in order from the yellow', l1.on === 'colour' && l2.on === 57 && ball(l2, 62).on && l2.score[0] === 8);
  const l3 = S.judge(l2, res(l2, { first: 57, potted: [57] })), l4 = S.judge(l3, res(l3, { first: 59 }));
  check('in the colours a potted colour stays down and the next is on; hitting another first is a foul', !ball(l3, 57).on && l3.on === 58 && JSON.stringify(S.legalTargets(l3)) === '[58]' && l4.verdict.foul && l4.verdict.pen === 4);
  /* the frame's end: the last black */
  const blk = S.copyGame(g0);
  for (const b of blk.balls) if (b.n !== 0 && b.n !== 62) b.on = false;
  Object.assign(blk, { on: 62, score: [40, 30] });
  const w0 = S.judge(blk, res(blk, { first: 62, potted: [62] }));
  check('one frame: the last black down ends it; the higher score wins the match', w0.winner === 0 && w0.verdict.frameOver.score.join() === '47,30' && /frame/.test(w0.verdict.why));
  const f0 = S.judge(Object.assign(S.copyGame(blk), { score: [40, 38] }), res(blk, { first: 62, potted: [0] }));
  check('with only the black left a foul ends the frame too: 7 to the opponent', f0.winner === 1 && f0.verdict.frameOver.score.join() === '40,45');
  const tie = S.judge(Object.assign(S.copyGame(blk), { score: [33, 40] }), res(blk, { first: 62, potted: [62] }));
  check('level after the black: it is re-spotted and the other player plays it from the D, no winner yet', tie.winner === null && tie.verdict.reblack && ball(tie, 62).on && ball(tie, 62).x === S.SPOTS[62][0]
    && tie.turn === 1 && tie.inHand === 'D' && tie.on === 62);
  const tie2 = S.judge(tie, res(S.placeCue(tie, S.HEAD_X - 0.1, S.TW / 2), { first: 62, potted: [62] }));
  check('the re-spotted black: the next pot wins', tie2.winner === 1 && tie2.score.join() === '40,47');
  /* best of three: the frame goes to the next rack with the breaker alternating */
  const m = Object.assign(S.copyGame(blk), { frames: 3 });
  const m1 = S.judge(m, res(m, { first: 62, potted: [62] }));
  check('best of three: a frame won brings a fresh rack, frames 1-0, the other player breaks from the D', m1.winner === null && m1.won.join() === '1,0' && m1.frame === 2 && m1.turn === 1 && m1.inHand === 'D'
    && m1.score.join() === '0,0' && m1.balls.length === 22 && m1.verdict.frameOver.winner === 0);
  const m2 = S.concedeSnooker(Object.assign(S.copyGame(m1), { won: [1, 0] }), 1);
  check('a concession: the frame to the other player; two frames win the best of three', m2.winner === 0 && m2.won.join() === '2,0' && m2.verdict.frameOver.conceded && m2.verdict.why === 'conceded');
  const c1 = S.concedeSnooker(S.newGame('snooker'), 0);
  check('one frame conceded ends the match for the opponent, scores as they were', c1.winner === 1 && c1.verdict.frameOver.score.join() === '0,0');
  check('judge never touches the game it is given', (() => { const x = S.newGame('snooker'), snap = JSON.stringify(x); S.judge(x, res(x, { first: 41, potted: [41, 0] })); return JSON.stringify(x) === snap; })());
  /* the points left and snookers */
  check('points left: 147 at the start, 15 reds x 8 + 27; after a red, 14 x 8 + 7 + 27; in the colours, the colours left', S.snookerLeft(g0) === 147 && S.snookerLeft(a) === 14 * 8 + 34 && S.snookerLeft(l3) === 25 && S.snookerLeft(blk) === 7);
  check('snookers needed: behind by more than is left', S.snookersNeeded(Object.assign(S.copyGame(blk), { score: [30, 38], turn: 0 }), 0) && !S.snookersNeeded(Object.assign(S.copyGame(blk), { score: [31, 38], turn: 0 }), 0));
}

/* 5. the CPU: over seeded positions with reds scattered, hard pots more than easy, and the break is legal */
{
  S.setTable('snooker', 'compact');
  const pos = seed => {
    const rnd = S.rng(seed), g = Object.assign(S.newGame('snooker'), { breakShot: false, inHand: null });
    const free = (b, x, y) => g.balls.every(o => o === b || !o.on || Math.hypot(o.x - x, o.y - y) > 2.2 * S.BALL_R) && S.canPlace({ inHand: 'table', balls: [] }, x, y);
    for (const b of g.balls) {
      if (!S.isRed(b.n) && b.n !== 0) continue;
      if (S.isRed(b.n) && rnd() < 0.5) { b.on = false; continue; }
      for (let i = 0; i < 300; i++) { const x = 0.1 + rnd() * (S.TL - 0.2), y = 0.08 + rnd() * (S.TW - 0.16); if (free(b, x, y)) { b.x = x; b.y = y; break; } }
    }
    return g;
  };
  const score = level => {
    let pots = 0, fouls = 0;
    for (let s = 1; s <= 12; s++) {
      const g = pos(s * 13), shot = S.cpuShot(g, s, level), g2 = shot.place ? S.placeCue(g, shot.place[0], shot.place[1]) : g, j = S.judge(g2, S.simulateShot(g2.balls, shot));
      if (j.verdict.foul) fouls++; else if (j.verdict.pts) pots++;
    }
    return { pots, fouls };
  };
  const easy = score('easy'), hard = score('hard');
  check('CPU: hard pots more than easy over the same seeded positions, and fouls no more', hard.pots > easy.pots && hard.fouls <= easy.fouls, JSON.stringify({ easy, hard }));
  const legal = ['easy', 'hard'].every(level => { const g = S.newGame('snooker'), s = S.cpuShot(g, 5, level), g2 = S.placeCue(g, s.place[0], s.place[1]); return S.inD(s.place[0], s.place[1]) && !S.judge(g2, S.simulateShot(g2.balls, s)).verdict.foul; });
  check('CPU: the break is played from the D and hits a red', legal);
}

/* 6. the page */
(async () => {
  const { browser, page, errors } = await open('', { viewport: { width: 440, height: 956 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await page.evaluate(() => { felt.speed = 40; settings.autoAim = true; });
  const tile = await page.evaluate(() => { const r = playS.getBoundingClientRect(); return { w: r.width, h: r.height, b: r.bottom, ih: innerHeight, sh: menu.scrollHeight, ch: menu.clientHeight, text: playS.textContent }; });
  check('home: a Snooker card among the games, the home still fits without scrolling at 440x956', tile.w >= 44 && tile.h >= 44 && tile.b <= tile.ih && tile.sh <= tile.ch && /Snooker/.test(tile.text), JSON.stringify(tile));
  await page.click('#playS');
  const su = await page.evaluate(() => ({ title: setupTitle.textContent, snk: [...setupSheet.querySelectorAll('.snk')].every(e => e.getClientRects().length), pool: [...setupSheet.querySelectorAll('.pool, .bump')].some(e => e.getClientRects().length),
    size: stCompact.getAttribute('aria-pressed'), one: sf1.getAttribute('aria-pressed') }));
  check('setup: Snooker with its Table (Compact 10 ft by default on a phone, Full 12 ft) and Frames (one, best of 3); no pool or bumper options',
    su.title === 'Snooker' && su.snk && !su.pool && su.size === 'true' && su.one === 'true', JSON.stringify(su));
  check('setup (snooker): targets 44 px, text 4.5:1', (await smallTargets(page)).length === 0 && (await lowContrast(page)).length === 0, JSON.stringify([await smallTargets(page), await lowContrast(page)]));
  await page.click('#breakBtn');
  await page.waitForTimeout(300);
  const g = await page.evaluate(() => { const c = felt.game.balls[0]; return { kind: felt.game.kind, hand: felt.game.inHand, inD: inD(c.x, c.y), R: BALL_R, TL, bar: !snkBar.hidden, barText: snkBar.textContent, s: felt.state, hint: felt.hint }; });
  check('the frame starts: the compact table, the 52.5 mm ball, the cue ball in hand in the D, the scoreboard on the rail (break, a red on, 147 left)',
    g.kind === 'snooker' && g.hand === 'D' && g.inD && g.R === 0.02625 && Math.abs(g.TL - 3.569 * 5 / 6) < 1e-9 && g.bar && /Break\s*0/.test(g.barText) && /Red/.test(g.barText) && /147 left/.test(g.barText) && g.s === 'aim', JSON.stringify(g));
  check('auto aim on the break points at a red', !!g.hint && g.hint.n >= 41 && g.hint.n <= 55, JSON.stringify(g.hint));
  const moved = await page.evaluate(() => [felt.place(HEAD_X - 0.05, TW / 2 - 0.1), felt.place(HEAD_X + 0.2, TW / 2)]);
  check('ball in hand: a spot in the D is taken, one past the baulk line refused', moved[0] === true && moved[1] === false);
  /* nothing but the bar shoots: drags on the table and keys */
  const n0 = await page.evaluate(() => felt.game.shots);
  const c = await page.evaluate(() => { const c = felt.game.balls[0]; return felt.toScreen(c.x + 0.4, c.y); });
  await page.touchscreen.tap(c[0], c[1]);
  for (const k of ['Space', 'Enter', 'ArrowUp', 'ArrowDown']) await page.keyboard.press(k);
  await page.mouse.move(c[0], c[1]); await page.mouse.down(); await page.mouse.move(c[0], c[1] + 200, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(200);
  check('nothing but the power bar shoots: taps, drags and keys on the snooker table leave the shot unplayed', await page.evaluate(n => felt.game.shots === n && felt.state === 'aim', n0));
  /* the live roll equals simulateShot byte for byte */
  const exp = await page.evaluate(() => { const c = felt.game.balls[0], t = felt.game.balls.find(b => b.n === 55), a = Math.atan2(t.y - c.y, t.x - c.x) + 0.02; window.__a = a; return JSON.stringify(simulateShot(felt.game.balls, { angle: a, power: 0.55, spin: { x: 0.2, y: -0.3 } }).balls.map(b => [b.n, b.on, b.x, b.y])); });
  await page.evaluate(() => felt.shoot(window.__a, 0.55, { x: 0.2, y: -0.3 }));
  await settled(page);
  const live = await page.evaluate(() => JSON.stringify(felt.lastResult.balls.map(b => [b.n, b.on, b.x, b.y])));
  check('the live break matches simulateShot exactly', live === exp);
  const after = await page.evaluate(() => ({ shots: felt.game.shots, turn: felt.game.turn, chip: pchip0.textContent + '|' + pchip1.textContent, msg: msg.textContent, s: felt.state }));
  check('the shot is judged: the chips carry the scores, the status line says what is on', after.shots === 1 && /\d/.test(after.chip) && /on /.test(after.msg) && ['aim', 'over'].includes(after.s), JSON.stringify(after));
  check('game screen: targets 44 px, text 4.5:1 (the scoreboard too)', (await smallTargets(page)).length === 0 && (await lowContrast(page)).length === 0, JSON.stringify([await smallTargets(page), await lowContrast(page)]));
  /* landscape: the scoreboard stays on the table's top rail, inside the stage */
  await page.setViewportSize({ width: 956, height: 440 });
  await page.waitForTimeout(300);
  const land = await page.evaluate(() => { const b = snkBar.getBoundingClientRect(), t = felt.tableRect(), s = stage.getBoundingClientRect(); return { b: [b.top, b.bottom, b.left, b.right], t, s: [s.left, s.right], ok: b.top >= t.top - 2 && b.bottom <= t.top + RAIL * felt.view.k + 4 && b.left >= s.left && b.right <= s.right }; });
  check('956x440: the scoreboard sits on the top rail, inside the stage', land.ok, JSON.stringify(land));
  await page.setViewportSize({ width: 440, height: 956 });
  await page.waitForTimeout(300);
  /* the pause menu: Concede; the frame goes to the other player and the game is over */
  await page.click('#menuBtn');
  const pm = await page.evaluate(() => ({ con: !!concedeBtn.getClientRects().length, meta: p0meta.textContent }));
  check('pause menu: Concede frame shows for snooker, the cards give the points', pm.con && /point/.test(pm.meta), JSON.stringify(pm));
  await page.click('#helpBtn').catch(() => {});
  await page.evaluate(() => showHelp());
  const help = await page.evaluate(() => ({ sel: tabSnk.getAttribute('aria-selected'), text: panSnk.textContent.length }));
  check('How to play from a paused snooker game opens its Snooker tab', help.sel === 'true' && help.text > 300, JSON.stringify(help));
  check('How to play: text 4.5:1', (await lowContrast(page)).length === 0, JSON.stringify(await lowContrast(page)));
  await page.evaluate(() => { backToMenu(); });
  await page.click('#concedeBtn');
  await page.waitForTimeout(200);
  const over = await page.evaluate(() => ({ s: felt.state, w: felt.game.winner, why: overWhy.textContent, kind: overKind.textContent, rows: overStats.textContent, rec: felt.record.kinds.snooker }));
  const who = await page.evaluate(() => felt.cpu);
  check('Concede ends the one-frame match for the other player; game over says so with the score and high breaks; the frame is recorded',
    over.s === 'over' && over.w !== null && /conceded/.test(over.why) && /^Snooker/.test(over.kind) && /High break/.test(over.rows) && over.rec.frames >= 1, JSON.stringify({ over, who }));
  await page.evaluate(() => { state = 'menu'; showMenu(); showStats(); });
  check('stats: a snooker row and the frames and highest break', await page.evaluate(() => /Snooker/.test(recTable.textContent) && /1 frame played, highest break \d+/.test(snkStat.textContent)));
  check('no console errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });

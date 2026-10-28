/* physics-check (Node): the table physics. Pockets take straight balls, a ball along the rail
   and spit out a hard ball off the jaw; cushions reflect and english bends the rebound; stun,
   follow, draw and the stop shot; sliding turns into rolling; squirt and throw; energy
   (rolling and spinning included) never rises; results are deterministic; the break spreads
   the rack; fuzzed shots never produce a NaN, an escaped ball, an overlap or a timeout, and
   the fail-safe pots anything that gets out. The pockets keep nothing half over a hole: balls
   dying at the mouths either drop or rest clear of the hole but for a sliver. The power curve
   makes every part of the bar useful, draw comes back, reverse english reads off a rail, and
   the table records whether the cue ball crossed the head string before first contact.
   Table sizes: setTable rebuilds the geometry for 7 and 9 ft, and the table-dependent sections
   (shapes, pockets, lags, racks, fuzz) run on both. Pocket styles: setPockets rebuilds it for
   regulation or generous pockets, composing with setTable; generous mouths measure half an inch
   wider, pot more of a fixed set of shots in every category, and the shapes, lags and fuzz run
   on them too, while regulation stays exactly what it was. The rest is ball physics, run on the
   default 7 ft table in metres; the power curve, whose roll-outs are longer than a 7 ft table,
   is measured on the 9 ft table so its distances are free rolls, not rail bounces. */
/* Bumper pool (section 10): its tables through setTable (the rectangle and the octagon: the
   octagon's eight gapless noses, mitred rubbers and corners), posts, cups, the front pair's block,
   determinism and the fuzz on each geometry. */
'use strict';
const { check, done } = require('./lib.cjs');
const { loadSim } = require('./sim.cjs');
const S = loadSim();
const R = S.BALL_R, DEG = Math.PI / 180;
const SIZES = ['7', '9'];
/* run body(tag) once per table size, then go back to the default 7 ft table. With `styles`,
   once per size and pocket style, the tag naming a style other than regulation; then back to
   regulation pockets. */
const eachTable = (body, styles = ['regulation']) => {
  for (const style of styles) for (const size of SIZES) {
    S.setTable(size); S.setPockets(style);
    body(`${size} ft${style === 'regulation' ? '' : ', ' + style}: `, style);
  }
  S.setTable('7'); S.setPockets('regulation');
};
const BOTH = ['regulation', 'generous'];

const shot = (balls, angle, power, spin = 0) => S.simulateShot(balls, { angle, power, spin });
/* the power for a cue-ball speed: the checks below are written in m/s so that a new power curve
   does not move them */
const P = v => S.powerFor(v);
const cueAt = (x, y) => S.newBall(0, x, y);
const ball = (balls, n) => balls.find(b => b.n === n);
const slip = b => Math.hypot(b.vx + R * b.wy, b.vy - R * b.wx);
const energy = t => t.balls.reduce((a, b) => a + (b.on ? S.energyOf(b) : 0), 0);
const lin = t => t.balls.reduce((a, b) => a + (b.vx * b.vx + b.vy * b.vy) / 2, 0);
/* run a table, collecting hit kinds; stop early after `limit` seconds */
function play(t, limit = Infinity) {
  const kinds = {};
  while (S.stepTable(t)) { for (const h of t.hits) kinds[h[0]] = (kinds[h[0]] || 0) + 1; t.hits.length = 0; if (t.t > limit) break; }
  for (const h of t.hits) kinds[h[0]] = (kinds[h[0]] || 0) + 1;
  return kinds;
}

/* 0a. table sizes: 7 ft by default; setTable rebuilds everything that hangs on the bed and
   nothing else; switching back gives exactly the fresh geometry */
{
  const geo = () => JSON.stringify([S.TABLE, S.TL, S.TW, S.HEAD_X, S.FOOT, S.CUSH, S.CUSHION_POLYS, S.POCKETS, S.POCKET_R, S.POCKET_AIM]);
  const fresh = geo();
  check('default table is 7 ft: 1.981 x 0.991 m, head string at TL/4, foot spot at 3TL/4', S.TABLE === '7' && S.TL === 1.981 && S.TW === 0.991
    && Math.abs(S.HEAD_X - S.TL / 4) < 1e-12 && Math.abs(S.FOOT[0] - 3 * S.TL / 4) < 1e-12 && S.FOOT[1] === S.TW / 2, fresh.slice(0, 60));
  const k7 = { cush: S.CUSH, polys: S.CUSHION_POLYS, pockets: S.POCKETS, aim: S.POCKET_AIM, R: S.POCKET_R };
  const r9 = S.setTable('9');
  check('setTable(\'9\'): 2.54 x 1.27 m, every table global reassigned', r9 === '9' && S.TABLE === '9' && S.TL === 2.54 && S.TW === 1.27 && Math.abs(S.HEAD_X - 0.635) < 1e-12
    && Math.abs(S.FOOT[0] - 1.905) < 1e-12 && S.CUSH !== k7.cush && S.CUSHION_POLYS !== k7.polys && S.POCKETS !== k7.pockets && S.POCKET_AIM !== k7.aim && S.POCKET_R !== k7.R);
  /* the same pockets, cushions and jaws, only moved: every segment and polygon keeps its length
     and shape, a pocket keeps its offset from the nearest bed corner (or side's middle) */
  const len = c => c.map(q => Math.hypot(q[2] - q[0], q[3] - q[1]));
  const off = (P, TL, TW) => P.map(([x, y]) => [x < TL / 4 ? x : x > 3 * TL / 4 ? x - TL : x - TL / 2, y < TW / 2 ? y : y - TW]);
  const near = (a, b) => a.flat(2).every((v, i) => Math.abs(v - b.flat(2)[i]) < 1e-12);
  const noses7 = len(k7.cush).slice(0, 6), noses9 = len(S.CUSH).slice(0, 6);
  check('9 ft against 7 ft: hole radii, jaw facings and pocket offsets identical, noses longer by the bed', near(S.POCKET_R, k7.R) && near(len(S.CUSH).slice(6), len(k7.cush).slice(6))
    && near(off(S.POCKETS, 2.54, 1.27), off(k7.pockets, 1.981, 0.991)) && near(off(S.POCKET_AIM, 2.54, 1.27), off(k7.aim, 1.981, 0.991))
    && noses9.every((v, i) => v > noses7[i]), JSON.stringify({ noses7: noses7.map(v => +v.toFixed(4)), noses9: noses9.map(v => +v.toFixed(4)) }));
  const shotGeo = () => JSON.stringify(shot(S.rack('9'), 0.02, 0.9, { x: 0.2, y: -0.3 }));
  const on9 = shotGeo();
  S.setTable('7');
  check('setTable(\'7\') after 9 ft restores the fresh geometry exactly', geo() === fresh);
  const on7 = shotGeo();
  check('setTable changes the physics: the same break plays differently, and switching back replays it exactly', on7 !== on9 && (S.setTable('9'), shotGeo()) === on9 && (S.setTable('7'), shotGeo()) === on7);
  check('setTable: anything but \'9\' is 7 ft', S.setTable('x') === '7' && S.setTable(9) === '9' && S.setTable(7) === '7' && geo() === fresh);
  const g = S.newGame('8');
  check('newGame racks on the current table', Math.abs(g.balls.find(b => b.n === 1).x - S.FOOT[0]) < 1e-12 && g.balls[0].x === S.HEAD_X
    && (S.setTable('9'), Math.abs(S.newGame('9').balls.find(b => b.n === 1).x - 1.905) < 1e-12) && S.setTable('7') === '7');
}

/* 0b. pocket styles: regulation by default; setPockets rebuilds the same globals setTable does,
   either call order gives the same geometry, and going back to regulation gives exactly the
   fresh geometry (so every regulation check below runs on the very same table as before) */
{
  const geo = () => JSON.stringify([S.TABLE, S.POCKETS_STYLE, S.TL, S.TW, S.CUSH, S.CUSHION_POLYS, S.POCKETS, S.POCKET_R, S.POCKET_AIM]);
  const fresh = geo(), reg = { cush: S.CUSH, polys: S.CUSHION_POLYS, pockets: S.POCKETS, aim: S.POCKET_AIM, R: S.POCKET_R };
  check('pockets are regulation by default', S.POCKETS_STYLE === 'regulation');
  const r = S.setPockets('generous');
  check('setPockets(\'generous\'): every pocket global reassigned, the bed unchanged', r === 'generous' && S.POCKETS_STYLE === 'generous' && S.TABLE === '7' && S.TL === 1.981
    && S.CUSH !== reg.cush && S.CUSHION_POLYS !== reg.polys && S.POCKETS !== reg.pockets && S.POCKET_AIM !== reg.aim && S.POCKET_R !== reg.R);
  check('generous holes are wider than regulation ones (corner and side), the ball the same', S.POCKET_R.every((v, k) => v > reg.R[k]) && R === 0.028575, JSON.stringify(S.POCKET_R));
  const gen7 = geo();
  S.setTable('9'); const a = geo();
  S.setPockets('regulation'); S.setTable('9'); S.setPockets('generous'); const b = geo();
  S.setTable('7'); S.setPockets('regulation'); S.setTable('9'); S.setPockets('generous'); const c = geo();
  check('setTable and setPockets compose: either order gives the same geometry', a === b && b === c && a !== gen7, a.slice(0, 40));
  S.setTable('7');
  check('setTable keeps the pocket style', S.POCKETS_STYLE === 'generous' && geo() === gen7);
  const brk = () => JSON.stringify(shot(S.rack('8'), 0.01, 1, { x: 0.2, y: -0.3 }));
  check('generous pockets are deterministic: same break, same result', brk() === brk());
  check('setPockets: anything but \'generous\' is regulation, and gives back the fresh geometry exactly', S.setPockets('x') === 'regulation' && geo() === fresh
    && (S.setPockets('generous'), S.setPockets('regulation')) === 'regulation' && geo() === fresh);
}

/* 0c. generous pots more. A fixed set of lone balls rolled at the pockets from 0.6 m, soft,
   medium and firm (0.8, 1.6, 3 m/s): straight in at 0-60 mm off the mouth's middle (corner and
   side), into the side at 20, 30 and 40 degrees off square across the mouth, into a corner 5 and
   15 degrees off the long rail, and 400 shots at points across the mouths from anywhere. Every
   category pots more on generous pockets, and more of the shots that touch a jaw drop. Both
   tables. */
{
  const SPEEDS = [0.8, 1.6, 3.0];
  const roll = (x, y, a, v) => {
    const t = S.strike(S.newTable([cueAt(x, y)]), a, P(v), 0), kinds = play(t);
    return { pot: !t.balls[0].on, jaw: !!kinds.jaw };
  };
  const at = (k, a, off, v) => {
    const m = S.POCKET_AIM[k], ux = Math.cos(a), uy = Math.sin(a);
    return roll(m[0] - ux * 0.6 - uy * off, m[1] - uy * 0.6 + ux * off, a, v);
  };
  const offs = (lo, hi) => { const o = []; for (let i = Math.round(lo * 200); i <= Math.round(hi * 200); i++) o.push(i / 200); return o; };
  const measure = () => {
    const out = {}, count = (name, list) => { out[name] = list.filter(r => r.pot).length; return list; };
    for (const [name, k, a] of [['corner straight', 0, Math.atan2(-1, -1)], ['side straight', 1, -Math.PI / 2]])
      count(name, offs(-0.06, 0.06).flatMap(o => SPEEDS.map(v => at(k, a, o, v))));
    for (const deg of [20, 30, 40]) count(`side cut ${deg}`, [1, -1].flatMap(s => offs(-0.04, 0.04).flatMap(o => SPEEDS.map(v => at(1, -Math.PI / 2 + s * deg * DEG, o, v)))));
    for (const deg of [5, 15]) count(`corner ${deg} off rail`, offs(-0.04, 0.04).flatMap(o => SPEEDS.map(v => at(0, Math.PI + deg * DEG, o, v))));
    const rnd = S.rng(42), fz = [];
    for (let i = 0; i < 400; i++) {
      const k = Math.floor(rnd() * 6), m = S.POCKET_AIM[k], tx = m[0] + (rnd() - 0.5) * 0.2, ty = m[1] + (rnd() - 0.5) * 0.2;
      const x = 0.2 + rnd() * (S.TL - 0.4), y = 0.1 + rnd() * (S.TW - 0.2);
      fz.push(roll(x, y, Math.atan2(ty - y, tx - x), 1 + rnd() * 4));
    }
    count('mouth fuzz', fz);
    const jaw = fz.filter(r => r.jaw);
    out['jaw hits that drop, %'] = Math.round(100 * jaw.filter(r => r.pot).length / jaw.length);
    return out;
  };
  for (const size of SIZES) {
    S.setTable(size);
    const reg = (S.setPockets('regulation'), measure()), gen = (S.setPockets('generous'), measure());
    const worse = Object.keys(reg).filter(k => !(gen[k] > reg[k]));
    check(`${size} ft: generous pockets pot more in every category`, !worse.length, JSON.stringify({ reg, gen, worse }));
    /* the side holes moved into the rail (centre a few cm behind the nose, the front over the
       bed): regulation sides still take within 10% of what the old hole (centre a radius behind
       the nose, tangent to the nose line) took, category by category */
    const OLD = { '7': { 'side straight': 55, 'side cut 20': 96, 'side cut 30': 92, 'side cut 40': 76 }, '9': { 'side straight': 55, 'side cut 20': 96, 'side cut 30': 94, 'side cut 40': 76 } }[size];
    const off = Object.keys(OLD).filter(k => Math.abs(reg[k] / OLD[k] - 1) > 0.1);
    check(`${size} ft: regulation side pockets take within 10% of the old side hole in every side category`, !off.length, JSON.stringify({ reg, old: OLD, off }));
  }
  S.setTable('7'); S.setPockets('regulation');
}

/* 0. the contract's shapes, on both tables and both pocket styles */
eachTable((T, style) => {
  check(T + 'six pockets, six radii, six aim points', S.pockets().length === 6 && S.POCKETS.length === 6 && S.POCKET_R.length === 6 && S.POCKET_AIM.length === 6);
  const P = S.POCKETS, ok = P[0][0] < 0 && P[0][1] < 0 && Math.abs(P[1][0] - S.TL / 2) < 1e-9 && P[1][1] < 0 && P[2][0] > S.TL && P[3][1] > S.TW && P[4][1] > S.TW && P[5][0] > S.TL && P[5][1] > S.TW;
  check(T + 'pockets in the contract order: head-top, top side, foot-top, head-bottom, bottom side, foot-bottom', ok, JSON.stringify(P));
  const segs = new Set(S.CUSH.map(s => s.map(v => v.toFixed(9)).join()));
  const has = (p, q) => segs.has([...p, ...q].map(v => v.toFixed(9)).join()) || segs.has([...q, ...p].map(v => v.toFixed(9)).join());
  const inner = S.CUSHION_POLYS.every(poly => poly.length >= 3 && has(poly[0], poly[1]) && has(poly[1], poly[2]) && has(poly[2], poly[3]));
  const outside = S.CUSHION_POLYS.every(poly => poly.every(([x, y]) => x <= 1e-9 || x >= S.TL - 1e-9 || y <= 1e-9 || y >= S.TW - 1e-9));
  check(T + 'cushion polygons: inner edges are the collision segments, the rest lies off the bed', S.CUSHION_POLYS.length === 6 && inner && outside && S.CUSH.length === 18);
  /* mouths between jaw points, from the nose ends: corners 4.5-5 in, sides 5-5.5 in; generous
     corners 5.15-5.35 in, sides 5.65-5.85 in */
  const IN = 0.0254, mouth = k => {
    const m = S.POCKET_AIM[k], ends = S.CUSH.slice(0, 6).flatMap(s => [[s[0], s[1]], [s[2], s[3]]]).filter(p => Math.hypot(p[0] - m[0], p[1] - m[1]) < 0.1);
    return ends.length === 2 ? Math.hypot(ends[0][0] - ends[1][0], ends[0][1] - ends[1][1]) / IN : NaN;
  };
  const w = [0, 1, 2, 3, 4, 5].map(mouth);
  const [c0, c1, s0, s1] = style === 'generous' ? [5.15, 5.35, 5.65, 5.85] : [4.5, 5, 5, 5.5];
  check(T + `mouths: corners ${c0}-${c1} in, sides ${s0}-${s1} in`, w.every((v, k) => k === 1 || k === 4 ? v >= s0 && v <= s1 : v >= c0 && v <= c1), JSON.stringify(w.map(v => +v.toFixed(2))));
  const a = S.spinOf(0.5), b = S.spinOf({ x: 3, y: 4 }), c = S.spinOf(undefined), d = S.spinOf(-7);
  check(T + 'spinOf: a number is follow/draw, an object is clamped to the unit disc', a.x === 0 && a.y === 0.5 && Math.abs(b.x - 0.6) < 1e-12 && Math.abs(b.y - 0.8) < 1e-12 && c.x === 0 && c.y === 0 && d.y === -1, JSON.stringify([a, b, c, d]));
  check(T + 'power 1 is a hard break: 8-9 m/s', S.speedOf(1) >= 8 && S.speedOf(1) <= 9, String(S.speedOf(1)));
}, BOTH);

/* 0d. the side holes fit the slimmest rail: centre SIDE_BACK behind the nose, the back of the hole
   at most 94 mm out, so a 6 mm ring fits inside a 0.10 m rail; the front reaches onto the bed;
   a ball rolling frozen along the long rail passes a regulation side (a generous one reaches
   further and can take a slow one, as a real bucket does) */
eachTable((T, style) => {
  const back = [1, 4].map(k => Math.abs(S.POCKETS[k][1] - (k === 1 ? 0 : S.TW)) + S.POCKET_R[k]);
  const front = S.POCKET_R[1] - Math.abs(S.POCKETS[1][1]);
  check(T + 'side holes: back at most 94 mm behind the nose, front 1-4 cm onto the bed', back.every(b => b <= 0.094 + 1e-12) && front > 0.01 && front < 0.04, JSON.stringify({ back, front }));
  const along = v => { const t = S.strike(S.newTable([cueAt(0.3, R + 0.0005)]), 0, P(v), 0); play(t); return t.pocketOf[0]; };
  if (style === 'regulation') check(T + 'a ball rolling frozen along the long rail at 1.6 m/s passes the side pocket', along(1.6) !== 1, String(along(1.6)));
}, BOTH);

/* 1. pockets: straight at a corner, straight at a side, along a rail, a rattle; both tables,
   both pocket styles */
eachTable((T, style) => {
  const r = shot([cueAt(S.TL - 0.6, S.TW - 0.6)], Math.PI / 4, P(0.93));
  check(T + 'a ball rolled at a corner is potted', r.potted.includes(0), JSON.stringify(r.potted));
  const s = shot([cueAt(S.TL / 2, S.TW / 2)], -Math.PI / 2, P(0.93));
  check(T + 'a ball rolled at a side pocket is potted', s.potted.includes(0), JSON.stringify(s.potted));
  const t = S.strike(S.newTable([cueAt(1.0, R + 0.0005)]), Math.PI, P(1.57), 0);
  play(t);
  check(T + 'a ball rolling along the rail into a corner drops', t.potted.includes(0) && t.pocketOf[0] === 0, JSON.stringify({ potted: t.potted, k: t.pocketOf }));
  /* 15 degrees off the long rail, hard, a ball width wide of the mouth's middle: it hits the
     facing, bounces across and comes back out. Dead centre on the same line it drops. A
     generous bucket swallows that one (the jaw turns it in), and rattles 44 mm wide. */
  const m = S.POCKET_AIM[0], a = Math.PI + 15 * DEG, ux = Math.cos(a), uy = Math.sin(a);
  const from = off => [m[0] - ux * 0.7 - uy * off, m[1] - uy * 0.7 + ux * off];
  const rt = S.strike(S.newTable([cueAt(...from(style === 'generous' ? 0.044 : 0.032))]), a, P(3.53), 0), kinds = play(rt);
  const out = rt.balls[0];
  check(T + 'a hard ball into the jaw at a bad angle rattles out', kinds.jaw >= 1 && !rt.potted.length && out.on && out.x > 0 && out.y > 0, JSON.stringify({ kinds, potted: rt.potted }));
  if (style === 'generous') {
    const gt = S.strike(S.newTable([cueAt(...from(0.032))]), a, P(3.53), 0), gk = play(gt);
    check(T + 'the regulation rattle (32 mm wide) touches the jaw and drops', gk.jaw >= 1 && gt.potted.includes(0), JSON.stringify({ kinds: gk, potted: gt.potted }));
  }
  const ct = S.strike(S.newTable([cueAt(...from(0))]), a, P(3.53), 0);
  play(ct);
  check(T + 'the same line through the middle of the mouth drops', ct.potted.includes(0) && ct.pocketOf[0] === 0);
  check(T + 'a drop is reported as a pocket hit with its speed', (() => { const q = S.strike(S.newTable([cueAt(S.TL / 2, S.TW / 2)]), -Math.PI / 2, P(0.93), 0); let v = 0; while (S.stepTable(q)) for (const h of q.hits) if (h[0] === 'pocket') v = h[1]; for (const h of q.hits) if (h[0] === 'pocket') v = h[1]; return v > 0.1; })());
}, BOTH);

/* 1b. nothing hangs half over a hole. A ball that dies on the lip (within POCKET_LIP of the
   hole) creeps in; one that dies just outside it stays. Then 600 lags that die at the mouths,
   from every angle the bed allows, a little wide of the middle, at speeds from short to a
   little long: none rests with its centre over a hole or its lip, none rests more than a third
   of its radius over the drawn hole, and the ones that rest over it at all (genuine hangers,
   a sliver on the lip) stay rare. Both tables. */
eachTable(T => {
  const creep = (k, gap) => {
    const p = S.POCKETS[k], m = S.POCKET_AIM[k], d = Math.hypot(m[0] - p[0], m[1] - p[1]), r = S.POCKET_R[k] + gap;
    const b = S.newBall(0, p[0] + (m[0] - p[0]) / d * r, p[1] + (m[1] - p[1]) / d * r);
    Object.assign(b, { vx: (m[0] - p[0]) / d * 0.005, vy: (m[1] - p[1]) / d * 0.005 });
    const t = S.newTable([b]);
    Object.assign(t.balls[0], { wx: t.balls[0].vy / R, wy: -t.balls[0].vx / R });
    while (S.stepTable(t));
    return t.balls[0].on;
  };
  const lip = [0, 1, 2, 3, 4, 5].map(k => [creep(k, S.POCKET_LIP - 0.002), creep(k, S.POCKET_LIP + 0.002)]);
  check(T + 'a ball dying on a hole\'s lip creeps in, one dying just outside it stays', lip.every(([a, b]) => !a && b) && S.POCKET_LIP < R, JSON.stringify(lip));
  const rnd = S.rng(11), N = 600;
  let potted = 0, inside = 0, worst = 0, over = 0;
  for (let i = 0; i < N; i++) {
    const k = i % 6, m = S.POCKET_AIM[k], side = k === 1 || k === 4;
    const nx = side ? 0 : (m[0] < S.TL / 2 ? 1 : -1) * Math.SQRT1_2, ny = (m[1] < S.TW / 2 ? 1 : -1) * (side ? 1 : Math.SQRT1_2);
    const a = Math.atan2(ny, nx) + (rnd() * 2 - 1) * (side ? 1.1 : 0.8), d = 0.15 + rnd() * 0.6;
    const x = m[0] + Math.cos(a) * d, y = m[1] + Math.sin(a) * d;
    if (x < 0.05 || x > S.TL - 0.05 || y < 0.05 || y > S.TW - 0.05) { i--; continue; }
    const w = (rnd() * 2 - 1) * 0.05, tx = m[0] - Math.sin(a) * w, ty = m[1] + Math.cos(a) * w;
    /* the speed that rolls about to the mouth: a ball keeps 5/7 of it into the roll, which dies at mu_roll g */
    const reach = Math.hypot(tx - x, ty - y) + rnd() * 0.25 - 0.05, v = Math.sqrt(2 * 0.098 * Math.max(0.01, reach)) * 1.4 * (0.9 + rnd() * 0.3);
    const t = S.strike(S.newTable([cueAt(x, y)]), Math.atan2(ty - y, tx - x), P(v), 0);
    while (S.stepTable(t));
    const b = t.balls[0];
    if (!b.on) { potted++; continue; }
    let hang = 0;
    S.POCKETS.forEach((p, j) => {
      const dd = Math.hypot(b.x - p[0], b.y - p[1]);
      if (dd < S.POCKET_R[j] + S.POCKET_LIP) inside++;
      hang = Math.max(hang, S.POCKET_R[j] + R - dd);
    });
    if (hang > 0) over++;
    worst = Math.max(worst, hang);
  }
  const res = { potted, inside, over, worstMm: +(worst * 1000).toFixed(1) };
  check(T + '600 lags dying at the mouths: no ball rests with its centre over a hole or its lip', inside === 0 && potted > N / 2, JSON.stringify(res));
  check(T + '600 lags: no ball rests more than a third of its radius over a hole', worst < R / 3, JSON.stringify(res));
  check(T + '600 lags: hangers (resting over a hole at all) under 6% of lags that die at a mouth', over < 0.06 * N, JSON.stringify(res));
}, BOTH);

/* 2. cushions reflect, english bends the rebound */
{
  const t = S.newTable([cueAt(0.6, 0.6)]);
  S.strike(t, -Math.PI / 2, P(0.93), 0);
  let back = false;
  for (let i = 0; i < 20000 && S.stepTable(t); i++) if (t.balls[0].vy > 0) back = true;
  const b = t.balls[0];
  check('cushion reflects the ball', back && b.on && b.y >= R - 1e-9, JSON.stringify({ y: b.y, on: b.on }));
  /* straight into the foot rail from 0.74 m; the shooter faces +x, so his right is +y */
  const off = x => {
    const q = S.strike(S.newTable([cueAt(S.TL - 0.74, S.TW / 2)]), 0, P(1.57), { x, y: 0 }), c = q.balls[0];
    let k = -1;
    while (S.stepTable(q)) { if (k < 0 && c.vx < 0) k = 0; if (k >= 0 && ++k === 12) break; }
    return Math.atan2(c.vy, -c.vx) / DEG;
  };
  const right = off(1), left = off(-1), none = off(0);
  check('right english off a straight-in rail sends the cue ball right, left english left', right > 5 && left < -5 && Math.abs(none) < 1e-9, JSON.stringify({ right, left, none }));
  /* 30 degrees from the normal into the bottom rail, from 0.77 m off it: running english (here
     left) comes off wider, reverse narrower */
  const reb = x => {
    const q = S.strike(S.newTable([cueAt(0.4, S.TW - 0.77)]), 60 * DEG, P(1.57), { x, y: 0 }), c = q.balls[0];
    let k = -1;
    while (S.stepTable(q)) { if (k < 0 && c.vy < 0) k = 0; if (k >= 0 && ++k === 6) break; }
    return Math.atan2(c.vx, -c.vy) / DEG;
  };
  const run = reb(-1), plain = reb(0), rev = reb(1);
  check('running english lengthens the rebound angle, reverse shortens it', run > plain + 5 && rev < plain - 5, JSON.stringify({ run, plain, rev }));
  /* 30 and 40 degrees in from 0.67 m off the rail, full english at 1.5 and 3 m/s: the rebound angle 5 ms after the hit,
     and (at 1.5 m/s) the direction of the next 0.3 m once the cloth has bent the path. Reverse
     is smaller than running, as on a real cushion, but it reads: at least 4 degrees shorter off
     the cushion, and still shorter once the path has bent. */
  const bend = (deg, x, v) => {
    const q = S.strike(S.newTable([cueAt(0.3, S.TW - 0.67)]), (90 - deg) * DEG, P(v), { x, y: 0 }), c = q.balls[0];
    let k = -1, early = NaN, p0 = null;
    while (S.stepTable(q)) {
      if (k < 0 && c.vy < 0) k = 0;
      if (k >= 0 && ++k === 6) { early = Math.atan2(c.vx, -c.vy) / DEG; p0 = [c.x, c.y]; }
      if (p0 && Math.hypot(c.x - p0[0], c.y - p0[1]) > 0.3) break;
    }
    return [early, p0 ? Math.atan2(c.x - p0[0], p0[1] - c.y) / DEG : NaN];
  };
  const eng = [];
  for (const deg of [30, 40]) for (const v of [1.5, 3]) {
    const [r0, r1] = bend(deg, -1, v), [n0, n1] = bend(deg, 0, v), [v0, v1] = bend(deg, 1, v);
    eng.push({ deg, v, run: [r0 - n0, r1 - n1].map(a => +a.toFixed(1)), rev: [v0 - n0, v1 - n1].map(a => +a.toFixed(1)) });
  }
  check('reverse english shortens the rebound at 30-40 degrees in by at least 4 degrees, running lengthens it more',
    eng.every(e => e.rev[0] < -4 && (e.v > 2 || e.rev[1] < -2) && e.run[0] > 10 && e.run[0] > -e.rev[0]), JSON.stringify(eng));
}

/* 3. stun, follow, draw. Cue at 0.4, object 0.25-1 m ahead. Stun: velocities 5 ms after
   contact. Follow and draw: what the cue ball does once the cloth has taken out the slip,
   against its speed at contact, and how far it then goes. The object ball is lifted off 5 ms
   after contact, so on the 7 ft table it cannot come back off the foot rail into the cue ball's
   path; the cue ball's run ends when it stops, turns or meets a rail. */
{
  const lay = gap => [cueAt(0.4, S.TW / 2), S.newBall(1, 0.4 + gap, S.TW / 2)];
  const after = (spin, power = 0.5, gap = 0.25) => {
    const t = S.newTable(lay(gap));
    S.strike(t, 0, power, spin);
    const c = t.balls[0];
    let vc = 0;
    while (t.first === null) { vc = c.vx; if (!S.stepTable(t)) break; }
    for (let i = 0; i < 6; i++) S.stepTable(t);
    const at5 = { cue: c.vx, obj: t.balls[1].vx };
    t.balls[1].on = false;
    while (slip(c) > 1e-9 && S.stepTable(t));
    const roll = c.vx, x0 = c.x;
    let far = 0;
    t.hits.length = 0;
    while (S.stepTable(t) && Math.sign(c.vx) === Math.sign(roll) && !t.hits.length) far = Math.max(far, Math.abs(c.x - x0));
    return { vc, at5, roll, far };
  };
  const v0 = S.speedOf(0.5), stun = after(0).at5;
  check('stun: cue ball all but stops', Math.abs(stun.cue) < 0.15 * v0, JSON.stringify({ stun, v0 }));
  check('stun: object ball takes the speed', stun.obj > 0.7 * v0, JSON.stringify({ stun, v0 }));
  for (const gap of [0.3, 1]) {
    const fol = after(1, P(2.43), gap), drw = after(-1, P(gap < 0.5 ? 3.53 : 5.69), gap), stop = after(-0.25, P(2.43), gap);
    check(`follow over ${gap} m: cue ball rolls on after contact`, fol.roll > 0.2 * fol.vc && fol.far > 0.3, JSON.stringify(fol));
    check(`draw over ${gap} m: cue ball comes back toward the shooter`, drw.roll < -0.2 * drw.vc && drw.far > 0.3, JSON.stringify(drw));
    if (gap < 0.5) check('stop shot: a touch of draw leaves the cue ball dead', Math.abs(stop.roll) < 0.05 * stop.vc, JSON.stringify(stop));
  }
  check('first contact is recorded', shot(lay(0.25), 0, 0.5).first === 1);
  /* what the cue ball does after a full hit with the object ball 0.5 m ahead, by power, with
     the object ball lifted off once hit so nothing else gets in the way: how far it comes back
     (until it stops or meets a rail) and how far it goes on */
  const backOn = (spin, power, gap = 0.5) => {
    const t = S.strike(S.newTable([cueAt(1, S.TW / 2), S.newBall(1, 1 + gap, S.TW / 2)]), 0, power, spin), c = t.balls[0];
    while (t.first === null && S.stepTable(t));
    const x0 = c.x;
    S.stepTable(t); t.balls[1].on = false; t.hits.length = 0;
    let back = 0, on = 0;
    while (S.stepTable(t) && !t.hits.length) { back = Math.max(back, x0 - c.x); on = Math.max(on, c.x - x0); }
    return { back: +back.toFixed(3), on: +on.toFixed(3), first: t.first };
  };
  const d50 = backOn(-1, 0.5), s40 = backOn(-0.35, 0.4), c40 = backOn(0, 0.4), d35 = backOn(-1, 0.35, 0.6);
  check('full draw at 50% power over 0.5 m brings the cue ball back at least 0.4 m', d50.back >= 0.4, JSON.stringify(d50));
  check('stun at 40% power over 0.5 m (a touch below centre) stops within a ball width', s40.back < 2 * R && s40.on < 2 * R && c40.on > 0.2, JSON.stringify({ s40, centre: c40 }));
  check('35% power with full draw reaches a ball 0.6 m away', d35.first === 1, JSON.stringify(d35));
}

/* 3b. sliding turns into rolling: the slip dies at 7/2 mu g, leaving 5/7 of the speed */
{
  const t = S.strike(S.newTable([cueAt(0.3, S.TW / 2)]), 0, P(1.57), 0), c = t.balls[0], v0 = c.vx;
  while (slip(c) > 1e-9 && S.stepTable(t));
  const ts = t.t, vr = c.vx, want = 2 * v0 / (7 * S.MU_SLIDE * 9.8);
  let back = 0;
  for (let i = 0; i < 600 && S.stepTable(t); i++) back = Math.max(back, slip(c));
  check('a centre-ball hit slides, then rolls at 5/7 of its speed', Math.abs(ts - want) < 0.05 * want && Math.abs(vr / v0 - 5 / 7) < 0.02, JSON.stringify({ ts, want, ratio: vr / v0 }));
  check('once rolling it stays rolling', back < 1e-9, String(back));
}

/* 3c. squirt and throw */
{
  const dir = x => { const t = S.strike(S.newTable([cueAt(1, 0.6)]), 0, P(1.57), { x, y: 0 }); return Math.atan2(t.balls[0].vy, t.balls[0].vx) / DEG; };
  const r = dir(1), l = dir(-1);
  check('squirt: right english pushes the cue ball left of the cue line, 0.5-3 degrees', r < -0.5 && r > -3 && Math.abs(l + r) < 1e-9, JSON.stringify({ r, l }));
  /* a 30 degree cut with a touch of draw so the cue ball slides into it: the object ball
     leaves off the line of centres, dragged along the cue ball's path, and less so hard */
  const cut = (power, deg = 30, spin = { x: 0, y: -0.2 }) => {
    const ob = [1.3, S.TW / 2], a = deg * DEG, gx = ob[0] - 2 * R * Math.cos(a), gy = ob[1] - 2 * R * Math.sin(a);
    const t = S.strike(S.newTable([cueAt(gx - 0.3, gy), S.newBall(1, ob[0], ob[1])]), 0, power, spin);
    while (t.first === null && S.stepTable(t));
    const c = t.balls[0], o = t.balls[1];
    return (Math.atan2(o.vy, o.vx) - Math.atan2(o.y - c.y, o.x - c.x)) / DEG;
  };
  const slow = cut(P(0.93)), fast = cut(P(6.55));
  check('cut-induced throw: the object ball leaves over a degree off the line of centres', slow < -1, String(slow));
  check('cut-induced throw is smaller at high speed', fast < 0 && Math.abs(fast) < Math.abs(slow) / 2, JSON.stringify({ slow, fast }));
  const full = x => {
    const t = S.strike(S.newTable([cueAt(1, S.TW / 2), S.newBall(1, 1.3, S.TW / 2)]), 0, P(0.93), { x, y: 0 });
    while (t.first === null && S.stepTable(t));
    const c = t.balls[0], o = t.balls[1];
    return (Math.atan2(o.vy, o.vx) - Math.atan2(o.y - c.y, o.x - c.x)) / DEG;
  };
  const tr = full(1), tl = full(-1);
  check('spin-induced throw: right english throws the object ball left, left english right', tr < -1 && tl > 1, JSON.stringify({ tr, tl }));
}

/* 4. energy, rolling and spin included, never rises step to step: four balls, no cue ball,
   one of them spinning hard */
{
  const balls = [S.newBall(1, 0.5, 0.6), S.newBall(2, 1.0, 0.62), S.newBall(3, 1.06, 0.58), S.newBall(4, 1.12, 0.65)];
  const t = S.newTable(balls);
  Object.assign(t.balls[0], { vx: 3, vy: 0.05, wz: 40, wy: 60 });
  let prev = energy(t), rose = 0;
  for (let i = 0; i < 40000 && S.stepTable(t); i++) { const k = energy(t); if (k > prev * (1 + 1e-12) + 1e-15) rose++; prev = k; }
  check('total energy (moving and spinning) never rises step to step', rose === 0, 'rises: ' + rose);
}

/* 4b. at every cue-ball contact: the table's energy does not rise, the cue ball never leaves
   faster than its own energy allows, and the table gains no more moving energy than the cue
   ball's spin held */
{
  let worst = null, n = 0;
  for (const off of [-0.95, -0.7, -0.4, 0, 0.4, 0.7, 0.95]) for (const spin of [-1, 0, 1, { x: 1, y: 0 }, { x: -0.7, y: 0.7 }]) for (const p of [0.3, 0.6, 1]) {
    const t = S.newTable([cueAt(0.6, S.TW / 2), S.newBall(1, 0.9, S.TW / 2 + off * 2 * R)]);
    S.strike(t, 0, p, spin);
    let prev = null;
    while (t.first === null) {
      const c = t.balls[0];
      prev = { e: energy(t), lin: lin(t), v: Math.hypot(c.vx, c.vy), ce: S.energyOf(c), rot: S.energyOf(c) - (c.vx * c.vx + c.vy * c.vy) / 2 };
      if (!S.stepTable(t)) break;
    }
    const c = t.balls[0], v = Math.hypot(c.vx, c.vy);
    n++;
    const bad = energy(t) > prev.e + 1e-12 || v > prev.v + 1e-9 || v > Math.sqrt(2 * prev.ce) + 1e-9 || lin(t) > prev.lin + prev.rot + 1e-12;
    if (bad && !worst) worst = { off, spin, p, before: prev, v, e: energy(t), lin: lin(t) };
  }
  check('cue-ball contacts never speed the cue ball up or create energy', !worst, n + ' contacts ' + JSON.stringify(worst));
}

/* 5. determinism */
{
  const a = shot(S.rack('8'), 0.01, 1), b = shot(S.rack('8'), 0.01, 1);
  check('same break, same result', JSON.stringify(a) === JSON.stringify(b));
  const sp = { x: 0.4, y: -0.6 }, c = shot(S.rack('9'), -0.02, 0.9, sp), d = shot(S.rack('9'), -0.02, 0.9, sp);
  check('same break with english, same result', JSON.stringify(c) === JSON.stringify(d));
  const moved = a.balls.filter(x => x.n > 0).filter(x => {
    const o = S.rack('8').find(y => y.n === x.n);
    return !x.on || Math.hypot(x.x - o.x, x.y - o.y) > 0.1;
  }).length;
  check('a full break spreads the rack', moved >= 8, 'moved: ' + moved);
  check('the break comes to rest', a.end === 'rest', a.end);
  check('balls at rest have no velocity and no spin', a.balls.every(x => x.vx === 0 && x.vy === 0 && x.wx === 0 && x.wy === 0 && x.wz === 0));
}

/* 6. roll-out grows with power, a soft shot stops on the cloth; the power curve: a quarter is a
   gentle roll of 1.9-3.3 m (0.75-1.3 lengths of a 9 ft table), a half is firm, full is the
   break. Path lengths include cushion bounces, so they are measured on the 9 ft table they were
   set on; in metres, so the numbers are the same physics whatever table is the default. */
S.setTable('9');
{
  const dist = p => ball(shot([cueAt(0.4, S.TW / 2)], 0, p).balls, 0).x - 0.4;
  const d = [0.05, 0.1, 0.15, 0.2].map(dist);
  check('roll-out grows with power', d.every((v, i) => i === 0 || v > d[i - 1]) && d[0] > 0.01, JSON.stringify(d));
  const soft = shot([cueAt(0.4, S.TW / 2)], 0, 0.05);
  check('a soft shot comes to rest', soft.end === 'rest' && soft.potted.length === 0);
  const t = S.strike(S.newTable([cueAt(0.4, S.TW / 2 + 0.1)]), 0.05, 0.5, 0);
  let path = 0;
  while (S.stepTable(t)) path += Math.hypot(t.balls[0].vx, t.balls[0].vy) * S.SIM_DT;
  const lengths = p => {
    const q = S.strike(S.newTable([cueAt(0.4, S.TW / 2 + 0.1)]), 0.05, p, 0);
    let L = 0;
    while (S.stepTable(q)) L += Math.hypot(q.balls[0].vx, q.balls[0].vy) * S.SIM_DT;
    return L;
  };
  const q25 = lengths(0.25), q10 = lengths(0.1), q50 = path;
  check('power curve (9 ft table): 25% rolls a lone ball 1.905-3.302 m, 10% still rolls a ball width or more', q25 > 1.905 && q25 < 3.302 && q10 > 2 * R, JSON.stringify({ q10, q25 }));
  check('power curve (9 ft table): 50% is a firm shot, 5.842-10.16 m of path', q50 > 5.842 && q50 < 10.16, q50.toFixed(2) + ' m');
  const inv = [0, 0.1, 0.25, 0.5, 0.8, 1].every(p => Math.abs(S.powerFor(S.speedOf(p)) - p) < 1e-9);
  check('powerFor inverts speedOf', inv && S.powerFor(0) === 0 && S.powerFor(99) === 1);
}
S.setTable('7');

/* 7. rack shapes, on both tables: on the foot spot, on the cloth, clear of every cushion */
eachTable(T => {
  const e = S.rack('8'), n = S.rack('9');
  check(T + '8-ball rack: 15 object balls, 8 in the centre of the triangle', e.length === 16 && ball(e, 8).x > ball(e, 1).x, String(e.length));
  check(T + '9-ball rack: 9 object balls, 1 on the foot spot', n.length === 10 && Math.abs(ball(n, 1).x - S.FOOT[0]) < 1e-9, String(n.length));
  const tight = list => { let m = 9; for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) m = Math.min(m, Math.hypot(list[i].x - list[j].x, list[i].y - list[j].y)); return m; };
  check(T + 'racked balls do not overlap', tight(e) >= 2 * R - 1e-9 && tight(n) >= 2 * R - 1e-9, String(tight(e)));
  const clear = list => list.every(b => b.x > 0.1 && b.x < S.TL - 0.1 && b.y > 0.1 && b.y < S.TW - 0.1);
  check(T + 'racks and the cue ball sit on the cloth, well clear of the cushions, the cue ball on the head string', clear(e) && clear(n) && e[0].x === S.HEAD_X && e[0].y === S.TW / 2);
});

/* 8. fuzz: breaks from anywhere in the kitchen, shots on scattered layouts, hard shots at the
   jaws. Nothing NaN, nothing off the bed, nothing through a cushion, no overlap, no timeout,
   and the fail-safe never needed. Both tables, each with its own shots. */
eachTable(T => {
  const rnd = S.rng(T[0] === '7' ? 7 : 9);
  const segD = (b, s) => { const ex = s[2] - s[0], ey = s[3] - s[1], L = ex * ex + ey * ey, u = Math.max(0, Math.min(1, ((b.x - s[0]) * ex + (b.y - s[1]) * ey) / L)); return Math.hypot(b.x - s[0] - ex * u, b.y - s[1] - ey * u); };
  const audit = (t, i) => {
    const on = t.balls.filter(b => b.on);
    const nan = t.balls.some(b => !Number.isFinite(b.x + b.y + b.vx + b.vy + b.wx + b.wy + b.wz));
    const off = on.filter(b => b.x < 0 || b.x > S.TL || b.y < 0 || b.y > S.TW).length;
    const inRail = on.filter(b => S.CUSH.some(s => segD(b, s) < R - 1e-6)).length;
    let overlap = 0;
    for (let a = 0; a < on.length; a++) for (let c = a + 1; c < on.length; c++) overlap = Math.max(overlap, 2 * R - Math.hypot(on[a].x - on[c].x, on[a].y - on[c].y));
    return nan || off || inRail || t.escaped || overlap > 1e-4 || t.end !== 'rest' ? { i, nan, off, inRail, esc: t.escaped, overlap, end: t.end } : null;
  };
  const scatter = k => {
    const out = [cueAt(0.2 + rnd() * (S.TL - 0.4), 0.1 + rnd() * (S.TW - 0.2))];
    for (let n = 1; out.length <= k; n++) {
      for (let tries = 0; tries < 50; tries++) {
        const x = R + 0.01 + rnd() * (S.TL - 2 * R - 0.02), y = R + 0.01 + rnd() * (S.TW - 2 * R - 0.02);
        if (out.every(b => Math.hypot(b.x - x, b.y - y) > 2 * R + 0.002)) { out.push(S.newBall(n, x, y)); break; }
      }
    }
    return out;
  };
  const anySpin = () => rnd() < 0.5 ? rnd() * 2 - 1 : { x: rnd() * 2 - 1, y: rnd() * 2 - 1 };
  let bad = [], shots = 0;
  for (let i = 0; i < 300; i++) {
    let balls;
    if (i % 3 === 0) { balls = S.rack(i % 2 ? '8' : '9'); balls[0].x = 0.1 + rnd() * (S.HEAD_X - 0.1); balls[0].y = 0.1 + rnd() * (S.TW - 0.2); }
    else balls = scatter(1 + Math.floor(rnd() * 15));
    const t = S.strike(S.newTable(balls), rnd() * 2 * Math.PI, rnd(), anySpin());
    while (S.stepTable(t));
    shots++;
    const a = audit(t, i);
    if (a) bad.push(a);
  }
  check(T + '300 fuzzed shots: no NaN, escape, ball in a cushion, overlap or timeout', bad.length === 0, shots + ' shots, bad: ' + JSON.stringify(bad.slice(0, 3)));
  /* the same, but every shot aimed at a ball, with spin, so they all collide */
  bad = []; let hit = 0, fast = 0, rose = 0;
  for (let i = 0; i < 200; i++) {
    const balls = scatter(2 + Math.floor(rnd() * 14)), c = balls[0], o = balls[1 + Math.floor(rnd() * (balls.length - 1))];
    const ang = Math.atan2(o.y - c.y, o.x - c.x) + (rnd() - 0.5) * 0.06;
    const t = S.strike(S.newTable(balls), ang, 0.15 + rnd() * 0.85, anySpin());
    let e = energy(t);
    while (S.stepTable(t)) {
      for (const b of t.balls) if (Math.hypot(b.vx, b.vy) * S.SIM_DT > 0.0071) fast++;
      const e2 = energy(t);
      if (e2 > e * (1 + 1e-12) + 1e-15) rose++;
      e = e2;
    }
    if (t.first !== null) hit++;
    const a = audit(t, i);
    if (a) bad.push(a);
  }
  check(T + '200 aimed shots with spin: no NaN, escape or timeout', bad.length === 0 && hit > 150, 'hit ' + hit + ', bad: ' + JSON.stringify(bad.slice(0, 3)));
  check(T + 'no ball ever moves more than 7.1 mm in a step', fast === 0, 'steps over: ' + fast);
  check(T + 'energy never rises in a step of 200 aimed shots', rose === 0, 'rises: ' + rose);
  /* hard shots at points across every mouth and its jaws, from anywhere, with any spin */
  bad = []; let jaws = 0, potted = 0;
  for (let i = 0; i < 150; i++) {
    const k = Math.floor(rnd() * 6), m = S.POCKET_AIM[k], tx = m[0] + (rnd() - 0.5) * 0.2, ty = m[1] + (rnd() - 0.5) * 0.2;
    const balls = scatter(1 + Math.floor(rnd() * 3)), c = balls[0];
    const t = S.strike(S.newTable(balls), Math.atan2(ty - c.y, tx - c.x), 0.6 + rnd() * 0.4, anySpin());
    const kinds = play(t);
    if (kinds.jaw) jaws++;
    potted += t.potted.length;
    const a = audit(t, i);
    if (a) bad.push(a);
  }
  check(T + '150 hard shots into the mouths: nothing escapes', bad.length === 0 && jaws > 12 && potted > 30, `jaws ${jaws}, potted ${potted}, bad: ` + JSON.stringify(bad.slice(0, 3)));
  /* the fail-safe: a ball put off the bed away from every mouth is potted, and counted */
  const t = S.newTable([cueAt(1.8, S.TW / 2), S.newBall(3, 0.7, -0.3)]);
  Object.assign(t.balls[1], { vx: 0.5 });
  S.stepTable(t);
  check(T + 'the fail-safe pots a ball that got off the bed outside a mouth', !t.balls[1].on && t.potted.includes(3) && t.escaped === 1, JSON.stringify({ on: t.balls[1].on, esc: t.escaped }));
}, BOTH);

/* 9. the kitchen rule's input: crossed is true once the cue ball's centre reaches the head
   string after the strike, at or before first contact */
{
  const cross = (cue, obj, angle, power) => S.simulateShot([cueAt(...cue), ...obj.map(([n, x, y]) => S.newBall(n, x, y))], { angle, power, spin: 0 });
  const over = cross([0.3, 0.6], [[1, 1.5, 0.6]], 0, 0.3), behind = cross([0.3, 0.6], [[1, 0.5, 0.6]], 0, 0.3);
  const soft = cross([0.3, 0.6], [], Math.PI, 0.1), after = cross([0.3, 0.6], [[1, 0.45, 0.6 + 1.8 * R]], 0, 0.4);
  /* how far the cue ball got on that thin hit, step by step: it does reach the string, later */
  const reach = (() => { const t = S.strike(S.newTable([cueAt(0.3, 0.6), S.newBall(1, 0.45, 0.6 + 1.8 * R)]), 0, 0.4, 0); let m = 0; while (S.stepTable(t)) m = Math.max(m, t.balls[0].x); return m; })();
  /* an object ball a ball width past the string: contact with the cue ball's centre 3 mm past
     it counts, 3 mm short of it does not */
  const edge = gap => S.simulateShot([cueAt(0.3, 0.6), S.newBall(1, S.HEAD_X + 2 * R + gap, 0.6)], { angle: 0, power: 0.2, spin: 0 });
  const at = edge(0.003), short = edge(-0.003);
  check('crossed: a shot from the kitchen across the head string to a ball past it', over.crossed === true && over.first === 1, JSON.stringify({ crossed: over.crossed, first: over.first }));
  check('crossed: false when the cue ball hits a ball behind the string, or stays behind it', behind.crossed === false && behind.first === 1 && soft.crossed === false, JSON.stringify([behind.crossed, soft.crossed]));
  check('crossed: false when the cue ball only crosses after first contact', after.first === 1 && after.crossed === false && reach > S.HEAD_X, JSON.stringify({ crossed: after.crossed, reach }));
  check('crossed: judged at first contact, to the millimetre', at.first === 1 && at.crossed === true && short.first === 1 && short.crossed === false, JSON.stringify([at.crossed, short.crossed]));
  check('crossed is in resultOf, and a fresh table has not crossed', 'crossed' in S.resultOf(S.newTable([cueAt(0.3, 0.6)])) && S.newTable([cueAt(0.3, 0.6)]).crossed === false);
}

/* 10. bumper pool: the table through the same machinery (setTable('bumper', shape)), posts as rubber
   cylinders, cups in the bed, and the fuzz on that geometry, on the rectangle and the octagon */
for (const shape of ['rect', 'octagon']) {
  S.setTable('bumper', shape);
  const oct = shape === 'octagon', tag = `bumper ${shape}`;
  const cy = S.TW / 2, BR = S.BUMPER_R, CUPS = S.POCKETS;
  const sh = (balls, angle, power, spin = 0, ball) => S.simulateShot(balls, { angle, power, spin, ball });
  /* the bed as inward lines from the noses (CUSH runs clockwise round the bed) */
  const lines = S.CUSH.map(([ax, ay, bx, by]) => { const l = Math.hypot(bx - ax, by - ay), nx = (ay - by) / l, ny = (bx - ax) / l; return [nx, ny, nx * ax + ny * ay]; });
  const inside = (x, y) => Math.min(...lines.map(l => l[0] * x + l[1] * y - l[2]));
  const noses = S.CUSH.reduce((a, s) => a + Math.hypot(s[2] - s[0], s[3] - s[1]), 0);
  if (!oct) {
    check('bumper table: 33 x 48 in bed, four gapless noses, two cups on the long string, twelve posts',
      S.BUMPER_SHAPE === 'rect' && Math.abs(S.TL - 1.219) < 1e-9 && Math.abs(S.TW - 0.838) < 1e-9 && S.CUSH.length === 4 && S.CUSHION_POLYS.length === 4 && CUPS.length === 2 && S.POCKET_R.length === 2
      && S.BUMPERS.length === 12 && CUPS.every(p => p[1] === cy) && Math.abs(CUPS[0][0] - S.CUP_IN) < 1e-9 && Math.abs(S.TL - CUPS[1][0] - S.CUP_IN) < 1e-9 && S.BED_LINES === null);
    check('bumper table: the noses run the whole perimeter (no pocket gaps)', Math.abs(noses - 2 * (S.TL + S.TW)) < 1e-9);
  } else {
    const F = S.OCTA_F, side = F * (Math.SQRT2 - 1);
    check('bumper octagon: a regular octagon 40 in across the flats, eight equal noses, two cups on the long string, twelve posts',
      S.BUMPER_SHAPE === 'octagon' && Math.abs(F - 1.016) < 1e-9 && S.TL === F && S.TW === F && S.CUSH.length === 8 && S.CUSHION_POLYS.length === 8 && CUPS.length === 2
      && S.CUSH.every(s => Math.abs(Math.hypot(s[2] - s[0], s[3] - s[1]) - side) < 1e-9) && S.BUMPERS.length === 12
      && CUPS.every(p => p[1] === cy) && Math.abs(CUPS[0][0] - S.OCTA_CUP_IN) < 1e-9 && Math.abs(S.TL - CUPS[1][0] - S.OCTA_CUP_IN) < 1e-9,
      `flats ${F} m, nose ${side.toFixed(4)} m`);
    /* closed: each nose starts where the last ended; convex, every corner turning 45 degrees */
    const closed = S.CUSH.every((s, i) => { const n = S.CUSH[(i + 1) % 8]; return Math.hypot(n[0] - s[2], n[1] - s[3]) < 1e-12; });
    const turns = S.CUSH.map((s, i) => { const n = S.CUSH[(i + 1) % 8], a1 = Math.atan2(s[3] - s[1], s[2] - s[0]), a2 = Math.atan2(n[3] - n[1], n[2] - n[0]); return ((a2 - a1) / DEG + 540) % 360 - 180; });
    check('bumper octagon: the noses close the bed with no gaps, every corner a 45 degree turn (135 inside)',
      closed && turns.every(t => Math.abs(t - 45) < 1e-9) && Math.abs(noses - 8 * side) < 1e-9, JSON.stringify(turns.map(t => +t.toFixed(6))));
    /* mitred rubbers: neighbours share the nose corner and the back corner, the back CUSH_W behind
       both noses' lines (so the joint is on the corner's bisector), and the nose is the cushion */
    const Q = S.CUSHION_POLYS;
    const mitred = Q.every((q, i) => {
      const n = Q[(i + 1) % 8], l = lines[i], ln = lines[(i + 1) % 8], bk = q[3];
      const dl = -(l[0] * bk[0] + l[1] * bk[1] - l[2]), dn = -(ln[0] * bk[0] + ln[1] * bk[1] - ln[2]);
      return Math.hypot(q[2][0] - n[1][0], q[2][1] - n[1][1]) < 1e-12 && Math.hypot(q[3][0] - n[0][0], q[3][1] - n[0][1]) < 1e-12
        && Math.abs(dl - S.CUSH_W) < 1e-9 && Math.abs(dn - S.CUSH_W) < 1e-9 && Math.hypot(q[1][0] - S.CUSH[i][0], q[1][1] - S.CUSH[i][1]) < 1e-12;
    });
    check('bumper octagon: eight rubbers meet in mitres (shared corners, the joint on the bisector, CUSH_W deep)', mitred);
    check('bumper octagon: the sim\'s bed lines are the noses', S.BED_LINES.length === 8 && S.BED_LINES.every((l, i) => l.every((v, j) => Math.abs(v - lines[i][j]) < 1e-12)));
    /* a ball passes between every post and the nearest cushion, and the posts and cups are on the bed */
    const room = Math.min(...S.BUMPERS.map(q => inside(q[0], q[1]))), cupIn = Math.min(...CUPS.map(p => inside(p[0], p[1])));
    check('bumper octagon: posts and cups well inside the bed (a ball passes between a post and any cushion)', room > BR + 2 * R + 0.005 && cupIn > S.CUP_R + 2 * R, `post ${room.toFixed(3)} m, cup ${cupIn.toFixed(3)} m in`);
    /* the mitred corners: straight into each corner, soft, hard and with english, the ball comes
       back out of it, never through it or into the rubber */
    const corner = [];
    for (let i = 0; i < 8; i++) for (const [v, sp] of [[2, 0], [6, { x: 0.8, y: 0 }], [8.5, { x: -0.8, y: 0.5 }]]) {
      const vx = S.CUSH[i][0], vy = S.CUSH[i][1], from = [S.TL / 2 + (vx - S.TL / 2) * 0.55, S.TW / 2 + (vy - S.TW / 2) * 0.55 + 0.01];
      const t = S.strike(S.newTable([S.newBall(21, from[0], from[1])], 21), Math.atan2(vy - from[1], vx - from[0]), P(v), sp);
      let worst = 9;
      while (S.stepTable(t)) { const b = t.balls[0]; if (b.on) worst = Math.min(worst, inside(b.x, b.y)); }
      const b = t.balls[0];
      if (t.pocketOf[21] === -1 || t.escaped || worst < R - 1e-6 || !Number.isFinite(b.x + b.y)) corner.push({ i, v, worst, on: b.on, esc: t.escaped });
    }
    check('bumper octagon: straight into each of the eight corners (soft, hard, with english) the ball comes back, never through or into the rubber', corner.length === 0, JSON.stringify(corner.slice(0, 3)));
  }
  const pair = S.BUMPERS.filter(q => Math.abs(q[0] - CUPS[0][0]) < 0.12);
  check(`${tag}: each cup has a pair of posts in front, too close together for a ball to pass between`,
    pair.length === 2 && Math.hypot(pair[0][0] - pair[1][0], pair[0][1] - pair[1][1]) - 2 * BR < 2 * R && pair.every(q => q[0] > CUPS[0][0]));
  /* a post: straight on, the ball comes back; off centre it is turned away */
  /* the diamond's post nearest the top cushion, hit from the middle of the table */
  const post = S.BUMPERS[2], back = (() => {
    const t = S.strike(S.newTable([S.newBall(21, post[0], cy)], 21), -Math.PI / 2, P(1.2), 0);
    let kinds = {}, minGap = 9;
    while (S.stepTable(t)) { for (const h of t.hits) kinds[h[0]] = 1; t.hits.length = 0; const b = t.balls[0]; minGap = Math.min(minGap, Math.hypot(b.x - post[0], b.y - post[1]) - R - BR); if (b.vy > 0) break; }
    return { vx: t.balls[0].vx, vy: t.balls[0].vy, kinds, minGap };
  })();
  check(`${tag} post: a ball sent straight at a post rebounds straight back, a rail-like hit, never inside it`, back.vy > 0.3 && Math.abs(back.vx) < 1e-9 && back.kinds.rail && back.minGap > -1e-6, JSON.stringify(back));
  const glance = (() => {
    const t = S.strike(S.newTable([S.newBall(21, post[0] + 0.03, cy)], 21), -Math.PI / 2, P(1.2), 0);
    while (S.stepTable(t) && !t.hits.some(h => h[0] === 'rail'));
    /* a few steps on: the octagon's diamond is close enough that it could reach the next post in 20 */
    for (let i = 0; i < 4; i++) S.stepTable(t);
    return t.balls[0];
  })();
  check(`${tag} post: an off-centre hit turns the ball off to its side`, glance.vx > 0.2, JSON.stringify({ vx: glance.vx, vy: glance.vy }));
  /* the cups: a ball rolled over the middle drops, one past the edge does not; a fast ball skates
     over the lip a slow one falls in at */
  /* rolled from behind cup 1 (the end rail side: the posts guard its front) toward the middle;
     up: whether it is still up once it is past the cup (or has reached the posts) */
  const roll = (y, v) => {
    const t = S.strike(S.newTable([S.newBall(21, S.TL - 0.04, y)], 21), Math.PI, P(v), 0);
    while (S.stepTable(t) && t.balls[0].x > CUPS[1][0] - 0.06 && !t.hits.some(h => h[0] === 'rail'));
    return { potted: t.potted, pocketOf: t.pocketOf, up: t.balls[0].on };
  };
  const mid = roll(cy - 0.03, 0.8), miss = roll(cy + S.CUP_R + R * 0.6, 0.8);
  check(`${tag} cup: rolled across the middle it drops into that cup`, mid.potted[0] === 21 && mid.pocketOf[21] === 1, JSON.stringify(mid.potted));
  check(`${tag} cup: rolled past outside the hole it stays up`, miss.potted.length === 0);
  const edge = cy + S.CUP_R - S.CUP_LIP * 0.5, fast = roll(edge, 3), slow = (() => {
    const t = S.newTable([S.newBall(21, CUPS[1][0] + (oct ? 0.08 : 0.1), edge)], 21);
    Object.assign(t.balls[0], { vx: -0.25, wy: 0.25 / R });
    while (S.stepTable(t));
    return S.resultOf(t);
  })();
  check(`${tag} cup: over the lip a fast ball skates across, a slow one drops`, fast.up && slow.potted[0] === 21, JSON.stringify([fast.potted, slow.potted]));
  const rest = S.newTable([S.newBall(22, CUPS[0][0] + S.CUP_R - 0.002, cy)]);
  Object.assign(rest.balls[0], { vx: 0.005, wy: -0.005 / R });
  while (S.stepTable(rest));
  check(`${tag} cup: a ball dying with its centre over the hole drops`, !rest.balls[0].on && rest.pocketOf[22] === 0);
  /* no straight-in from the front: down the long string at the cup, the pair stops it */
  let blocked = 0;
  for (const v of [0.6, 1, 1.6, 2.5, 4]) if (!sh([S.newBall(31, S.TL / 2 - 0.05, cy + 0.0001 * v)].map(b => Object.assign(b, { x: CUPS[0][0] + (oct ? 0.15 : 0.25) })), Math.PI, P(v), 0, 31).potted.length) blocked++;
  check(`${tag} cup: the pair in front blocks a shot straight in from the front`, blocked === 5, String(blocked));
  /* determinism */
  const lay = () => S.newGame('bumper').balls;
  const d1 = JSON.stringify(sh(lay(), 0.7, 0.45, { x: 0.3, y: -0.4 }, 21)), d2 = JSON.stringify(sh(lay(), 0.7, 0.45, { x: 0.3, y: -0.4 }, 21));
  check(`${tag}: the same shot gives the same JSON, and the struck ball is the one named`, d1 === d2 && JSON.parse(d1).cue === 21 && S.TABLE === 'bumper' && S.BUMPER_SHAPE === shape);
  check(`${tag}: the starting balls are on the bed, clear of posts, cups and each other`, lay().every((b, i, a) => S.bumperFree(a, b.x, b.y, b.n) && inside(b.x, b.y) >= R));
  /* fuzz: scattered layouts (clear of posts and cups), any ball struck any way, aimed at balls,
     posts, cups and the bed's corners too. Nothing NaN, off the bed, in a cushion or a post,
     overlapping, escaped, or timed out. */
  const rnd = S.rng(oct ? 43 : 41);
  const audit = (t, i) => {
    const on = t.balls.filter(b => b.on);
    const nan = t.balls.some(b => !Number.isFinite(b.x + b.y + b.vx + b.vy + b.wx + b.wy + b.wz));
    const off = on.filter(b => inside(b.x, b.y) < R - 1e-6).length;
    const inPost = on.filter(b => S.BUMPERS.some(q => Math.hypot(b.x - q[0], b.y - q[1]) < R + BR - 1e-6)).length;
    let overlap = 0;
    for (let a = 0; a < on.length; a++) for (let c = a + 1; c < on.length; c++) overlap = Math.max(overlap, 2 * R - Math.hypot(on[a].x - on[c].x, on[a].y - on[c].y));
    return nan || off || inPost || t.escaped || overlap > 1e-4 || t.end !== 'rest' ? { i, nan, off, inPost, esc: t.escaped, overlap, end: t.end } : null;
  };
  const nums = [21, 22, 23, 24, 25, 31, 32, 33, 34, 35];
  const scatter = k => {
    const out = [];
    for (let i = 0; out.length < k && i < 500; i++) {
      const x = R + 0.002 + rnd() * (S.TL - 2 * R - 0.004), y = R + 0.002 + rnd() * (S.TW - 2 * R - 0.004);
      if (S.bumperFree(out, x, y, -1)) out.push(S.newBall(nums[out.length], x, y));
    }
    return out;
  };
  let bad = [], hits = 0, pots = 0, fast2 = 0;
  const N = oct ? 400 : 300;
  for (let i = 0; i < N; i++) {
    const balls = scatter(2 + Math.floor(rnd() * 9)), c = balls[Math.floor(rnd() * balls.length)];
    const goal = rnd() < 0.35 ? balls[Math.floor(rnd() * balls.length)] : rnd() < 0.5 ? { x: S.BUMPERS[i % 12][0], y: S.BUMPERS[i % 12][1] }
      : rnd() < 0.5 ? { x: CUPS[i % 2][0], y: CUPS[i % 2][1] } : rnd() < 0.5 ? { x: S.CUSH[i % S.CUSH.length][0], y: S.CUSH[i % S.CUSH.length][1] } : null;
    const ang = goal && goal !== c ? Math.atan2(goal.y - c.y, goal.x - c.x) + (rnd() - 0.5) * 0.08 : rnd() * 2 * Math.PI;
    const t = S.strike(S.newTable(balls, c.n), ang, rnd(), rnd() < 0.5 ? 0 : { x: rnd() * 2 - 1, y: rnd() * 2 - 1 });
    while (S.stepTable(t)) { for (const h of t.hits) if (h[0] === 'rail') hits++; t.hits.length = 0; for (const b of t.balls) if (Math.hypot(b.vx, b.vy) * S.SIM_DT > 0.0071) fast2++; }
    pots += t.potted.length;
    const a = audit(t, i);
    if (a) bad.push(a);
  }
  check(`${tag}: ${N} fuzzed shots on bumper geometry: no NaN, escape, ball in a cushion or post, overlap or timeout`,
    bad.length === 0 && hits > N && pots > 20 && fast2 === 0, `rail/post hits ${hits}, pots ${pots}, bad: ` + JSON.stringify(bad.slice(0, 3)));
}

/* every per-table value comes back exactly after a round of the tables: 8-ball -> snooker ->
   carom -> 9-ball -> bumper (both shapes), twice over. Geometry, the ball and the cloth
   (physOf's record), and a fixed shot's roll on each. */
{
  const GLOBALS = ['TABLE', 'TL', 'TW', 'BALL_R', 'MU_ROLL', 'CUE_RATIO', 'CUSH_MU', 'RAIL_E', 'MU_SP', 'HEAD_X', 'FOOT', 'CUSH', 'CUSHION_POLYS', 'POCKETS', 'POCKET_R', 'POCKET_AIM',
    'MOUTHS', 'BUMPERS', 'BED_LINES', 'JAW_ARCS', 'JAW_RAD', 'SPOTS', 'D_R', 'CPU_MOUTH_N'];
  const visit = [['8', () => { S.setTable('7'); return S.newGame('8'); }], ['snooker compact', () => { S.setTable('snooker', 'compact'); return S.newGame('snooker'); }],
    ['carom', () => S.newGame('carom')], ['9 (9 ft)', () => { S.setTable('9'); return S.newGame('9'); }],
    ['bumper octagon', () => { S.setTable('bumper', 'octagon'); return S.newGame('bumper'); }], ['bumper rect', () => { S.setTable('bumper', 'rect'); return S.newGame('bumper'); }],
    ['snooker full', () => { S.setTable('snooker', 'full'); return S.newGame('snooker'); }]];
  const snap = make => {
    const g = make(), ph = S.physOf(S.TABLE), cue = g.kind === 'bumper' ? 21 : g.kind === 'carom' ? 70 : 0;
    const roll = S.simulateShot(g.balls, { angle: 0.37, power: 0.55, spin: { x: 0.2, y: -0.3 }, ball: cue });
    return { vals: JSON.stringify(GLOBALS.map(n => S[n])), rec: [S.BALL_R, S.MU_ROLL, S.CUE_RATIO, S.CUSH_MU, S.RAIL_E, S.MU_SP].every((v, i) => v === [ph.R, ph.roll, ph.cue, ph.mu, ph.e, ph.sp][i]),
      roll: JSON.stringify(roll.balls.map(b => [b.n, b.on, b.x, b.y])) };
  };
  const first = visit.map(([, make]) => snap(make)), again = visit.map(([, make]) => snap(make));
  const diff = visit.map(([name], i) => (first[i].vals === again[i].vals && first[i].roll === again[i].roll && first[i].rec && again[i].rec ? '' : name)).filter(Boolean);
  const radii = visit.map(([, make]) => { make(); return S.BALL_R; });
  check('tables: 8-ball, snooker, carom, 9-ball and bumper pool round and round, every per-table value (geometry, ball, cloth, rubber) and a fixed roll come back exactly, each from its physics record',
    diff.length === 0 && radii.join() === [0.028575, 0.02625, 0.03075, 0.028575, 0.028575, 0.028575, 0.02625].join(), JSON.stringify({ diff, radii }));
}
S.setTable('7');
check('bumper: back on a pool table every pool global is rebuilt and the posts are gone', S.BUMPERS.length === 0 && S.POCKETS.length === 6 && S.CUSH.length === 18 && Math.abs(S.TL - 1.981) < 1e-9 && S.BED_LINES === null);

/* 11. spin about the vertical (audit F9, F10) and the elevated cue (swerve and masse).
   The cloth's spinning friction is pooltool's: the vertical spin falls at 5 u_sp g / (2R) with
   u_sp = 4/9 R, 10.89 rad/s^2 for every ball. A ball that stops still spinning turns in place
   until that takes the spin, and a ball that meets it meanwhile is thrown by it. An elevated cue
   with side spin curves the ball towards the english while it slides. The level cue is the old
   path exactly but for those two changes: the sim rebuilt with the old decay and rest prints what
   the build before them printed (tests/level-cue.cjs). */
{
  const { levelPrint, LEVEL_PRINT, oldSim } = require('./level-cue.cjs');
  const A = 2.5 * (10 * 2 / 5 / 9) * 9.8, DT = S.SIM_DT;
  /* every table: the documented rate, a stationary ball spinning in place, and its decay */
  const TABLES = [['7', () => S.setTable('7'), 0], ['9', () => S.setTable('9'), 0], ['snooker', () => S.setTable('snooker', 'compact'), 0], ['carom', () => S.setTable('carom'), 70],
    ['bumper octagon', () => S.setTable('bumper', 'octagon'), 21], ['bumper rect', () => S.setTable('bumper', 'rect'), 21]];
  const spinRows = [], rollRows = [];
  for (const [name, set, n] of TABLES) {
    set();
    const t = S.newTable([S.newBall(n, S.TL * 0.35, S.TW * 0.3)]), b = t.balls[0];   /* clear of every post and cup */
    b.wz = 30;
    for (let i = 0; i < 1200; i++) S.stepTable(t);   /* one second */
    const at1 = { wz: b.wz, moved: Math.hypot(b.x - S.TL * 0.35, b.y - S.TW * 0.3), v: Math.hypot(b.vx, b.vy), on: b.on };
    while (S.stepTable(t));
    spinRows.push({ name, rate: S.spinA(), at1, end: t.end, t: t.t, wz: b.wz, on: b.on });
    /* the rate on a ball rolling with english: the same deceleration while it rolls */
    const r = S.newTable([S.newBall(n, S.TL * 0.3, S.TW * 0.15)]), c = r.balls[0];
    Object.assign(c, { vx: 0.8, vy: 0, wx: 0, wy: -0.8 / S.BALL_R, wz: 40 });
    for (let i = 0; i < 600; i++) S.stepTable(r);   /* half a second */
    rollRows.push({ name, dwz: 40 - c.wz });
  }
  S.setTable('7');
  check('F10 spinning friction: every table (7 and 9 ft, snooker, carom, both bumper tables) takes the vertical spin off at 5/2 (4/9) g = 10.89 rad/s^2, pooltool\'s default',
    spinRows.every(r => Math.abs(r.rate - A) < 1e-12) && Math.abs(A - 10.8889) < 1e-4, JSON.stringify(spinRows.map(r => [r.name, r.rate])));
  check('F9 a ball at rest with side spin keeps turning in place: after 1 s it has not moved and has 30 - 10.89 rad/s left; the shot ends when the spin has gone, at 30 / 10.89 s (within a step)',
    spinRows.every(r => r.at1.moved === 0 && r.at1.v === 0 && r.at1.on && Math.abs(r.at1.wz - (30 - A)) < 1e-6 && r.end === 'rest' && r.wz === 0 && r.on && Math.abs(r.t - 30 / A) < 2 * DT), JSON.stringify(spinRows));
  check('F10 the decay while rolling matches the model within 0.1%: 0.5 s takes 5.44 rad/s off a rolling ball\'s english on every table',
    rollRows.every(r => Math.abs(r.dwz - A * 0.5) < A * 0.5 * 1e-3), JSON.stringify(rollRows));

  /* F9: a spinning ball at rest is struck square: its spin throws it off the line it would take
     without the spin (and a mirror spin throws it the other way) */
  const struck = wz => {
    const t = S.newTable([S.newBall(0, 0.5, S.TW / 2), S.newBall(1, 1.0, S.TW / 2)]);
    t.balls[1].wz = wz;
    t.balls[0].vx = 1.2; t.balls[0].wy = -1.2 / R;   /* rolling square into it */
    let seen = null;
    while (S.stepTable(t)) { const o = t.balls[1]; if (seen === null && t.first !== null && o.vx > 0.3) { seen = Math.atan2(o.vy, o.vx); break; } }
    return seen;
  };
  const dead = struck(0), cw = struck(25), ccw = struck(-25);
  check('F9 a stationary spinning ball is thrown by its own spin when struck square (either way, by the spin\'s sense); without spin it goes straight',
    Math.abs(dead) < 1e-9 && Math.abs(cw) > 1e-4 && Math.sign(cw) === -Math.sign(ccw) && Math.abs(cw + ccw) < 1e-9, JSON.stringify({ dead, cw, ccw }));

  /* the level cue: old path but for F9 and F10 */
  const missing = [], before = levelPrint(oldSim(loadSim, missing));
  check('level cue: the sim with the old spin decay and rest prints exactly what the build before F9 and F10 printed (100+ shots on 7 and 9 ft, snooker, carom)', before === LEVEL_PRINT && missing.length === 0, JSON.stringify({ before, LEVEL_PRINT, missing }));
  const ball0 = () => [S.newBall(0, 0.4, S.TW / 2), S.newBall(3, 1.2, S.TW / 2 + 0.03)];
  const same = [{ x: 0.5, y: -0.3 }, { x: -0.7, y: 0.2 }, 0.4].every(sp => {
    const a = JSON.stringify(S.simulateShot(ball0(), { angle: 0.02, power: 0.5, spin: sp }));
    const b = JSON.stringify(S.simulateShot(ball0(), { angle: 0.02, power: 0.5, spin: Object.assign(typeof sp === 'number' ? { x: 0, y: sp } : Object.assign({}, sp), { e: 0 }) }));
    return a === b;
  });
  const sp0 = S.spinOf({ x: 0.3, y: 0.1, e: 0 }), spE = S.spinOf({ x: 0.3, y: 0.1, e: 2 }), spBad = S.spinOf({ x: 0.3, y: 0.1, e: -1 });
  check('level cue: a spin with e 0 (or below) is the plain {x, y} and plays byte for byte the same; e is clamped to 60 degrees',
    same && !('e' in sp0) && !('e' in spBad) && spE.e === S.ELEV_MAX && Math.abs(S.ELEV_MAX - Math.PI / 3) < 1e-15, JSON.stringify({ sp0, spE, spBad }));

  /* the elevated strike: speed cos th of the level one, a centre hit spinless, side split into
     english (cos th) and travel-axis spin (sin th) */
  const st = (spin, a = 0) => S.strike(S.newTable([S.newBall(0, 0.5, S.TW / 2)]), a, 0.4, spin).balls[0];
  const lv = st({ x: 0.8, y: 0.2 }), up = st({ x: 0.8, y: 0.2, e: Math.PI / 4 }), mid = st({ x: 0, y: 0, e: Math.PI / 4 }), mid0 = st(0);
  const c45 = Math.SQRT1_2, k = 2.5 * Math.hypot(lv.vx, lv.vy) / R;
  check('elevated strike: the ball leaves at cos th of the level speed; a centre hit carries no spin at any elevation; english is cos th of the level, the rest of the side about the line of travel, follow unchanged',
    Math.abs(Math.hypot(up.vx, up.vy) - c45 * Math.hypot(lv.vx, lv.vy)) < 1e-12 && mid.wx === 0 && mid.wy === 0 && mid.wz === 0 && Math.abs(Math.hypot(mid.vx, mid.vy) - c45 * Math.hypot(mid0.vx, mid0.vy)) < 1e-12 &&
    Math.abs(up.wz - c45 * lv.wz) < 1e-9 && Math.abs(up.wx - k * 0.8 * S.TIP_MAX * c45) < 1e-9 * k && Math.abs(up.wy - lv.wy) < 1e-9, JSON.stringify({ lv, up, mid }));

  /* swerve and masse: the curve goes the english's way, mirrors exactly, and grows with elevation */
  const curve = (x, e, angle = 0, y = 0, pw = 0.4) => {
    const t = S.strike(S.newTable([S.newBall(0, angle ? S.TL - 0.4 : 0.4, S.TW / 2)]), angle, pw, { x, y, e: e * DEG }), c = t.balls[0];
    const a0 = Math.atan2(c.vy, c.vx);
    let len = 0, px = c.x, py = c.y;
    while (S.stepTable(t)) { len += Math.hypot(c.x - px, c.y - py); px = c.x; py = c.y; if (Math.hypot(c.vx + R * c.wy, c.vy - R * c.wx) < 1e-9) break; }
    let turn = Math.atan2(c.vy, c.vx) - a0;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    return { turn: turn / DEG, radius: len / Math.abs(turn), len };
  };
  const right30 = curve(1, 30), left30 = curve(-1, 30), back30 = curve(1, 30, Math.PI), level = curve(1, 0), right15 = curve(1, 15), masse = curve(0.7, 60, 0, -0.7);
  /* y grows down the screen, so a turn of + is clockwise: to the right of the line of travel */
  check('swerve: right english with a raised cue curves right of the line of travel (either way along the table), left english left, exact mirrors; a level cue does not curve',
    right30.turn > 10 && left30.turn === -right30.turn && Math.abs(back30.turn - right30.turn) < 1e-6 && Math.abs(level.turn) < 1e-9, JSON.stringify({ right30, left30, back30, level }));
  check('swerve and masse: more elevation, a tighter curve (15 degrees wide, 30 tighter, a 60 degree masse with draw tighter still)',
    right15.radius > right30.radius && right30.radius > masse.radius && masse.turn > 45, JSON.stringify({ right15, right30, masse }));

  /* determinism: an elevated shot gives the same JSON again, and again after a round of the tables */
  const eshot = () => JSON.stringify(S.simulateShot(ball0(), { angle: 0.05, power: 0.6, spin: { x: -0.6, y: -0.4, e: 0.7 } }));
  const e1 = eshot(), e2 = eshot();
  S.setTable('carom'); S.setTable('snooker'); S.setTable('7');
  check('elevated shots are deterministic: the same result twice and after carom and snooker and back', e1 === e2 && e2 === eshot());
}

done();

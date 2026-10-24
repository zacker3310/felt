/* physics-check (Node): the table physics. Corner and side pockets take a ball, cushions
   reflect, a stun hit stops the cue ball, follow and draw push it on or pull it back,
   ball-ball collisions never add energy, results are deterministic, the break spreads the
   rack, and fuzzed shots never produce a NaN, an escaped ball, an overlap or a timeout. */
'use strict';
const { check, done } = require('./lib.cjs');
const { loadSim } = require('./sim.cjs');
const S = loadSim();
const R = S.BALL_R;

const shot = (balls, angle, power, spin = 0) => S.simulateShot(balls, { angle, power, spin });
const cueAt = (x, y) => S.newBall(0, x, y);
const ball = (balls, n) => balls.find(b => b.n === n);

/* 1. pockets: straight at a corner, straight at a side */
{
  const r = shot([cueAt(S.TL - 0.6, S.TW - 0.6)], Math.PI / 4, 0.3);
  check('a ball rolled at a corner is potted', r.potted.includes(0), JSON.stringify(r.potted));
  const s = shot([cueAt(S.TL / 2, S.TW / 2)], -Math.PI / 2, 0.3);
  check('a ball rolled at a side pocket is potted', s.potted.includes(0), JSON.stringify(s.potted));
  const all = S.pockets();
  check('six pockets', all.length === 6, String(all.length));
}

/* 2. cushions reflect and keep the ball on the table */
{
  const t = S.newTable([cueAt(0.6, 0.6)]);
  S.strike(t, -Math.PI / 2, 0.3, 0);
  let back = false;
  for (let i = 0; i < 20000 && S.stepTable(t); i++) if (t.balls[0].vy > 0) back = true;
  const b = t.balls[0];
  check('cushion reflects the ball', back && b.on && b.y >= R - 1e-9, JSON.stringify({ y: b.y, on: b.on }));
}

/* 3. stun, follow, draw: cue at 0.6, object 0.25 m ahead, velocities 5 ms after contact */
{
  const lay = () => [cueAt(0.6, S.TW / 2), S.newBall(1, 0.85, S.TW / 2)];
  const after = spin => {
    const t = S.newTable(lay());
    S.strike(t, 0, 0.5, spin);
    while (t.first === null && S.stepTable(t));
    for (let i = 0; i < 5; i++) S.stepTable(t);
    return { cue: t.balls[0].vx, obj: t.balls[1].vx };
  };
  const v0 = S.speedOf(0.5), stun = after(0), fol = after(1), drw = after(-1);
  check('stun: cue ball all but stops', Math.abs(stun.cue) < 0.15 * v0, JSON.stringify({ stun, v0 }));
  check('stun: object ball takes the speed', stun.obj > 0.7 * v0, JSON.stringify({ stun, v0 }));
  check('follow: cue ball runs on', fol.cue > 0.2 * v0, JSON.stringify(fol));
  check('draw: cue ball comes back toward the shooter', drw.cue < -0.2 * v0, JSON.stringify(drw));
  check('first contact is recorded', shot(lay(), 0, 0.5).first === 1);
}

/* 4. ball-ball collisions never add energy (no cue ball, so no spin) */
{
  const balls = [S.newBall(1, 0.5, 0.6), S.newBall(2, 1.0, 0.62), S.newBall(3, 1.06, 0.58), S.newBall(4, 1.12, 0.65)];
  const t = S.newTable(balls);
  t.balls[0].vx = 3; t.balls[0].vy = 0.05; t.moving = true;
  const ke = () => t.balls.reduce((a, b) => a + b.vx * b.vx + b.vy * b.vy, 0);
  let prev = ke(), rose = 0;
  for (let i = 0; i < 30000 && S.stepTable(t); i++) { const k = ke(); if (k > prev + 1e-9) rose++; prev = k; }
  check('kinetic energy never rises step to step', rose === 0, 'rises: ' + rose);
}

/* 4b. the cue ball never leaves a contact faster than it arrived, and the table never gains
   more than the cue ball's spin energy (1/5 (s v)^2 per unit mass) at a cue-ball contact */
{
  let worst = null, n = 0;
  for (const off of [-0.95, -0.7, -0.4, 0, 0.4, 0.7, 0.95]) for (const spin of [-1, 0, 1]) for (const p of [0.3, 0.6, 1]) {
    const t = S.newTable([cueAt(0.6, S.TW / 2), S.newBall(1, 0.9, S.TW / 2 + off * 2 * R)]);
    S.strike(t, 0, p, spin);
    let prev = null;
    while (t.first === null && S.stepTable(t)) { const c = t.balls[0]; prev = { v: Math.hypot(c.vx, c.vy), s: c.s, ke: t.balls.reduce((a, b) => a + (b.vx * b.vx + b.vy * b.vy) / 2, 0) }; }
    const c = t.balls[0], v = Math.hypot(c.vx, c.vy), ke = t.balls.reduce((a, b) => a + (b.vx * b.vx + b.vy * b.vy) / 2, 0);
    n++;
    const bad = v > prev.v + 1e-9 || ke > prev.ke + prev.s * prev.s * prev.v * prev.v / 5 + 1e-9;
    if (bad && !worst) worst = { off, spin, p, before: prev, v, ke };
  }
  check('cue-ball contacts never speed the cue ball up or create energy', !worst, n + ' contacts ' + JSON.stringify(worst));
}

/* 5. determinism */
{
  const a = shot(S.rack('8'), 0.01, 1), b = shot(S.rack('8'), 0.01, 1);
  check('same break, same result', JSON.stringify(a) === JSON.stringify(b));
  const moved = a.balls.filter(x => x.n > 0).filter(x => {
    const o = S.rack('8').find(y => y.n === x.n);
    return !x.on || Math.hypot(x.x - o.x, x.y - o.y) > 0.1;
  }).length;
  check('a full break spreads the rack', moved >= 8, 'moved: ' + moved);
  check('the break comes to rest', a.end === 'rest', a.end);
}

/* 6. roll-out grows with power and a soft shot stops on the cloth */
{
  const dist = p => ball(shot([cueAt(0.4, S.TW / 2)], 0, p).balls, 0).x - 0.4;
  const d = [0.05, 0.1, 0.15, 0.2].map(dist);
  check('roll-out grows with power', d.every((v, i) => i === 0 || v > d[i - 1]) && d[0] > 0.01, JSON.stringify(d));
  const soft = shot([cueAt(0.4, S.TW / 2)], 0, 0.05);
  check('a soft shot comes to rest', soft.end === 'rest' && soft.potted.length === 0);
}

/* 7. rack shapes */
{
  const e = S.rack('8'), n = S.rack('9');
  check('8-ball rack: 15 object balls, 8 in the centre of the triangle', e.length === 16 && ball(e, 8).x > ball(e, 1).x, String(e.length));
  check('9-ball rack: 9 object balls, 1 on the foot spot', n.length === 10 && Math.abs(ball(n, 1).x - S.FOOT[0]) < 1e-9, String(n.length));
  const tight = list => { let m = 9; for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) m = Math.min(m, Math.hypot(list[i].x - list[j].x, list[i].y - list[j].y)); return m; };
  check('racked balls do not overlap', tight(e) >= 2 * R - 1e-9 && tight(n) >= 2 * R - 1e-9, String(tight(e)));
}

/* 8. fuzz: breaks from anywhere in the kitchen and shots on scattered layouts */
{
  const rnd = S.rng(7);
  let bad = [], shots = 0;
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
  for (let i = 0; i < 300; i++) {
    let balls;
    if (i % 3 === 0) { balls = S.rack(i % 2 ? '8' : '9'); balls[0].x = 0.1 + rnd() * (S.HEAD_X - 0.1); balls[0].y = 0.1 + rnd() * (S.TW - 0.2); }
    else balls = scatter(1 + Math.floor(rnd() * 15));
    const r = shot(balls, rnd() * 2 * Math.PI, rnd(), rnd() * 2 - 1);
    shots++;
    const on = r.balls.filter(b => b.on);
    const nan = r.balls.some(b => !Number.isFinite(b.x + b.y + b.vx + b.vy));
    const off = on.filter(b => b.x < 0 || b.x > S.TL || b.y < 0 || b.y > S.TW);
    let overlap = 0;
    for (let a = 0; a < on.length; a++) for (let c = a + 1; c < on.length; c++) overlap = Math.max(overlap, 2 * R - Math.hypot(on[a].x - on[c].x, on[a].y - on[c].y));
    if (nan || off.length || overlap > 1e-4 || r.end !== 'rest') bad.push({ i, nan, off: off.length, overlap, end: r.end });
  }
  check('300 fuzzed shots: no NaN, escape, overlap or timeout', bad.length === 0, shots + ' shots, bad: ' + JSON.stringify(bad.slice(0, 3)));
  /* the same, but every shot aimed at a ball, with spin, so they all collide */
  bad = []; let hit = 0, fast = 0;
  for (let i = 0; i < 200; i++) {
    const balls = scatter(2 + Math.floor(rnd() * 14)), c = balls[0], o = balls[1 + Math.floor(rnd() * (balls.length - 1))];
    const ang = Math.atan2(o.y - c.y, o.x - c.x) + (rnd() - 0.5) * 0.06;
    const t = S.strike(S.newTable(balls), ang, 0.15 + rnd() * 0.85, rnd() * 2 - 1);
    while (S.stepTable(t)) for (const b of t.balls) if (Math.hypot(b.vx, b.vy) * S.SIM_DT > 0.0071) fast++;
    const r = { balls: t.balls, end: t.end, first: t.first };
    if (r.first !== null) hit++;
    const on = r.balls.filter(b => b.on);
    const nan = r.balls.some(b => !Number.isFinite(b.x + b.y + b.vx + b.vy));
    const off = on.filter(b => b.x < 0 || b.x > S.TL || b.y < 0 || b.y > S.TW);
    if (nan || off.length || r.end !== 'rest') bad.push({ i, nan, off: off.length, end: r.end });
  }
  check('200 aimed shots with spin: no NaN, escape or timeout', bad.length === 0 && hit > 150, 'hit ' + hit + ', bad: ' + JSON.stringify(bad.slice(0, 3)));
  check('no ball ever moves more than 7 mm in a step', fast === 0, 'steps over: ' + fast);
}

done();

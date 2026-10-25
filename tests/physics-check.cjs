/* physics-check (Node): the table physics. Pockets take straight balls, a ball along the rail
   and spit out a hard ball off the jaw; cushions reflect and english bends the rebound; stun,
   follow, draw and the stop shot; sliding turns into rolling; squirt and throw; energy
   (rolling and spinning included) never rises; results are deterministic; the break spreads
   the rack; fuzzed shots never produce a NaN, an escaped ball, an overlap or a timeout, and
   the fail-safe pots anything that gets out. */
'use strict';
const { check, done } = require('./lib.cjs');
const { loadSim } = require('./sim.cjs');
const S = loadSim();
const R = S.BALL_R, DEG = Math.PI / 180;

const shot = (balls, angle, power, spin = 0) => S.simulateShot(balls, { angle, power, spin });
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

/* 0. the contract's shapes */
{
  check('six pockets, six radii, six aim points', S.pockets().length === 6 && S.POCKETS.length === 6 && S.POCKET_R.length === 6 && S.POCKET_AIM.length === 6);
  const P = S.POCKETS, ok = P[0][0] < 0 && P[0][1] < 0 && Math.abs(P[1][0] - S.TL / 2) < 1e-9 && P[1][1] < 0 && P[2][0] > S.TL && P[3][1] > S.TW && P[4][1] > S.TW && P[5][0] > S.TL && P[5][1] > S.TW;
  check('pockets in the contract order: head-top, top side, foot-top, head-bottom, bottom side, foot-bottom', ok, JSON.stringify(P));
  const segs = new Set(S.CUSH.map(s => s.map(v => v.toFixed(9)).join()));
  const has = (p, q) => segs.has([...p, ...q].map(v => v.toFixed(9)).join()) || segs.has([...q, ...p].map(v => v.toFixed(9)).join());
  const inner = S.CUSHION_POLYS.every(poly => poly.length >= 3 && has(poly[0], poly[1]) && has(poly[1], poly[2]) && has(poly[2], poly[3]));
  const outside = S.CUSHION_POLYS.every(poly => poly.every(([x, y]) => x <= 1e-9 || x >= S.TL - 1e-9 || y <= 1e-9 || y >= S.TW - 1e-9));
  check('cushion polygons: inner edges are the collision segments, the rest lies off the bed', S.CUSHION_POLYS.length === 6 && inner && outside && S.CUSH.length === 18);
  /* mouths between jaw points, from the nose ends: corners 4.5-5 in, sides 5-5.5 in */
  const IN = 0.0254, mouth = k => {
    const m = S.POCKET_AIM[k], ends = S.CUSH.slice(0, 6).flatMap(s => [[s[0], s[1]], [s[2], s[3]]]).filter(p => Math.hypot(p[0] - m[0], p[1] - m[1]) < 0.1);
    return ends.length === 2 ? Math.hypot(ends[0][0] - ends[1][0], ends[0][1] - ends[1][1]) / IN : NaN;
  };
  const w = [0, 1, 2, 3, 4, 5].map(mouth);
  check('mouths: corners 4.5-5 in, sides 5-5.5 in', w.every((v, k) => k === 1 || k === 4 ? v >= 5 && v <= 5.5 : v >= 4.5 && v <= 5), JSON.stringify(w.map(v => +v.toFixed(2))));
  const a = S.spinOf(0.5), b = S.spinOf({ x: 3, y: 4 }), c = S.spinOf(undefined), d = S.spinOf(-7);
  check('spinOf: a number is follow/draw, an object is clamped to the unit disc', a.x === 0 && a.y === 0.5 && Math.abs(b.x - 0.6) < 1e-12 && Math.abs(b.y - 0.8) < 1e-12 && c.x === 0 && c.y === 0 && d.y === -1, JSON.stringify([a, b, c, d]));
  check('power 1 is a hard break: 8-9 m/s', S.speedOf(1) >= 8 && S.speedOf(1) <= 9, String(S.speedOf(1)));
}

/* 1. pockets: straight at a corner, straight at a side, along a rail, a rattle */
{
  const r = shot([cueAt(S.TL - 0.6, S.TW - 0.6)], Math.PI / 4, 0.4);
  check('a ball rolled at a corner is potted', r.potted.includes(0), JSON.stringify(r.potted));
  const s = shot([cueAt(S.TL / 2, S.TW / 2)], -Math.PI / 2, 0.4);
  check('a ball rolled at a side pocket is potted', s.potted.includes(0), JSON.stringify(s.potted));
  const t = S.strike(S.newTable([cueAt(1.0, R + 0.0005)]), Math.PI, 0.5, 0);
  play(t);
  check('a ball rolling along the rail into a corner drops', t.potted.includes(0) && t.pocketOf[0] === 0, JSON.stringify({ potted: t.potted, k: t.pocketOf }));
  /* 15 degrees off the long rail, hard, a ball width wide of the mouth's middle: it hits the
     facing, bounces across and comes back out. Dead centre on the same line it drops. */
  const m = S.POCKET_AIM[0], a = Math.PI + 15 * DEG, ux = Math.cos(a), uy = Math.sin(a);
  const from = off => [m[0] - ux * 0.7 - uy * off, m[1] - uy * 0.7 + ux * off];
  const rt = S.strike(S.newTable([cueAt(...from(0.032))]), a, 0.7, 0), kinds = play(rt);
  const out = rt.balls[0];
  check('a hard ball into the jaw at a bad angle rattles out', kinds.jaw >= 1 && !rt.potted.length && out.on && out.x > 0 && out.y > 0, JSON.stringify({ kinds, potted: rt.potted }));
  const ct = S.strike(S.newTable([cueAt(...from(0))]), a, 0.7, 0);
  play(ct);
  check('the same line through the middle of the mouth drops', ct.potted.includes(0) && ct.pocketOf[0] === 0);
  check('a drop is reported as a pocket hit with its speed', (() => { const q = S.strike(S.newTable([cueAt(S.TL / 2, S.TW / 2)]), -Math.PI / 2, 0.4, 0); let v = 0; while (S.stepTable(q)) for (const h of q.hits) if (h[0] === 'pocket') v = h[1]; for (const h of q.hits) if (h[0] === 'pocket') v = h[1]; return v > 0.1; })());
}

/* 2. cushions reflect, english bends the rebound */
{
  const t = S.newTable([cueAt(0.6, 0.6)]);
  S.strike(t, -Math.PI / 2, 0.4, 0);
  let back = false;
  for (let i = 0; i < 20000 && S.stepTable(t); i++) if (t.balls[0].vy > 0) back = true;
  const b = t.balls[0];
  check('cushion reflects the ball', back && b.on && b.y >= R - 1e-9, JSON.stringify({ y: b.y, on: b.on }));
  /* straight into the foot rail; the shooter faces +x, so his right is +y */
  const off = x => {
    const q = S.strike(S.newTable([cueAt(1.8, S.TW / 2)]), 0, 0.5, { x, y: 0 }), c = q.balls[0];
    let k = -1;
    while (S.stepTable(q)) { if (k < 0 && c.vx < 0) k = 0; if (k >= 0 && ++k === 12) break; }
    return Math.atan2(c.vy, -c.vx) / DEG;
  };
  const right = off(1), left = off(-1), none = off(0);
  check('right english off a straight-in rail sends the cue ball right, left english left', right > 5 && left < -5 && Math.abs(none) < 1e-9, JSON.stringify({ right, left, none }));
  /* 30 degrees from the normal into the bottom rail: running english (here left) comes off
     wider, reverse narrower */
  const reb = x => {
    const q = S.strike(S.newTable([cueAt(0.4, 0.5)]), 60 * DEG, 0.5, { x, y: 0 }), c = q.balls[0];
    let k = -1;
    while (S.stepTable(q)) { if (k < 0 && c.vy < 0) k = 0; if (k >= 0 && ++k === 6) break; }
    return Math.atan2(c.vx, -c.vy) / DEG;
  };
  const run = reb(-1), plain = reb(0), rev = reb(1);
  check('running english lengthens the rebound angle, reverse shortens it', run > plain + 5 && rev < plain - 2, JSON.stringify({ run, plain, rev }));
}

/* 3. stun, follow, draw. Cue at 0.6, object 0.25-1 m ahead. Stun: velocities 5 ms after
   contact. Follow and draw: what the cue ball does once the cloth has taken out the slip,
   against its speed at contact, and how far it then goes */
{
  const lay = gap => [cueAt(0.6, S.TW / 2), S.newBall(1, 0.6 + gap, S.TW / 2)];
  const after = (spin, power = 0.5, gap = 0.25) => {
    const t = S.newTable(lay(gap));
    S.strike(t, 0, power, spin);
    const c = t.balls[0];
    let vc = 0;
    while (t.first === null) { vc = c.vx; if (!S.stepTable(t)) break; }
    for (let i = 0; i < 6; i++) S.stepTable(t);
    const at5 = { cue: c.vx, obj: t.balls[1].vx };
    while (slip(c) > 1e-9 && S.stepTable(t));
    const roll = c.vx, x0 = c.x;
    let far = 0;
    while (S.stepTable(t) && Math.sign(c.vx) === Math.sign(roll) && t.balls[1].x > c.x) far = Math.max(far, Math.abs(c.x - x0));
    return { vc, at5, roll, far };
  };
  const v0 = S.speedOf(0.5), stun = after(0).at5;
  check('stun: cue ball all but stops', Math.abs(stun.cue) < 0.15 * v0, JSON.stringify({ stun, v0 }));
  check('stun: object ball takes the speed', stun.obj > 0.7 * v0, JSON.stringify({ stun, v0 }));
  for (const gap of [0.3, 1]) {
    const fol = after(1, 0.6, gap), drw = after(-1, gap < 0.5 ? 0.7 : 0.85, gap), stop = after(-0.3, 0.6, gap);
    check(`follow over ${gap} m: cue ball rolls on after contact`, fol.roll > 0.2 * fol.vc && fol.far > 0.3, JSON.stringify(fol));
    check(`draw over ${gap} m: cue ball comes back toward the shooter`, drw.roll < -0.2 * drw.vc && drw.far > 0.3, JSON.stringify(drw));
    if (gap < 0.5) check('stop shot: a touch of draw leaves the cue ball dead', Math.abs(stop.roll) < 0.05 * stop.vc, JSON.stringify(stop));
  }
  check('first contact is recorded', shot(lay(0.25), 0, 0.5).first === 1);
}

/* 3b. sliding turns into rolling: the slip dies at 7/2 mu g, leaving 5/7 of the speed */
{
  const t = S.strike(S.newTable([cueAt(0.3, S.TW / 2)]), 0, 0.5, 0), c = t.balls[0], v0 = c.vx;
  while (slip(c) > 1e-9 && S.stepTable(t));
  const ts = t.t, vr = c.vx, want = 2 * v0 / (7 * 0.2 * 9.8);
  let back = 0;
  for (let i = 0; i < 600 && S.stepTable(t); i++) back = Math.max(back, slip(c));
  check('a centre-ball hit slides, then rolls at 5/7 of its speed', Math.abs(ts - want) < 0.05 * want && Math.abs(vr / v0 - 5 / 7) < 0.02, JSON.stringify({ ts, want, ratio: vr / v0 }));
  check('once rolling it stays rolling', back < 1e-9, String(back));
}

/* 3c. squirt and throw */
{
  const dir = x => { const t = S.strike(S.newTable([cueAt(1, 0.6)]), 0, 0.5, { x, y: 0 }); return Math.atan2(t.balls[0].vy, t.balls[0].vx) / DEG; };
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
  const slow = cut(0.4), fast = cut(0.9);
  check('cut-induced throw: the object ball leaves over a degree off the line of centres', slow < -1, String(slow));
  check('cut-induced throw is smaller at high speed', fast < 0 && Math.abs(fast) < Math.abs(slow) / 2, JSON.stringify({ slow, fast }));
  const full = x => {
    const t = S.strike(S.newTable([cueAt(1, S.TW / 2), S.newBall(1, 1.3, S.TW / 2)]), 0, 0.4, { x, y: 0 });
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
      prev = { e: energy(t), lin: lin(t), ce: S.energyOf(c), rot: S.energyOf(c) - (c.vx * c.vx + c.vy * c.vy) / 2 };
      if (!S.stepTable(t)) break;
    }
    const c = t.balls[0], v = Math.hypot(c.vx, c.vy);
    n++;
    const bad = energy(t) > prev.e + 1e-12 || v > Math.sqrt(2 * prev.ce) + 1e-9 || lin(t) > prev.lin + prev.rot + 1e-12;
    if (bad && !worst) worst = { off, spin, p, before: prev, v, e: energy(t), lin: lin(t) };
  }
  check('cue-ball contacts never create energy', !worst, n + ' contacts ' + JSON.stringify(worst));
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

/* 6. roll-out grows with power, a soft shot stops on the cloth, a medium one runs about two
   table lengths */
{
  const dist = p => ball(shot([cueAt(0.4, S.TW / 2)], 0, p).balls, 0).x - 0.4;
  const d = [0.05, 0.1, 0.15, 0.2].map(dist);
  check('roll-out grows with power', d.every((v, i) => i === 0 || v > d[i - 1]) && d[0] > 0.01, JSON.stringify(d));
  const soft = shot([cueAt(0.4, S.TW / 2)], 0, 0.05);
  check('a soft shot comes to rest', soft.end === 'rest' && soft.potted.length === 0);
  const t = S.strike(S.newTable([cueAt(0.4, S.TW / 2 + 0.1)]), 0.05, 0.5, 0);
  let path = 0;
  while (S.stepTable(t)) path += Math.hypot(t.balls[0].vx, t.balls[0].vy) * S.SIM_DT;
  check('power 0.5 rolls a lone ball 1.5-2 table lengths', path > 1.5 * S.TL && path < 2 * S.TL, (path / S.TL).toFixed(2) + ' lengths');
}

/* 7. rack shapes */
{
  const e = S.rack('8'), n = S.rack('9');
  check('8-ball rack: 15 object balls, 8 in the centre of the triangle', e.length === 16 && ball(e, 8).x > ball(e, 1).x, String(e.length));
  check('9-ball rack: 9 object balls, 1 on the foot spot', n.length === 10 && Math.abs(ball(n, 1).x - S.FOOT[0]) < 1e-9, String(n.length));
  const tight = list => { let m = 9; for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) m = Math.min(m, Math.hypot(list[i].x - list[j].x, list[i].y - list[j].y)); return m; };
  check('racked balls do not overlap', tight(e) >= 2 * R - 1e-9 && tight(n) >= 2 * R - 1e-9, String(tight(e)));
}

/* 8. fuzz: breaks from anywhere in the kitchen, shots on scattered layouts, hard shots at the
   jaws. Nothing NaN, nothing off the bed, nothing through a cushion, no overlap, no timeout,
   and the fail-safe never needed. */
{
  const rnd = S.rng(7);
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
  check('300 fuzzed shots: no NaN, escape, ball in a cushion, overlap or timeout', bad.length === 0, shots + ' shots, bad: ' + JSON.stringify(bad.slice(0, 3)));
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
  check('200 aimed shots with spin: no NaN, escape or timeout', bad.length === 0 && hit > 150, 'hit ' + hit + ', bad: ' + JSON.stringify(bad.slice(0, 3)));
  check('no ball ever moves more than 7.1 mm in a step', fast === 0, 'steps over: ' + fast);
  check('energy never rises in a step of 200 aimed shots', rose === 0, 'rises: ' + rose);
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
  check('150 hard shots into the mouths: nothing escapes', bad.length === 0 && jaws > 12 && potted > 30, `jaws ${jaws}, potted ${potted}, bad: ` + JSON.stringify(bad.slice(0, 3)));
  /* the fail-safe: a ball put off the bed away from every mouth is potted, and counted */
  const t = S.newTable([cueAt(1.8, S.TW / 2), S.newBall(3, 0.7, -0.3)]);
  Object.assign(t.balls[1], { vx: 0.5 });
  S.stepTable(t);
  check('the fail-safe pots a ball that got off the bed outside a mouth', !t.balls[1].on && t.potted.includes(3) && t.escaped === 1, JSON.stringify({ on: t.balls[1].on, esc: t.escaped }));
}

done();

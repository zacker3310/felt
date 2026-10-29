#!/usr/bin/env node
/* hero-solver: searches each table's signature shot for the setup hero (sim 1n, page 4m) and
   prints HERO_SHOTS to paste into index.html. Every candidate runs through heroSetup and
   simulateShot on that table and is judged by the real judge:
     pocket games: a legal break, the cue ball and the game ball up, one ball or more down;
       then the most balls down (up to three), the widest spread, the cue ball mid table
     snooker: a legal break-off from the D that pots a red, the cue ball up
     carom: a three-cushion point off the red first (the break's rule)
     bumper pool: the marked red into the far cup off a cushion, no foul
   and on any table with pockets every pot goes in at POT_V or faster and nothing rests on a lip
   and the shortest shot breaks ties (the hero plays it in about three seconds). One worker per
   table, four at a time. About five minutes.
   Usage: node tools/hero-solver.cjs [key,key,...]   (keys as heroKey makes them, e.g. 8|7|regulation) */
'use strict';
const { fork } = require('child_process');
const { loadSim } = require('../tests/sim.cjs');

const D = Math.PI / 180;
const POOL = ['8', '9', '10', 'straight', 'rotation'];
const KEYS = [...POOL.flatMap(k => ['7', '9'].flatMap(t => ['regulation', 'generous'].map(p => `${k}|${t}|${p}`))),
  'snooker|compact', 'snooker|full', 'bumper|octagon', 'bumper|rect', 'carom'];
const r6 = v => Math.round(v * 1e6) / 1e6;

function setFor(S, key) {
  const [kind, a, b] = key.split('|');
  if (POOL.includes(kind)) { S.setTable(a); S.setPockets(b); } else if (kind === 'snooker') S.setTable('snooker', a); else if (kind === 'bumper') S.setTable('bumper', a); else S.setTable('carom');
  return kind;
}
/* how spread the object balls lie: their mean distance from their centroid, over the table's length */
function spread(S, balls) {
  const o = balls.filter(b => b.on && b.n !== 0);
  if (!o.length) return 0;
  const cx = o.reduce((s, b) => s + b.x, 0) / o.length, cy = o.reduce((s, b) => s + b.y, 0) / o.length;
  return o.reduce((s, b) => s + Math.hypot(b.x - cx, b.y - cy), 0) / o.length / S.TL;
}
/* a pot the hero can show: every ball goes down with pace (none dribbles onto the lip, which from
   the hero's low camera reads as a ball hung up on the pocket), and no ball comes to rest on a
   pocket's lip. Played by strike and stepTable, as the hero plays it. */
const POT_V = 0.45;
function clean(S, H) {
  const tab = S.strike(S.newTable(H.balls, H.shot.ball), H.shot.angle, H.shot.power, H.shot.spin), was = new Map();
  for (let go = true, k = 0; go && k < 400000; k++) {
    for (const b of tab.balls) if (b.on) was.set(b.n, Math.hypot(b.vx, b.vy));
    go = S.stepTable(tab);
    for (const b of tab.balls) if (!b.on && was.has(b.n) && tab.potted.includes(b.n)) { if (was.get(b.n) < POT_V) return false; was.delete(b.n); }
  }
  return !tab.balls.some(b => b.on && S.POCKETS.some((p, k) => Math.hypot(b.x - p[0], b.y - p[1]) < S.POCKET_R[k] + S.BALL_R * 1.5));
}
function score(S, kind, sh) {
  const H = S.heroSetup(kind, sh), g = S.newGame(kind), n = H.shot.ball;
  if (S.POCKETS.length && !clean(S, H)) return null;
  g.balls = H.balls.map(b => Object.assign({}, b));
  const r = S.simulateShot(H.balls, H.shot), v = S.judge(g, r).verdict, slow = Math.max(0, r.t - 9) * 0.15;
  if (POCKET_OK(kind) && (v.foul || r.potted.includes(0) || !r.potted.length || r.potted.includes(gameBall(kind)))) return null;
  if (kind === 'snooker' && (v.foul || r.potted.includes(0) || !r.potted.some(S.isRed) || r.potted.some(x => !S.isRed(x)))) return null;
  if (kind === 'carom' && !(v.point && r.potted.length === 0)) return null;
  if (kind === 'bumper' && (v.foul || r.pocketOf[n] !== 1 || !(r.rails[n] >= 1) || r.potted.length !== 1)) return null;
  const cue = r.balls.find(b => b.n === n), mid = cue && cue.on ? 1 - Math.abs(cue.x / S.TL - 0.5) * 2 : 0;
  if (kind === 'carom') return 2 - slow - Math.abs(v.count.cushions - 4) * 0.1;
  if (kind === 'bumper') return 2 - slow - Math.abs((r.rails[n] || 0) - 1) * 0.2;
  return Math.min(3, r.potted.length) + 3 * spread(S, r.balls) + 0.3 * mid - slow;
}
const POCKET_OK = kind => POOL.includes(kind);
const gameBall = kind => kind === '8' ? 8 : kind === '9' ? 9 : kind === '10' ? 10 : -1;

function candidates(S, kind) {
  const out = [], n = S.heroBall(kind), b0 = S.heroSetup(kind, { a: 0, p: 1, s: [0, 0] }).balls;
  if (kind === 'snooker') {
    /* from five points across the D, at the apex red and the two behind it, full and a little thin */
    const aims = [41, 42, 43].map(m => b0.find(b => b.n === m));
    for (const f of [-0.9, -0.45, 0, 0.45, 0.9]) {
      const c = [(S.HEAD_X - 0.03) / S.TL, (S.TW / 2 + f * S.D_R * 0.95) / S.TW].map(r6);
      for (const t of aims) {
        const ax = Math.atan2(t.y - c[1] * S.TW, t.x - c[0] * S.TL);
        for (let k = -2.5; k <= 2.5 + 1e-9; k += 0.15) for (const p of [0.7, 0.85, 1]) for (const s of [[0, 0], [0, -0.3], [0.4, 0], [-0.4, 0]])
          out.push({ c, a: r6(ax + k * D), p, s });
      }
    }
    return out;
  }
  if (POOL.includes(kind)) {
    const apex = b0.find(b => b.n === 1);
    /* 14.1 racks as 8-ball does: its break comes from the other side of the table, so the two heroes differ */
    const spots = (kind === 'straight' ? [0.58, 0.66, 0.74] : [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74]).flatMap(y => [[0.25, y], [0.21, y]]);
    for (const c of spots) {
      const ax = Math.atan2(apex.y - c[1] * S.TW, apex.x - c[0] * S.TL);
      for (let k = -1.05; k <= 1.05 + 1e-9; k += 0.15) for (const p of [0.88, 0.94, 1]) for (const s of [[0, 0], [0, -0.25], [0, 0.2]])
        out.push({ c: c.map(r6), a: r6(ax + k * D), p, s });
    }
    return out;
  }
  if (kind === 'carom') {
    for (let k = 0; k < 720; k++) for (const p of [0.45, 0.6, 0.75, 0.9]) for (const s of [[0, 0], [0.5, 0.2], [-0.5, 0.2], [0.8, 0], [-0.8, 0]]) out.push({ a: r6(-Math.PI + k * 0.5 * D), p, s });
    return out;
  }
  for (let k = 0; k < 1440; k++) for (const p of [0.25, 0.35, 0.45, 0.55, 0.7]) out.push({ a: r6(-Math.PI + k * 0.25 * D), p, s: [0, 0] });
  void n;
  return out;
}

function solveKey(key) {
  const S = loadSim(), kind = setFor(S, key);
  let best = null, bs = -Infinity, valid = 0;
  for (const c of candidates(S, kind)) {
    const v = score(S, kind, c);
    if (v === null) continue;
    valid++;
    if (v > bs) { bs = v; best = c; }
  }
  /* what the stored shot does */
  let info = null;
  if (best) {
    const H = S.heroSetup(kind, best), r = S.simulateShot(H.balls, H.shot);
    info = { potted: r.potted, t: +r.t.toFixed(2), score: +bs.toFixed(3), valid };
  }
  return { key, best, info };
}

if (process.argv[2] === '--worker') {
  process.on('message', key => { process.send(solveKey(key)); });
} else {
  const want = process.argv[2] ? process.argv[2].split(',') : KEYS, out = {}, queue = want.slice();
  let live = 0;
  const next = () => {
    if (!queue.length) { if (!live) finish(); return; }
    const key = queue.shift(), w = fork(__filename, ['--worker']);
    live++;
    w.on('message', m => { out[m.key] = m; console.error(m.key, JSON.stringify(m.info)); w.kill(); live--; next(); });
    w.send(key);
  };
  const finish = () => {
    const lines = want.map(k => {
      const b = out[k] && out[k].best;
      if (!b) return `  /* ${k}: none found */`;
      return `  '${k}': { ${b.c ? `c: [${b.c.join(', ')}], ` : ''}a: ${b.a}, p: ${b.p}, s: [${b.s.join(', ')}] },`;
    });
    console.log('const HERO_SHOTS = {\n' + lines.join('\n') + '\n};');
  };
  for (let i = 0; i < 4; i++) next();
}

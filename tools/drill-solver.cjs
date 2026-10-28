#!/usr/bin/env node
/* drill-solver: plays every drill in the sim with the best shots a search finds, and writes
   tests/drill-solutions.json (per table setting, per drill: the shots [angle, power, side,
   vertical] and the scores they make), which drills-check plays on the page as the good run.
   Each shot is searched where it can be made: around the ghost-ball line to every pocket (and
   the pocket mirrored in each rail for a bank) for a pot, straight up the table for the power
   ladder, at the 1 for a break, and over every angle for kicks and safeties; then the best few
   are refined and the one whose neighbours (0.1 deg, 0.01 power) also score best is kept.
   The run-out looks one shot ahead. About seven minutes a setting.
   Usage: node tools/drill-solver.cjs [7r,9r,7g,9g] [id,id,...]   (default 7r: the table the suites play) */
'use strict';
const fs = require('fs');
const path = require('path');
const { loadSim } = require('../tests/sim.cjs');

const OUT = path.join(__dirname, '..', 'tests', 'drill-solutions.json');
const D = Math.PI / 180;
const POW = [0.08, 0.12, 0.16, 0.2, 0.25, 0.3, 0.36, 0.43, 0.5, 0.6, 0.72, 0.85, 1];
const SPIN = [[0, 0], [0, 0.5], [0, -0.5], [0, 1], [0, -1], [0.5, 0], [-0.5, 0], [0.5, 0.5], [-0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]];

function solver(S) {
  const R = () => S.BALL_R;
  const unit = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d]; };
  /* the ghost-ball angle from the cue ball c to pot ball p into the point m */
  const ghostAngle = (c, p, m) => { const u = unit(m, p), g = [p[0] + u[0] * 2 * R(), p[1] + u[1] * 2 * R()]; return Math.atan2(g[1] - c[1], g[0] - c[0]); };
  /* the pocket aims and their mirrors in the four cushion noses */
  const aims = (bank, k) => {
    const ps = k === undefined ? S.POCKET_AIM : [S.POCKET_AIM[k]], out = bank ? [] : ps.map(p => p.slice());
    if (bank) for (const p of ps) out.push([p[0], -p[1]], [p[0], 2 * S.TW - p[1]], [-p[0], p[1]], [2 * S.TL - p[0], p[1]]);
    return out;
  };
  const VERT = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1].map(y => [0, y]);
  function candidates(d, Sh) {
    const at = Object.fromEntries(Sh.balls), c = at[0], out = [];
    const add = (a0, span, step, pows, spins) => { for (let k = -span; k <= span + 1e-9; k += step) for (const p of pows) for (const s of spins) out.push([a0 + k * D, p, s[0], s[1]]); };
    if (d.id === 'power-ladder') { for (let p = 0.02; p <= 0.6; p += 0.002) out.push([0, +p.toFixed(3), 0, 0]); return out; }
    if (d.id === 'break-box') { const a = Math.atan2(at[1][1] - c[1], at[1][0] - c[0]); add(a, 0.3, 0.1, [0.8, 0.9, 1], [[0, 0], [0, -0.25], [0, -0.5], [0, -0.75], [0, -1], [0, 0.25]]); return out; }
    if (d.id === 'kick-ladder' || d.id === 'safety-ladder') { for (let k = 0; k < 1440; k++) for (const p of [0.12, 0.2, 0.3, 0.43, 0.6, 0.85]) for (const s of [[0, 0], [0, 0.5], [0, -0.5]]) out.push([-Math.PI + k * 0.25 * D, p, s[0], s[1]]); return out; }
    const n = Sh.target || (at[9] ? 9 : 1), pos = d.id === 'stop-shot' || d.id === 'spin-control';
    for (const m of aims(d.id === 'bank-ladder', Sh.pocket)) add(ghostAngle(c, at[n], m), 1, 0.1, POW, pos ? VERT : d.id === 'pattern-play' ? SPIN : SPIN.slice(0, 3));
    return out;
  }
  const shotOf = h => ({ angle: h[0], power: h[1], spin: { x: h[2], y: h[3] } });
  const judge = (d, Sh, h) => { const r = S.simulateShot(S.drillBalls(Sh), shotOf(h)); return { j: S.drillJudge(d, Sh, r), r }; };
  /* the best shot for Sh: highest score, then the steadiest */
  function best(d, Sh, keep = 1) {
    const scored = candidates(d, Sh).map(h => ({ h, s: judge(d, Sh, h).j.s }));
    const top = scored.reduce((a, x) => Math.max(a, x.s), 0);
    if (top <= 0) return [];
    let pool = scored.filter(x => x.s >= top - (d.id === 'power-ladder' ? 0 : 5));
    /* refine: finer angles round the best (kick and safety were swept coarsely) */
    if (d.id === 'kick-ladder' || d.id === 'safety-ladder') {
      const fine = [];
      for (const x of pool.slice(0, 200)) for (let k = -2; k <= 2; k++) for (const dp of [-0.03, 0, 0.03]) { const h = [x.h[0] + k * 0.05 * D, Math.min(1, Math.max(0.05, x.h[1] + dp)), x.h[2], x.h[3]]; fine.push({ h, s: judge(d, Sh, h).j.s }); }
      const t2 = fine.reduce((a, x) => Math.max(a, x.s), 0);
      pool = fine.filter(x => x.s >= t2);
    }
    const every = Math.max(1, Math.ceil(pool.length / 300));
    const ranked = pool.filter((_, i) => i % every === 0).map(x => {
      let n = 0;
      for (const k of [-2, -1, 1, 2]) if (judge(d, Sh, [x.h[0] + k * 0.1 * D, x.h[1], x.h[2], x.h[3]]).j.s >= x.s - 10) n++;
      for (const dp of [-0.02, -0.01, 0.01, 0.02]) if (judge(d, Sh, [x.h[0], Math.min(1, x.h[1] + dp), x.h[2], x.h[3]]).j.s >= x.s - 10) n++;
      return { h: x.h, s: x.s, n, rank: x.s * 10 + n - Math.hypot(x.h[2], x.h[3]) };
    }).sort((a, b) => b.rank - a.rank);
    return ranked.slice(0, keep);
  }
  function solveDrill(d) {
    const shots = [], js = [];
    let prev = null;
    for (let i = 0; i < d.shots; i++) {
      const Sh = S.drillShot(d, i, prev);
      let pick = null;
      if (d.id === 'pattern-play') {
        /* the run-out: of the best few, the one that leaves the next ball makeable */
        let bestNext = -1;
        for (const x of best(d, Sh, 8)) {
          const { j, r } = judge(d, Sh, x.h);
          if (!j.s) continue;
          if (j.left === 0) { pick = x; break; }
          const nx = best(d, S.drillShot(d, i + 1, r.balls))[0], v = nx ? nx.s : 0;
          if (v > bestNext) { bestNext = v; pick = x; }
        }
      } else pick = best(d, Sh)[0] || null;
      if (!pick) break;
      shots.push(pick.h.map(v => +(+v).toFixed(6)));
      const { j, r } = judge(d, Sh, pick.h);
      prev = r.balls;
      js.push(j);
      if (S.drillOver(d, js)) break;
    }
    const run = S.drillRun(d, shots.map(shotOf));
    return { shots, scores: run.js.map(j => j.s), total: run.total };
  }
  return { solveDrill };
}

const cfgs = (process.argv[2] || '7r').split(',');
const ids = process.argv[3] ? process.argv[3].split(',') : null;
const all = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
for (const cfg of cfgs) {
  const S = loadSim();
  S.setTable(cfg[0]); S.setPockets(cfg[1] === 'g' ? 'generous' : 'regulation');
  const { solveDrill } = solver(S);
  all[cfg] = all[cfg] || {};
  for (const d of S.DRILL_LIB) {
    if (ids && !ids.includes(d.id)) continue;
    const t0 = Date.now(), s = solveDrill(d);
    all[cfg][d.id] = s;
    console.log(`${cfg} ${d.id.padEnd(14)} ${String(s.total).padStart(3)}  [${s.scores.join(', ')}]  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
}
const lines = Object.keys(all).map(cfg => `  "${cfg}": {\n` + Object.entries(all[cfg]).map(([id, s]) => `    "${id}": ${JSON.stringify(s)}`).join(',\n') + '\n  }');
fs.writeFileSync(OUT, '{\n' + lines.join(',\n') + '\n}\n');

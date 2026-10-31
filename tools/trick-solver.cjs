#!/usr/bin/env node
/* trick-solver: finds a solution for every trick shot by brute force with the page's own
   simulateShot, and writes tests/trick-solutions.json, which solo-check and the page's
   TRICK_SOLS (Show me) are checked against. A sweep of every angle (0.5 deg) x power x spin
   per challenge, then the makes are ranked: most robust first (neighbours 0.05 deg and 0.02
   power away that also make it), with a preference for the cue ball going straight to a ball,
   little spin and a softer stroke, so Show me plays a natural shot. Slow (about a minute per
   challenge and table setting), so it runs here and not in the suite.
   A challenge with a sweep (the jump and masse group: the raised cue) is searched over its own
   elevations and tips as well: every angle (1 deg) x power (0.2 to 1 by 0.04) x elevation x tip,
   the makes counted (the margin: never one fragile solution), then ranked by neighbours 0.1 deg,
   0.02 power and 1 deg of elevation away that also make it, preferring a softer stroke and a tip
   nearer the centre. Its solution carries the elevation in whole degrees, as the pad sets it:
   [angle, power, side, vertical, degrees]. The margins go in the file's "margin" table
   ({ cfg: { id: [makes in the sweep, neighbours that make it] } }), which the suite reads.
   Usage: node tools/trick-solver.cjs [7r,9r,7g,9g] [id,id,...]   (or --print: the table again)
   Then paste the printed TRICK_SOLS into index.html. */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

const OUT = path.join(__dirname, '..', 'tests', 'trick-solutions.json');
const D = Math.PI / 180;
const POW = [0.12, 0.18, 0.25, 0.32, 0.4, 0.5, 0.6, 0.72, 0.85, 1];
const SPIN = [[0, 0], [0, 0.6], [0, -0.6], [0, -1], [0, 1], [0.6, 0], [-0.6, 0], [0.6, 0.6], [-0.6, 0.6], [0.6, -0.6], [-0.6, -0.6]];

const POW_E = Array.from({ length: 21 }, (_, i) => +(0.2 + i * 0.04).toFixed(2));
function solveRaised(S, c, balls) {
  const run = (a, p, sx, sy, e) => S.simulateShot(balls, { angle: a, power: p, spin: { x: sx, y: sy, e: e * D } });
  const ok = (...h) => h[1] > 0 && h[1] <= 1 && h[4] >= 0 && h[4] <= 60 && S.trickJudge(c, run(...h)).ok;
  const hits = [];
  for (let i = 0; i < 360; i++) { const a = -Math.PI + i * D; for (const p of POW_E) for (const e of c.sweep.e) for (const [sx, sy] of c.sweep.tips) if (ok(a, p, sx, sy, e)) hits.push([a, p, sx, sy, e]); }
  const every = Math.max(1, Math.ceil(hits.length / 400));
  let best = null;
  for (const h of hits.filter((_, i) => i % every === 0)) {
    let n = 0;
    for (let k = -3; k <= 3; k++) for (const dp of [-0.02, 0, 0.02]) for (const de of [-1, 0, 1]) if (ok(h[0] + k * 0.1 * D, +(h[1] + dp).toFixed(2), h[2], h[3], h[4] + de)) n++;
    const score = n - 2 * Math.hypot(h[2], h[3]) - h[1];
    if (!best || score > best.score) best = { score, n, h };
  }
  return best ? { sol: [+best.h[0].toFixed(6), best.h[1], best.h[2], best.h[3], best.h[4]], robust: best.n, makes: hits.length } : null;
}
function solveOne(cfg, id) {
  const S = require('../tests/sim.cjs').loadSim();
  S.setTable(cfg[0]); S.setPockets(cfg[1] === 'g' ? 'generous' : 'regulation');
  const c = S.trickById(id), balls = S.trickBalls(c);
  if (c.sweep) return solveRaised(S, c, balls);
  const run = (a, p, sx, sy) => S.simulateShot(balls, { angle: a, power: p, spin: { x: sx, y: sy } });
  const ok = (...h) => S.trickJudge(c, run(...h)).ok;
  const hits = [];
  for (let i = 0; i < 720; i++) { const a = -Math.PI + i * 0.5 * D; for (const p of POW) for (const [sx, sy] of SPIN) if (ok(a, p, sx, sy)) hits.push([a, p, sx, sy]); }
  const every = Math.max(1, Math.ceil(hits.length / 600));
  let best = null;
  for (const h of hits.filter((_, i) => i % every === 0)) {
    let n = 0;
    for (let k = -6; k <= 6; k++) if (ok(h[0] + k * 0.05 * D, h[1], h[2], h[3])) n++;
    for (const dp of [-0.04, -0.02, 0.02, 0.04]) if (ok(h[0], Math.min(1, h[1] + dp), h[2], h[3])) n++;
    const score = n + (id !== 'kick' && run(...h).kick === 0 ? 4 : 0) - 2 * Math.hypot(h[2], h[3]) - 2 * h[1];
    if (!best || score > best.score) best = { score, n, h };
  }
  return best ? { sol: [+best.h[0].toFixed(6), best.h[1], best.h[2], best.h[3]], robust: best.n, makes: hits.length } : null;
}

/* the solutions file, one challenge per line */
function writeSols(all) {
  const cfgs = Object.keys(all).map(cfg => `  "${cfg}": {\n` + Object.entries(all[cfg]).map(([id, s]) => `    "${id}": ${JSON.stringify(s)}`).join(',\n') + '\n  }');
  fs.writeFileSync(OUT, '{\n' + cfgs.join(',\n') + '\n}\n');
}
const MARGIN = 'margin';
/* the TRICK_SOLS line for index.html, one challenge per line */
function printSols(S, all) {
  const sols = {};
  for (const [cfg, m] of Object.entries(all)) for (const [id, s] of Object.entries(m)) (sols[id] = sols[id] || {})[cfg] = s;
  const row = id => `  ${id}: { ${Object.entries(sols[id]).map(([cfg, s]) => `'${cfg}': [${s.join(', ')}]`).join(', ')} },`;
  console.log('const TRICK_SOLS = {\n' + S.TRICKS.map(c => c.id).filter(id => sols[id]).map(row).join('\n') + '\n};');
}
const solsOnly = all => Object.fromEntries(Object.entries(all).filter(([k]) => k !== MARGIN));
if (process.argv[2] === '--print') {
  printSols(require('../tests/sim.cjs').loadSim(), solsOnly(JSON.parse(fs.readFileSync(OUT, 'utf8'))));
} else if (process.argv[2] === '--one') {
  process.stdout.write(JSON.stringify(solveOne(process.argv[3], process.argv[4])));
} else {
  const S = require('../tests/sim.cjs').loadSim();
  const cfgs = (process.argv[2] || '7r,9r,7g,9g').split(',');
  const ids = process.argv[3] ? process.argv[3].split(',') : S.TRICKS.map(c => c.id);
  const all = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
  const jobs = [];
  for (const cfg of cfgs) for (const id of ids) jobs.push([cfg, id]);
  let next = 0;
  const worker = () => new Promise(resolve => {
    const go = () => {
      if (next >= jobs.length) return resolve();
      const [cfg, id] = jobs[next++];
      let out = '';
      const ch = spawn(process.execPath, [__filename, '--one', cfg, id]);
      ch.stdout.on('data', d => { out += d; });
      ch.on('close', () => {
        const r = JSON.parse(out || 'null');
        console.error(cfg, id, JSON.stringify(r));
        all[cfg] = all[cfg] || {};
        if (r) all[cfg][id] = r.sol; else delete all[cfg][id];
        const m = all[MARGIN] = all[MARGIN] || {};
        m[cfg] = m[cfg] || {};
        if (r && r.makes !== undefined && S.trickById(id).sweep) m[cfg][id] = [r.makes, r.robust]; else delete m[cfg][id];
        go();
      });
    };
    go();
  });
  Promise.all(Array.from({ length: Math.max(1, Math.min(4, os.cpus().length)) }, worker)).then(() => {
    const inOrder = o => Object.fromEntries(S.TRICKS.map(c => c.id).filter(id => o[id]).map(id => [id, o[id]]));
    for (const cfg of Object.keys(all)) if (cfg !== MARGIN) all[cfg] = inOrder(all[cfg]);
    /* the margins last, after the four tables */
    if (all[MARGIN]) { const m = all[MARGIN]; delete all[MARGIN]; all[MARGIN] = Object.fromEntries(Object.keys(m).map(cfg => [cfg, inOrder(m[cfg])])); }
    writeSols(all);
    printSols(S, solsOnly(all));
  });
}

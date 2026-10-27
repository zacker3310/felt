#!/usr/bin/env node
/* tutorial-solver: finds a winning shot for every tutorial step (sim 1l) by brute force with the
   page's own simulateShot and the real judge, and writes tests/tutorial-solutions.json, which
   tutorial-check replays and the page's TUT_SOLS (Show me) must equal. Like trick-solver: a sweep
   of every angle (0.5 deg) x power x spin, from each of the step's placements when it has ball
   in hand (its places(T)), then the makes ranked most robust first (neighbours 0.1 deg and 0.03
   power away that also make it, the cue ball straight to a ball, little spin, a softer stroke), so
   Show me plays a natural shot (a step marked natural is searched with a centre hit only). It
   also prints how many shots of the sweep make each step: a tutorial teaches rules, not skill,
   so a step should be easy (a wide window).
   Usage: node tools/tutorial-solver.cjs [id,id,...] [step]   (or --print: the TUT_SOLS table)
   Then paste the printed TUT_SOLS into index.html. */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

const OUT = path.join(__dirname, '..', 'tests', 'tutorial-solutions.json');
const D = Math.PI / 180;
const POW = [0.15, 0.22, 0.3, 0.38, 0.46, 0.55, 0.65, 0.75, 0.88, 1];
const SPIN = [[0, 0], [0, 0.5], [0, -0.5], [0.5, 0], [-0.5, 0]];

function solveOne(id, i) {
  const S = require('../tests/sim.cjs').loadSim();
  const t = S.tutById(id), st = t.steps[i];
  S.setTable(...t.table); S.setPockets(t.pockets);
  const c = t.ctx ? t.ctx() : {}, g0 = S.tutGame(t, i, c);
  const places = g0.inHand ? st.places(S.trickHelpers()).filter(p => S.canPlace(g0, p[0], p[1])) : [null];
  const ball = t.kind === 'bumper' ? S.tutNum(t, i, c, st.pick) || g0.striker : t.kind === 'carom' ? g0.striker : 0;
  let best = null, makes = 0, tried = 0;
  for (const place of places) {
    const g = place ? S.placeCue(g0, place[0], place[1]) : g0;
    const run = (a, p, sx, sy) => S.simulateShot(g.balls, { angle: a, power: p, spin: { x: sx, y: sy }, ball });
    const ok = (...h) => S.tutJudge(t, i, g, run(...h)).ok;
    const hits = [];
    for (let k = 0; k < 720; k++) {
      const a = -Math.PI + k * 0.5 * D;
      for (const p of POW) for (const [sx, sy] of st.natural ? [[0, 0]] : SPIN) { tried++; if (ok(a, p, sx, sy)) hits.push([a, p, sx, sy]); }
    }
    makes += hits.length;
    const every = Math.max(1, Math.ceil(hits.length / 300));
    for (const h of hits.filter((_, k) => k % every === 0)) {
      let n = 0;
      for (let k = -5; k <= 5; k++) if (k && ok(h[0] + k * 0.1 * D, h[1], h[2], h[3])) n++;
      for (const dp of [-0.06, -0.03, 0.03, 0.06]) if (ok(h[0], Math.min(1, Math.max(0.05, h[1] + dp)), h[2], h[3])) n++;
      const r = run(...h), score = n + (r.kick === 0 ? 3 : 0) - 3 * Math.hypot(h[2], h[3]) - 2 * h[1];
      if (!best || score > best.score) best = { score, n, h, place };
    }
  }
  if (!best) return { sol: null, makes, tried };
  const sol = [+best.h[0].toFixed(6), best.h[1], best.h[2], best.h[3]];
  if (best.place) sol.push(+best.place[0].toFixed(6), +best.place[1].toFixed(6));
  else if (t.kind === 'bumper') sol.push(ball);
  return { sol, robust: best.n, makes, tried };
}

function writeSols(all) {
  const rows = Object.keys(all).map(id => `  "${id}": [\n` + all[id].map(s => `    ${JSON.stringify(s)}`).join(',\n') + '\n  ]');
  fs.writeFileSync(OUT, '{\n' + rows.join(',\n') + '\n}\n');
}
function printSols(all) {
  console.log('const TUT_SOLS = {\n' + Object.keys(all).map(id => `  '${id}': [${all[id].map(s => `[${(s || []).join(', ')}]`).join(', ')}],`).join('\n') + '\n};');
}
if (process.argv[2] === '--print') {
  printSols(JSON.parse(fs.readFileSync(OUT, 'utf8')));
} else if (process.argv[2] === '--one') {
  process.stdout.write(JSON.stringify(solveOne(process.argv[3], +process.argv[4])));
} else {
  const S = require('../tests/sim.cjs').loadSim();
  const ids = process.argv[2] ? process.argv[2].split(',') : S.TUTORIALS.map(t => t.id);
  const only = process.argv[3] !== undefined ? +process.argv[3] : null;
  const all = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
  const jobs = [];
  for (const id of ids) S.tutById(id).steps.forEach((_, i) => { if (only === null || only === i) jobs.push([id, i]); });
  let next = 0;
  const worker = () => new Promise(resolve => {
    const go = () => {
      if (next >= jobs.length) return resolve();
      const [id, i] = jobs[next++];
      let out = '';
      const ch = spawn(process.execPath, [__filename, '--one', id, String(i)]);
      ch.stdout.on('data', d => { out += d; });
      ch.stderr.on('data', d => process.stderr.write(d));
      ch.on('close', () => {
        const r = JSON.parse(out || 'null');
        console.error(id, i, r ? `makes ${r.makes} of ${r.tried} (${(100 * r.makes / r.tried).toFixed(2)}%), robust ${r.robust}, sol ${JSON.stringify(r.sol)}` : 'failed');
        all[id] = all[id] || [];
        all[id][i] = r ? r.sol : null;
        go();
      });
    };
    go();
  });
  Promise.all(Array.from({ length: Math.max(1, Math.min(4, os.cpus().length)) }, worker)).then(() => {
    const out = {};
    for (const t of S.TUTORIALS) if (all[t.id]) out[t.id] = t.steps.map((_, i) => all[t.id][i] || null);
    writeSols(out);
    printSols(out);
  });
}

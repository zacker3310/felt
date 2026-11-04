#!/usr/bin/env node
/* run-all: the canonical runner (`npm test`). Serves the repo root on a free port (or honours
   FELT_URL), resolves a Chromium (CHROMIUM env, else playwright-core's download), runs every
   tests/*-check.cjs, prints a table and exits non-zero when anything fails.
   Node-only suites (physics, rules, ai) simply ignore the URL.
   The suites run side by side: FELT_JOBS lanes (default: the machine's cores), each suite its own
   process against the one server, the multi-lane ones first, then the longest first. The suites with
   frame or wall-time budgets (TIMING) run first, each alone (SOLO), the rest side by side after (and those budgets are judged on the work, not on the waiting
   for a core: lib's frameClock and budgetWindow). A suite that runs its own parts side by side (COST)
   takes that many lanes. Each suite's output is held until it ends and the results print in suite
   order, so the table reads as a serial run's.
   Usage: node tests/run-all.cjs [--verbose] [--only name,name]   (FELT_JOBS=1: one at a time) */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const oi = args.indexOf('--only');
const only = oi >= 0 ? args[oi + 1].split(',').map(s => s.trim()) : null;
const SUITES = fs.readdirSync(__dirname).filter(f => f.endsWith('-check.cjs')).map(f => f.slice(0, -4)).sort()
  .filter(s => !only || only.includes(s));
const JOBS = Math.max(1, +process.env.FELT_JOBS || (os.availableParallelism ? os.availableParallelism() : os.cpus().length));
/* the suites with absolute frame or wall-time budgets, and the ones whose input checks read a gesture's pace on the
   clock (aim-check's rests and flicks, play-check's wheel and taps: CI 8ca3f4b, a 24 min run, read them as slow) */
const TIMING = new Set(['aim-check', 'audit-check', 'boot-check', 'hero-check', 'intro-check', 'look-check', 'motion-check', 'play-check', 'render-check', 'view3d-check']);
/* lanes a suite takes, about the cores it keeps busy (CPU seconds over wall seconds, 2026-11-02): stress-check
   runs its parts side by side (worker threads, a browser each), ai-check and ai2-check their games in workers */
const COST = { 'stress-check': 3, 'ai-check': 3, 'ai2-check': 2 };
/* the suites that run alone, every lane theirs: every TIMING suite. Taking the waiting for a core out of a
   frame is not enough on CI's runner: suites beside it slow the work itself (shared caches and memory; the
   16-ball frame 15.5 ms of work beside three lanes against about 10 alone), and view3d's SwiftShader threads
   and the frames its animations count on the clock need the cores too (CI 4c8c068: view3d 81/86 beside three
   lanes; 52ed014: look, motion beside them). Their weight puts them first, while every lane is free */
const SOLO = TIMING;
/* seconds each took in a serial run on the dev machine (2026-11-02, 4 cores, other jobs running): longest
   first, so the long ones do not start last; a new suite counts as a minute until it is listed */
const EST = {
  'railbar-check': 210, 'view3d-check': 134, 'qa-check': 133, 'motion-check': 123, 'career-check': 103, 'play-check': 100,
  'tutorial-check': 95, 'stress-check': 86, 'hig-check': 84, 'ai2-check': 73, 'hero-check': 65, 'intro-check': 61,
  'settings-check': 57, 'snooker-check': 51, 'called-check': 47, 'cosmetics-check': 46, 'aim-check': 45, 'ai-check': 43,
  'boot-check': 38, 'modes-check': 32, 'carom-check': 28, 'drills-check': 23, 'render-check': 23, 'audit-check': 20,
  'physics-check': 19, 'moments-check': 17, 'replay-check': 17, 'sound-check': 17, 'solo-check': 14, 'look-check': 11,
  'jumptricks-check': 10, 'heyball-check': 30, 'career2-check': 6, 'pottray-check': 60, 'pwa-check': 5, 'rules2-check': 2, 'rules-check': 1,
};

function chromium() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  const exe = require('playwright-core').chromium.executablePath();
  if (!fs.existsSync(exe)) { console.error('run-all: no Chromium. Run `npx playwright-core install chromium` or set CHROMIUM.'); process.exit(2); }
  return exe;
}
const MIME = { '.html': 'text/html; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.js': 'text/javascript; charset=utf-8' };
function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.normalize(path.join(ROOT, p));
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}
function run(name, env) {
  return new Promise(resolve => {
    const t0 = Date.now();
    let out = '';
    const child = spawn(process.execPath, [path.join(__dirname, name + '.cjs')], { cwd: __dirname, env });
    const sink = c => { out += c; };
    child.stdout.on('data', sink);
    child.stderr.on('data', sink);
    child.on('close', code => {
      const m = out.match(/(\d+)\/(\d+) passed\s*$/m);
      resolve({ name, code, out, passed: m ? +m[1] : 0, total: m ? +m[2] : 0, ms: Date.now() - t0 });
    });
  });
}
(async () => {
  if (!SUITES.length) { console.error('run-all: no suites match'); process.exit(2); }
  const exe = chromium();
  let srv = null, url = process.env.FELT_URL;
  if (!url) { srv = await serve(); url = `http://127.0.0.1:${srv.address().port}/index.html`; }
  console.log(`felt tests | ${SUITES.length} suites | ${url} | ${JOBS} lane(s)\n`);
  const env = { ...process.env, CHROMIUM: exe, FELT_URL: url };
  const results = new Array(SUITES.length), T0 = Date.now();
  /* from three lanes up a multi-lane suite always leaves the timing lane free */
  const cost = s => SOLO.has(s) ? JOBS : Math.min(JOBS > 2 ? JOBS - 1 : JOBS, COST[s] || 1);
  /* the suites that take several lanes first (while the lanes are free: started later they would wait for
     every lane to drain and end the run alone), then longest first */
  const work = s => (EST[s] || 60) * cost(s);
  const queue = SUITES.map((s, i) => i).sort((a, b) => (cost(SUITES[b]) > 1) - (cost(SUITES[a]) > 1) || work(SUITES[b]) - work(SUITES[a]) || a - b);
  let free = JOBS, timingOn = false, printed = 0;
  const print = () => {
    while (printed < SUITES.length && results[printed]) {
      const r = results[printed++];
      if (verbose) process.stdout.write(`\n=== ${r.name} (${(r.ms / 1000).toFixed(1)}s) ===\n${r.out}`);
      else console.log(r.name.padEnd(24) + ' ... ' + (r.code === 0 ? `ok   ${r.passed}/${r.total}  ${(r.ms / 1000).toFixed(1)}s` : `FAIL ${r.passed}/${r.total}  ${(r.ms / 1000).toFixed(1)}s`));
    }
  };
  await new Promise(resolve => {
    let running = 0;
    const live = new Map();
    const pump = () => {
      if (!queue.length && !running) return resolve();
      /* one lane is kept for the timing suites while any is left (from three lanes up), and a multi-lane
         suite that does not fit yet holds the lanes as they free: a one-lane suite overtakes it only when
         it should end (EST) before those lanes are free anyway (a backfill) */
      let until = Infinity;
      for (let q = 0; q < queue.length;) {
        const keep = JOBS > 2 && !timingOn && queue.some(j => TIMING.has(SUITES[j])) ? 1 : 0;
        const i = queue[q], s = SUITES[i], c = cost(s), timing = TIMING.has(s), now = Date.now();
        const fits = timing ? !timingOn && free >= c : c <= free - keep && (c > 1 || now + (EST[s] || 60) * 1000 <= until);
        if (!fits) {
          if (!timing && c > 1 && until === Infinity) {
            /* when this one could start: the running suites' expected ends, lanes freed in order */
            const ends = [...live.values()].filter(x => !x.timing).sort((a, b) => a.end - b.end);
            let f = free - keep;
            until = now;
            for (const x of ends) { if (f >= c) break; f += x.c; until = Math.max(now, x.end); }
          }
          q++; continue;
        }
        queue.splice(q, 1); free -= c; running++;
        if (timing) timingOn = true;
        live.set(i, { c, timing, end: now + (EST[s] || 60) * 1000 });
        run(s, env).then(r => {
          results[i] = r; free += c; running--; live.delete(i);
          if (timing) timingOn = false;
          print(); pump();
        });
      }
    };
    pump();
  });
  if (srv) srv.close();
  const failed = results.filter(r => r.code !== 0);
  const wall = (Date.now() - T0) / 1000, serial = results.reduce((a, r) => a + r.ms, 0) / 1000;
  console.log(`\n${JOBS} lane(s): ${Math.floor(wall / 60)}m${String(Math.floor(wall % 60)).padStart(2, '0')}s wall, ${Math.round(serial)} s of suites`);
  if (!verbose) for (const r of failed) console.log(`\n--- ${r.name} ---\n${r.out.trim()}`);
  const p = results.reduce((a, r) => a + r.passed, 0), t = results.reduce((a, r) => a + r.total, 0);
  console.log(`\n${results.length - failed.length}/${results.length} suites, ${p}/${t} checks  ${failed.length ? 'FAIL' : 'ok'}`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('run-all: ' + (e.stack || e)); process.exit(2); });

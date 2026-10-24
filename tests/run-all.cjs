#!/usr/bin/env node
/* run-all: the canonical runner (`npm test`). Serves the repo root on a free port (or honours
   FELT_URL), resolves a Chromium (CHROMIUM env, else playwright-core's download), runs every
   tests/*-check.cjs in turn, prints a table and exits non-zero when anything fails.
   Node-only suites (physics, rules, ai) simply ignore the URL.
   Usage: node tests/run-all.cjs [--verbose] [--only name,name] */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const oi = args.indexOf('--only');
const only = oi >= 0 ? args[oi + 1].split(',').map(s => s.trim()) : null;
const SUITES = fs.readdirSync(__dirname).filter(f => f.endsWith('-check.cjs')).map(f => f.slice(0, -4)).sort()
  .filter(s => !only || only.includes(s));

function chromium() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  const exe = require('playwright-core').chromium.executablePath();
  if (!fs.existsSync(exe)) { console.error('run-all: no Chromium. Run `npx playwright-core install chromium` or set CHROMIUM.'); process.exit(2); }
  return exe;
}
const MIME = { '.html': 'text/html; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
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
    const sink = c => { out += c; if (verbose) process.stdout.write(c); };
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
  console.log(`felt tests | ${SUITES.length} suites | ${url}\n`);
  const env = { ...process.env, CHROMIUM: exe, FELT_URL: url };
  const results = [];
  for (const s of SUITES) {
    if (!verbose) process.stdout.write(s.padEnd(24) + ' ... ');
    const r = await run(s, env);
    results.push(r);
    if (!verbose) console.log(r.code === 0 ? `ok   ${r.passed}/${r.total}  ${(r.ms / 1000).toFixed(1)}s` : `FAIL ${r.passed}/${r.total}`);
  }
  if (srv) srv.close();
  const failed = results.filter(r => r.code !== 0);
  if (!verbose) for (const r of failed) console.log(`\n--- ${r.name} ---\n${r.out.trim()}`);
  const p = results.reduce((a, r) => a + r.passed, 0), t = results.reduce((a, r) => a + r.total, 0);
  console.log(`\n${results.length - failed.length}/${results.length} suites, ${p}/${t} checks  ${failed.length ? 'FAIL' : 'ok'}`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('run-all: ' + (e.stack || e)); process.exit(2); });

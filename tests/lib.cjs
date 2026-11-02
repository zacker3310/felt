/* lib: what every suite shares. check() prints PASS/FAIL lines and done() prints the
   "N/M passed" trailer run-all parses. open() launches Chromium with software rendering,
   records console errors and network requests, and waits for boot (firstRun: true keeps the
   first-run lesson offer and the tutorials' first-Break offers, which every other suite skips;
   motion: true keeps the 6m motion, which every other suite turns off; intro: true keeps the
   opening, 6o, which every other suite skips).
   Taken from puttX. */
'use strict';
const URL = process.env.FELT_URL || 'http://127.0.0.1:4173/index.html';
const results = [];

function check(name, ok, detail) {
  results.push(!!ok);
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  -- ' + detail : ''));
}
function done() {
  const p = results.filter(Boolean).length;
  console.log(`\n${p}/${results.length} passed`);
  process.exit(p === results.length ? 0 : 1);
}
async function open(query = '', { viewport = { width: 1280, height: 800 }, hasTouch = false, isMobile = false, deviceScaleFactor = 1, screen, init, firstRun = false, motion = false, intro = false, reducedMotion } = {}) {
  const pw = require('playwright-core');
  const browser = await pw.chromium.launch({
    executablePath: process.env.CHROMIUM || pw.chromium.executablePath(),
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport, hasTouch, isMobile, deviceScaleFactor, ...(screen ? { screen } : {}), ...(reducedMotion ? { reducedMotion } : {}) });
  /* the first-run lesson offer (a sheet over home) stays out of every suite but the one that
     asks for a first run: as if it had been seen, unless the page has its own record */
  if (!firstRun) await page.addInitScript(() => { try { if (!localStorage.getItem('felt.lesson.v1')) localStorage.setItem('felt.lesson.v1', '{"v":1,"seen":true,"done":false}'); } catch (e) { } });
  /* likewise each game's tutorial offer on its first Break: as if turned down for every game */
  if (!firstRun) await page.addInitScript(() => { try { if (!localStorage.getItem('felt.tutorials.v1')) localStorage.setItem('felt.tutorials.v1', '{"v":1,"done":{},"skipped":{"8":true,"9":true,"bumper":true,"carom":true,"snooker":true},"never":false}'); } catch (e) { } });
  /* and the elevation tip on the first jump or masse trick shot (5s): as if seen */
  if (!firstRun) await page.addInitScript(() => { try { if (!localStorage.getItem('felt.elevTip.v1')) localStorage.setItem('felt.elevTip.v1', '{"v":1,"seen":true}'); } catch (e) { } });
  /* and the mouse tip on the first hover of the cloth (5 input): as if seen */
  if (!firstRun) await page.addInitScript(() => { try { if (!localStorage.getItem('felt.mouseTip.v1')) localStorage.setItem('felt.mouseTip.v1', '{"v":1,"seen":true}'); } catch (e) { } });
  /* the page's motion (6m: the card-to-sheet morph, numbers rolling up) stays out of every suite
     but the ones that ask for it, so they measure finished screens and final numbers */
  if (!motion) await page.addInitScript(() => { window.feltNoMotion = true; });
  /* the opening (6o: the lamp, the break, the wordmark) stays out of every suite but the one that
     asks for it, so a suite finds the home at boot as it always has */
  if (!intro) await page.addInitScript(() => { window.feltNoIntro = true; });
  if (init) await page.addInitScript(init);
  const errors = [], requests = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e.stack || e).split('\n').slice(0, 4).join(' <- ')));
  page.on('request', r => requests.push(r.url()));
  await page.goto(URL + query);
  await page.waitForFunction(() => window.booted === true, null, { timeout: 20000 });
  return { browser, page, errors, requests };
}
/* visible buttons, sliders and disclosure toggles smaller than `min` CSS px on either side */
const smallTargets = (page, min = 44) => page.evaluate(min => [...document.querySelectorAll('button, [role="slider"], summary')]
  .filter(b => b.getClientRects().length && getComputedStyle(b).visibility !== 'hidden')
  .map(b => { const r = b.getBoundingClientRect(); return { id: b.id || b.className, s: Math.round(Math.min(r.width, r.height)) }; })
  .filter(t => t.s < min), min);
/* wait until the table has settled back to an idle state */
const settled = (page, timeout = 30000) => page.waitForFunction(() => !['stroke', 'rolling', 'thinking'].includes(felt.state), null, { timeout });
/* visible text below 4.5:1 against what is behind it: each element's own text colour against
   its backgrounds composited up the tree onto the page colour. Text over the bare canvas is
   measured against the page colour. Large text (24 px, or 18.66 px bold) needs 3:1. */
const lowContrast = (page, min = 4.5) => page.evaluate(min => {
  const rgba = c => { const m = c.match(/[\d.]+/g).map(Number); return [m[0], m[1], m[2], m.length > 3 ? m[3] : 1]; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const over = (top, under) => [0, 1, 2].map(i => top[i] * top[3] + under[i] * (1 - top[3]));
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!el.getClientRects().length || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const layers = [];
    let hidden = false;
    for (let e = el; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.display === 'none' || +s.opacity === 0) hidden = true;
      layers.push(rgba(s.backgroundColor));
    }
    if (hidden) continue;
    let bg = rgba(getComputedStyle(document.body).backgroundColor);
    for (let i = layers.length - 1; i >= 0; i--) bg = over(layers[i], bg);
    const fg = over(rgba(cs.color), bg), a = lum(fg), b = lum(bg), r = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const px = parseFloat(cs.fontSize), large = px >= 24 || (px >= 18.66 && +cs.fontWeight >= 700);   /* WCAG large text: 3:1 */
    if (r < (large ? Math.min(min, 3) : min)) out.push({ id: el.id || el.className || el.tagName, text: el.textContent.trim().slice(0, 30), r: +r.toFixed(2) });
  }
  return out;
}, min);
/* visible titles with a word in lower case that Title Case (Apple's HIG) capitalizes: the home's
   cards and sections, sheet titles and group heads, list rows, switches, segmented choices, field
   labels, rule heads and button labels. Allowed in lower case: articles, and, but, or, nor and the
   prepositions of three letters or fewer (not first, last or after a colon), the second part of a
   hyphenated small word ("Head-to-Head"), words with a digit (14.1, 2x), units (ft, cr), "vs" and
   the brand "felt". Kickers render in caps, and a heading that is a sentence (it ends . ? or !, or
   is one of the result lines below, or is marked .prose) is sentence case and not looked at. */
const TITLE_SEL = ['#menu .tt > b', '.sect', 'h1', '.sheet h2', 'h3.ghead', 'h3.fineHead', 'h3.cvHead', '.topic .tt > b', '.cvSw .tt > b',
  '.tog > span', '.plab', '.tutLink .tt', '.seg > button', '.popBtn .pv', '.field > .label', '.rules li > div > b', '.pick .game b', '.foe .tt > b', '.tcard b', 'label.prow .plab',
  'button.big', 'button.ghost', 'button.quiet', 'button.act', 'button.cvBtn', 'button.cvMini', 'button.tool', 'button.cflag', 'button.lessonGo > span', '.howAct > button', '#exBar button',
  '#optHead', '#optBtns button', '#coachBtn', '.kpis dt', '.cvFacts dt', '.cvLines li > span:first-child', '.stat > span', '.ccSum + .tt b'];
const TITLE_SKIP = ['overText', 'matchTitle', 'hoTitle', 'trickHead', 'drillHead', 'tutDoneTitle', 'tutOfferTitle', 'offerTitle', 'doneTitle', 'mdEndT'];
const badTitles = page => page.evaluate(([SEL, SKIP]) => {
  const small = /^(a|an|the|and|but|or|nor|as|at|by|for|in|of|off|on|per|to|up|via)$/, keep = /^(felt|ft|mm|cr|x|pts|vs)$/;
  const seen = new Set(), out = [];
  const shown = e => { for (let x = e; x; x = x.parentElement) { const s = getComputedStyle(x); if (s.display === 'none' || s.visibility === 'hidden' || x.hidden) return false; } return e.getClientRects().length > 0; };
  const own = e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
  for (const e of document.querySelectorAll(SEL.join(','))) {
    if (seen.has(e)) continue;
    seen.add(e);
    if (!shown(e) || e.closest('.prose, .kicker, .arm') || SKIP.some(id => e.id === id || (e.parentElement && e.parentElement.id === id))) continue;
    const t = own(e);
    if (!/[a-z]/.test(t) || /[.?!]["')]?$/.test(t)) continue;
    const toks = t.split(' ').filter(w => /[A-Za-z0-9]/.test(w)), wrong = [];
    toks.forEach((w, i) => {
      const edge = i === 0 || i === toks.length - 1 || /:$/.test(toks[i - 1]);
      w.split('-').forEach((p, j) => {
        const c = p.replace(/^[^A-Za-z0-9]+/, ''), core = c.replace(/[^A-Za-z0-9']+$/, '').toLowerCase();
        if (!/^[a-z]/.test(c) || /[0-9]/.test(c) || keep.test(core)) return;
        if (small.test(core) && !(edge && j === 0)) return;
        wrong.push(p);
      });
    });
    if (wrong.length) out.push({ id: e.id || (e.closest('[id]') || {}).id || e.className, text: t, wrong });
  }
  return out;
}, [TITLE_SEL, TITLE_SKIP]);

/* pick a choice by a real tap: a choice in a pop-up menu (index.html 6p: a .seg.pop) is reached
   by tapping its pop-up button first, then the item; a segmented one directly. touch: true taps
   with the touchscreen, else the mouse clicks (as page.click). */
async function choose(page, sel, { touch = false } = {}) {
  const at = async xy => { if (touch) await page.touchscreen.tap(xy[0], xy[1]); else await page.mouse.click(xy[0], xy[1]); await page.waitForTimeout(120); };
  const btn = await page.evaluate(sel => {
    const b = document.querySelector(sel), s = b && b.closest('.seg.pop');
    if (!s || s.classList.contains('open')) return null;
    s.nextElementSibling.scrollIntoView({ block: 'center' });
    return true;
  }, sel);
  if (btn) await at(await stableCentre(page, sel, true));
  await at(await stableCentre(page, sel, false));
}
/* the centre of an element (or of its pop-up button) once it has stopped moving (a pushed page's
   slide, a menu's opening), as page.click waits for a stable target */
function stableCentre(page, sel, popBtn) {
  return page.evaluate(([sel, popBtn]) => new Promise(res => {
    let b = document.querySelector(sel);
    if (popBtn) b = b.closest('.seg.pop').nextElementSibling;
    else if (!b.closest('.seg.pop.open')) b.scrollIntoView({ block: 'center' });
    let last = null, n = 0;
    const t0 = performance.now();
    const step = () => {
      const r = b.getBoundingClientRect(), k = [r.left, r.top, r.width, r.height].map(v => v.toFixed(1)).join();
      const moving = document.getAnimations().some(a => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.contains && a.effect.target.contains(b));
      if (k === last && !moving && ++n >= 3 || performance.now() - t0 > 3000) return res([r.left + r.width / 2, r.top + r.height / 2]);
      if (k !== last) n = 0;
      last = k; requestAnimationFrame(step);
    };
    step();
  }), [sel, popBtn]);
}
/* open a choice's pop-up menu by a real tap (as choose, without picking) */
async function openPop(page, sel, { touch = false } = {}) {
  await page.evaluate(sel => document.querySelector(sel).closest('.seg.pop').nextElementSibling.scrollIntoView({ block: 'center' }), sel);
  const xy = await stableCentre(page, sel, true);
  if (touch) await page.touchscreen.tap(xy[0], xy[1]); else await page.mouse.click(xy[0], xy[1]);
  await page.waitForFunction(sel => { const s = document.querySelector(sel).closest('.seg.pop'); return s.classList.contains('open') && !s.getAnimations().some(a => a.playState === 'running'); }, sel, { timeout: 3000 }).catch(() => {});
}

/* ---- frame budgets on a busy machine ----
   Wall time on a loaded box (the suites run side by side, other jobs share the runner) includes the
   time the browser's threads sat runnable, waiting for a core. Linux counts that per thread
   (/proc/<pid>/task/<tid>/schedstat: ns on a CPU, ns waiting on a run queue), so a window's stretch
   is (run + wait) / run summed over every thread of the browser's processes (the renderer, the GPU
   process's SwiftShader, the browser). A budget is multiplied by that stretch, measured over the same
   window as the frames: only the waiting is divided out, never the work, so a frame that does more
   (a real regression: a busy loop is run time) fails under load as it fails alone. Without /proc (not
   Linux) the stretch is 1. loadMark(page) marks the browser's threads now; loadSince(page, mark)
   gives { f, run, wait } (ms) for the window since (every browser this suite has open). */
const fs = require('fs');
/* the browsers this suite launched: every process under this one (each suite is its own process) */
const browserPids = () => treePids(process.pid).slice(1);
function treePids(root) {
  if (!root) return [];
  const kids = new Map();
  let ents = [];
  try { ents = fs.readdirSync('/proc'); } catch (e) { return []; }
  for (const d of ents) {
    if (!/^\d+$/.test(d)) continue;
    try { const st = fs.readFileSync('/proc/' + d + '/stat', 'utf8'), pp = +st.slice(st.lastIndexOf(')') + 2).split(' ')[1]; if (!kids.has(pp)) kids.set(pp, []); kids.get(pp).push(+d); } catch (e) { }
  }
  const out = [root];
  for (let i = 0; i < out.length; i++) for (const k of kids.get(out[i]) || []) out.push(k);
  return out;
}
function schedOf(pids) {
  const m = new Map();
  for (const p of pids) {
    let tids = [];
    try { tids = fs.readdirSync('/proc/' + p + '/task'); } catch (e) { continue; }
    for (const t of tids) {
      try { const [run, wait] = fs.readFileSync('/proc/' + p + '/task/' + t + '/schedstat', 'utf8').split(' ').map(Number); m.set(p + '/' + t, [run, wait]); } catch (e) { }
    }
  }
  return m;
}
function loadMark() { return { t: Date.now(), m: schedOf(browserPids()) }; }
function loadSince(page, mark) {
  const now = schedOf(browserPids());
  let run = 0, wait = 0;
  for (const [k, [r, w]] of now) { const a = mark.m.get(k) || [0, 0]; run += r - a[0]; wait += w - a[1]; }
  const f = run > 0 ? (run + wait) / run : 1;
  return { f: Math.max(1, f), run: run / 1e6, wait: wait / 1e6, ms: Date.now() - mark.t };
}

/* a single frame on a loaded box can wait a whole scheduling round (100 ms and more) for a core: a
   window's stretch (above) is the average, the worst frame is not. frameClock(page) samples, every
   millisecond from a worker thread, how long the threads that draw a frame have waited for a core
   (schedstat): the renderers' main and compositor threads, the GPU process's main and display
   compositor threads and SwiftShader's raster workers. work(d, end) is a frame of d ms that ended at
   end (epoch ms) less what they waited in it (per process its most-waited thread, the processes
   summed): the frame's own work, about the same on a busy box as on an idle one; a frame that does
   more (a busy loop) is as long as ever. waited(a, b) is that waiting between two times (a gap
   between frames, or a whole run of frames). trackFrames(page, expr) makes the page's array at expr (hero.ms, V3.ms: one duration pushed per
   frame) also note each push's time; frameEnds(page, expr) reads them. Without /proc the clock
   takes nothing out. */
const { Worker } = require('worker_threads');
const SAMPLER = `
const { workerData: D } = require('worker_threads'), fs = require('fs');
const flag = new Int32Array(D.sab), out = [], n = D.paths.length;
const read = p => { try { return +fs.readFileSync(p, 'utf8').split(' ')[1]; } catch (e) { return NaN; } };
const last = new Float64Array(n);
for (;;) {
  const t = performance.timeOrigin + performance.now(), row = [t];
  for (let i = 0; i < n; i++) { const v = read(D.paths[i]); row.push(last[i] = Number.isNaN(v) ? last[i] : v); }
  out.push(row);
  if (out.length === 1) require('worker_threads').parentPort.postMessage('ready');
  if (Atomics.load(flag, 0)) break;
  Atomics.wait(flag, 0, 0, 1);
}
require('worker_threads').parentPort.postMessage(out);
`;
function frameThreads() {
  const out = [];
  for (const p of browserPids()) {
    let cl = '';
    try { cl = fs.readFileSync('/proc/' + p + '/cmdline', 'utf8'); } catch (e) { continue; }
    const gpu = /--type=gpu-process/.test(cl);
    if (!gpu && !/--type=renderer/.test(cl)) continue;
    /* the main thread, and the threads a frame goes through: the renderer's compositor, the GPU
       process's display compositor and SwiftShader's raster workers */
    const want = gpu ? /^(VizCompositorTh|Thread<\d+>)$/ : /^Compositor$/;
    let tids = [];
    try { tids = fs.readdirSync('/proc/' + p + '/task'); } catch (e) { }
    for (const t of tids) {
      let comm = '';
      try { comm = fs.readFileSync(`/proc/${p}/task/${t}/comm`, 'utf8').trim(); } catch (e) { continue; }
      if (+t === p || want.test(comm)) out.push({ pid: p, comm, path: `/proc/${p}/task/${t}/schedstat` });
    }
  }
  return out;
}
async function frameClock() {
  const th = fs.existsSync('/proc/self/schedstat') ? frameThreads() : [];
  const sab = new SharedArrayBuffer(4), flag = new Int32Array(sab);
  const w = th.length ? new Worker(SAMPLER, { eval: true, workerData: { sab, paths: th.map(x => x.path) } }) : null;
  if (w) w.unref();
  const msgs = [];
  const rows = w ? new Promise(res => w.on('message', m => { if (m === 'ready') msgs.push(m); else res(m); })) : Promise.resolve([]);
  /* the first sample taken before any frame is measured */
  if (w) await new Promise(res => { const t = setInterval(() => { if (msgs.length) { clearInterval(t); res(); } }, 1); });
  let S = null;
  return {
    threads: th.length,
    async stop() {
      Atomics.store(flag, 0, 1); Atomics.notify(flag, 0);
      const R = await rows;
      S = R.map(r => { const o = [r[0]]; o.w = r.slice(1); return o; });
      return { samples: S.length };
    },
    /* a frame's waiting: per process the most any one of its threads waited in it (a process's
       threads run side by side: their waits overlap), summed over the processes (the renderer hands
       the frame to the GPU process and blocks on it: one after the other) */
    work: (d, end) => Math.max(0, d - waited(end - d, end)),
    waited: (a, b) => waited(a, b),
  };
  function waited(a, b) {
    if (!S || !S.length) return 0;
    const A = at(a), B = at(b), per = new Map();
    for (let i = 0; i < A.length; i++) per.set(th[i].pid, Math.max(per.get(th[i].pid) || 0, (B[i] - A[i]) / 1e6));
    let sum = 0;
    for (const v of per.values()) sum += v;
    return sum;
  }
  /* each thread's waiting (ns) at time t, interpolated between samples */
  function at(t) {
    let lo = 0, hi = S.length - 1;
    if (t <= S[0][0]) return S[0].w;
    if (t >= S[hi][0]) return S[hi].w;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m][0] <= t) lo = m; else hi = m; }
    const p = S[lo], q = S[hi], u = (t - p[0]) / (q[0] - p[0] || 1);
    return p.w.map((v, i) => v + (q.w[i] - v) * u);
  }
}
const trackFrames = (page, expr) => page.evaluate(expr => {
  const T = (window.__frameEnds = window.__frameEnds || {});
  const ends = T[expr] = [];
  const arr = eval(expr), Tracked = class extends Array { push(...v) { for (let i = 0; i < v.length; i++) ends.push(performance.timeOrigin + performance.now()); return super.push(...v); } };
  Object.setPrototypeOf(arr, Tracked.prototype);
  arr.length = 0;
}, expr);
const frameEnds = (page, expr) => page.evaluate(expr => (window.__frameEnds || {})[expr] || [], expr);

/* how much slower this machine draws than the one the absolute frame budgets were set on. A fixed
   software-canvas workload, the median of seven runs, each run's wall time with its own waiting for a
   core taken out (loadSince), so it is the machine's speed and not what else is running at that moment
   (the waiting is the frame clock's and the window's, above; the median and not the best, so a CPU
   throttled in bursts, CDP's setCPUThrottlingRate, is not measured between its bursts); budgets are multiplied by it (never below 1, never above 3), so a slow
   CI runner is judged against itself and a fast machine keeps the real 60 fps budget. The relative
   checks (with vs without) carry the regression signal either way. */
const SPEED_REF_MS = 6.4;   /* this dev machine, headless Chromium, 2026-10-30 */
async function speedFactor(page) {
  const runs = [];
  for (let r = 0; r < 7; r++) {
    const mk = loadMark(page);
    const ms = await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 1179; c.height = 2556;
      const g = c.getContext('2d');
      g.getImageData(0, 0, 1, 1); const t0 = performance.now();
      for (let i = 0; i < 40; i++) {
        const x = (i * 97) % 1100, y = (i * 211) % 2400, gr = g.createRadialGradient(x, y, 4, x, y, 160);
        gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#0a3');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, 160, 0, 6.283); g.fill();
      }
      g.getImageData(0, 0, 1, 1); return performance.now() - t0;
    });
    runs.push(ms / loadSince(page, mk).f);
  }
  const ms = runs.sort((a, b) => a - b)[3];
  return { ms, f: Math.min(3, Math.max(1, ms / SPEED_REF_MS)) };
}
/* a frame-budget window: const w = await budgetWindow(page); ...measure...; const k = await w.end().
   k.load is the window's stretch (multiply every absolute budget measured in it), k.speed this
   machine's speedFactor (for the budgets that are scaled by it), k.text says both for the check's
   line. */
async function budgetWindow(page, mark) {
  const mk = mark || loadMark(page);
  return {
    async end({ speed = false } = {}) {
      const L = loadSince(page, mk), sp = speed ? await speedFactor(page) : { f: 1, ms: 0 };
      return { load: L.f, speed: sp.f, k: L.f * sp.f, L, sp, text: `load x${L.f.toFixed(2)}${speed ? `, speed x${sp.f.toFixed(2)}` : ''}` };
    },
  };
}
/* Node's own CPU time (ms) on this thread: a node-side budget (a search, a season) judged on the work
   whatever else shares the cores */
const cpuMs = () => process.threadCpuUsage ? (u => (u.user + u.system) / 1000)(process.threadCpuUsage()) : (u => (u.user + u.system) / 1000)(process.cpuUsage());

module.exports = { speedFactor, loadMark, loadSince, budgetWindow, cpuMs, frameClock, trackFrames, frameEnds, URL, check, done, open, smallTargets, settled, lowContrast, badTitles, choose, openPop };
